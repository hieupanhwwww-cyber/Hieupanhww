-- 0009: sổ sách — danh mục hạng mục (+ giá nhập), chi phí đơn, giá vốn phiếu kho, sổ thu chi, chốt sổ tháng

-- Chuẩn hóa tên để so khớp không phân biệt hoa thường (cả chữ có dấu, kể cả khi CSDL chạy locale C).
create function public.norm_name(t text) returns text language sql immutable as $$ select lower(btrim(t) collate "und-x-icu") $$;

-- ---------- danh mục ----------
create table public.catalog (
  id uuid primary key default gen_random_uuid(),
  name text not null check (btrim(name) <> ''),
  material text not null default '',
  unit text not null default 'm²' check (unit in ('m²', 'md', 'bộ', 'cái', 'gói', 'cánh', 'điểm', 'công')),
  price bigint not null default 0 check (price >= 0),
  legacy_id text unique,
  created_at timestamptz not null default now()
);
create unique index catalog_name_uq on public.catalog (public.norm_name(name));

create table public.catalog_costs (
  catalog_id uuid primary key references public.catalog (id) on delete cascade,
  cost bigint not null check (cost >= 0),
  at timestamptz not null default now()
);

-- ---------- chi phí của đơn (chỉ chủ): giá nhập từng dòng, giá vốn từng phát sinh, vận chuyển ----------
create table public.order_costs (
  order_id uuid primary key references public.orders (id) on delete cascade,
  rows jsonb not null default '{}'::jsonb,   -- { mã dòng: giá nhập 1 đơn vị }
  chg jsonb not null default '{}'::jsonb,    -- { mã phát sinh: giá vốn }
  ship bigint not null default 0 check (ship >= 0)
);

-- ---------- giá vốn tại thời điểm nhập/xuất kho (chỉ chủ) ----------
create table public.stock_movement_costs (
  movement_id uuid primary key references public.stock_movements (id) on delete cascade,
  unit_cost bigint not null check (unit_cost >= 0)
);

-- ---------- sổ thu chi (chỉ chủ) ----------
create table public.cash_entries (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('in', 'out')),
  date date not null,
  amount bigint not null check (amount > 0),
  cat text not null check (btrim(cat) <> ''),
  note text not null default '',
  method text not null default 'cash' check (method in ('cash', 'transfer')),
  order_id uuid references public.orders (id) on delete set null,
  legacy_id text unique,
  created_by uuid references auth.users (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);
create index on public.cash_entries (date);
create index on public.cash_entries (order_id);

create table public.books (
  month text primary key check (month ~ '^\d{4}-(0[1-9]|1[0-2])$'),
  in_total bigint not null,
  out_total bigint not null,
  closed_at timestamptz not null default now(),
  closed_by uuid references auth.users (id) on delete set null
);

alter table public.catalog enable row level security;
revoke all on public.catalog from anon, authenticated;
grant select on public.catalog to authenticated;
create policy catalog_read on public.catalog for select to authenticated using (public.is_member());
do $$
declare t text;
begin
  foreach t in array array['catalog_costs', 'order_costs', 'stock_movement_costs', 'cash_entries', 'books'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon, authenticated', t);
    execute format('grant select on public.%I to authenticated', t);
    execute format('create policy %I on public.%I for select to authenticated using (public.is_owner())', t || '_owner_read', t);
  end loop;
end $$;

-- ---------- danh mục: thêm/sửa/xóa (chủ). p_cost null = giữ nguyên giá nhập ----------
create function public.save_catalog_item(p_id uuid, p_name text, p_material text, p_unit text, p_price bigint, p_cost bigint) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  perform public.require_owner();
  if p_id is null then
    insert into catalog (name, material, unit, price) values (btrim(p_name), btrim(coalesce(p_material, '')), p_unit, coalesce(p_price, 0)) returning id into v_id;
  else
    update catalog set name = btrim(p_name), material = btrim(coalesce(p_material, '')), unit = p_unit, price = coalesce(p_price, 0)
     where id = p_id returning id into v_id;
    if v_id is null then raise exception 'Không tìm thấy mục trong danh mục'; end if;
  end if;
  if p_cost is not null then
    insert into catalog_costs (catalog_id, cost) values (v_id, p_cost)
    on conflict (catalog_id) do update set cost = excluded.cost, at = now();
  end if;
  return v_id;
end $$;

create function public.delete_catalog_item(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform public.require_owner();
  delete from catalog where id = p_id;
end $$;

-- ---------- chi phí đơn (chủ): gộp vào giá trị đã có ----------
create function public.save_order_costs(p_order_id uuid, p_rows jsonb, p_chg jsonb, p_ship bigint) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform public.require_owner();
  if not exists (select 1 from orders where id = p_order_id) then raise exception 'Không tìm thấy đơn'; end if;
  insert into order_costs (order_id, rows, chg, ship)
  values (p_order_id, jsonb_strip_nulls(coalesce(p_rows, '{}'::jsonb)), jsonb_strip_nulls(coalesce(p_chg, '{}'::jsonb)), greatest(coalesce(p_ship, 0), 0))
  on conflict (order_id) do update
    set rows = jsonb_strip_nulls(order_costs.rows || coalesce(p_rows, '{}'::jsonb)),
        chg = jsonb_strip_nulls(order_costs.chg || coalesce(p_chg, '{}'::jsonb)),
        ship = case when p_ship is null then order_costs.ship else greatest(p_ship, 0) end;
end $$;

-- Khi một bản báo giá được chốt: chụp giá nhập danh mục (khớp tên dòng) vào đơn cho dòng chưa có giá nhập,
-- để đổi danh mục sau này không làm đổi lãi đơn cũ.
create function public._snapshot_catalog_costs() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_add jsonb;
begin
  select coalesce(jsonb_object_agg(r ->> 'id', cc.cost), '{}'::jsonb) into v_add
    from jsonb_array_elements(coalesce(new.quote -> 'rows', '[]'::jsonb)) r
    join catalog k on norm_name(k.name) = norm_name(r ->> 'name')
    join catalog_costs cc on cc.catalog_id = k.id
   where cc.cost > 0;
  insert into order_costs (order_id, rows) values (new.order_id, v_add)
  on conflict (order_id) do update set rows = v_add || order_costs.rows;  -- giá đã nhập riêng cho đơn được ưu tiên
  return new;
end $$;
create trigger order_quotes_snapshot_costs after update of version_no on public.order_quotes
  for each row when (old.version_no is null and new.version_no is not null) execute function public._snapshot_catalog_costs();

-- Giá vốn lúc nhập/xuất kho.
create function public._snapshot_stock_cost() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into stock_movement_costs (movement_id, unit_cost)
  select new.id, coalesce((select cost_price from product_costs where product_id = new.product_id), 0);
  return new;
end $$;
create trigger stock_movements_snapshot_cost after insert on public.stock_movements
  for each row execute function public._snapshot_stock_cost();

-- ---------- sổ thu chi ----------
create function public._check_book_open(p_date date, p_confirm boolean) returns void
language plpgsql stable security definer set search_path = public as $$
begin
  if p_date is not null and not coalesce(p_confirm, false) and exists (select 1 from books where month = to_char(p_date, 'YYYY-MM')) then
    raise exception 'Tháng % đã chốt sổ. Xác nhận nếu vẫn muốn sửa.', to_char(p_date, 'MM/YYYY');
  end if;
end $$;

create function public.save_cash_entry(p_id uuid, p_type text, p_date date, p_amount bigint, p_cat text, p_note text, p_method text, p_order_id uuid, p_confirm boolean)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_old date; v_id uuid;
begin
  perform public.require_owner();
  if coalesce(p_type, '') not in ('in', 'out') then raise exception 'Loại khoản phải là thu hoặc chi'; end if;
  if p_amount is null or p_amount <= 0 then raise exception 'Số tiền phải lớn hơn 0'; end if;
  if btrim(coalesce(p_cat, '')) = '' then raise exception 'Chưa chọn nhóm'; end if;
  if p_date is null then raise exception 'Chưa chọn ngày'; end if;
  perform public._check_book_open(p_date, p_confirm);
  if p_id is null then
    insert into cash_entries (type, date, amount, cat, note, method, order_id, created_by)
    values (p_type, p_date, p_amount, btrim(p_cat), btrim(coalesce(p_note, '')), coalesce(p_method, 'cash'), p_order_id, auth.uid())
    returning id into v_id;
  else
    select date into v_old from cash_entries where id = p_id;
    if v_old is null then raise exception 'Không tìm thấy khoản thu chi'; end if;
    perform public._check_book_open(v_old, p_confirm);
    update cash_entries set type = p_type, date = p_date, amount = p_amount, cat = btrim(p_cat), note = btrim(coalesce(p_note, '')),
           method = coalesce(p_method, 'cash'), order_id = p_order_id
     where id = p_id returning id into v_id;
  end if;
  return v_id;
end $$;

create function public.delete_cash_entry(p_id uuid, p_confirm boolean) returns void
language plpgsql security definer set search_path = public as $$
declare v_date date;
begin
  perform public.require_owner();
  select date into v_date from cash_entries where id = p_id;
  if v_date is null then raise exception 'Không tìm thấy khoản thu chi'; end if;
  perform public._check_book_open(v_date, p_confirm);
  delete from cash_entries where id = p_id;
end $$;

-- Chốt sổ tháng: lưu lại tổng thu/chi lúc chốt (giao diện tính và gửi lên) để biết về sau có ai sửa.
create function public.close_book(p_month text, p_in bigint, p_out bigint) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform public.require_owner();
  if p_month is null or p_month !~ '^\d{4}-(0[1-9]|1[0-2])$' then raise exception 'Tháng không hợp lệ'; end if;
  insert into books (month, in_total, out_total, closed_by) values (p_month, coalesce(p_in, 0), coalesce(p_out, 0), auth.uid())
  on conflict (month) do update set in_total = excluded.in_total, out_total = excluded.out_total, closed_at = now(), closed_by = excluded.closed_by;
end $$;

create function public.reopen_book(p_month text) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform public.require_owner();
  delete from books where month = p_month;
end $$;

-- ---------- dữ liệu cho sổ quỹ và cộng sổ (chỉ chủ) ----------
create function public.ledger_data() returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  perform public.require_owner();
  return jsonb_build_object(
    'cash', (select coalesce(jsonb_agg(jsonb_build_object('id', id, 'type', type, 'date', date, 'amount', amount, 'cat', cat, 'note', note,
                      'method', method, 'order_id', order_id) order by date, created_at), '[]') from cash_entries),
    'payments', (select coalesce(jsonb_agg(jsonb_build_object('id', p.id, 'date', p.date, 'amount', p.amount, 'order_id', p.order_id,
                      'code', o.code, 'customer', o.customer_name, 'no', p.no, 'method', p.method) order by p.date, p.created_at), '[]')
                   from order_payments p join orders o on o.id = p.order_id),
    'retail', (select coalesce(jsonb_agg(jsonb_build_object('date', d, 'amount', amt) order by d), '[]') from (
                 select vn_date(created_at)::text as d, sum(total)::bigint as amt from sales group by 1) x),
    'start', (select case when cash_start_date is null then null else jsonb_build_object('date', cash_start_date, 'amount', cash_start_amount) end from store_settings),
    'books', (select coalesce(jsonb_object_agg(month, jsonb_build_object('in', in_total, 'out', out_total, 'closedAt', closed_at)), '{}') from books)
  );
end $$;

create function public.orders_for_books() returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  perform public.require_owner();
  return (select coalesce(jsonb_agg(x order by x ->> 'code'), '[]') from (
    select jsonb_build_object(
      'id', o.id, 'code', o.code, 'status', o.status, 'customer', o.customer_name, 'project', o.project, 'closedAt', o.closed_at,
      'versions', (select jsonb_agg(jsonb_build_object('no', q.version_no, 'total', q.total, 'closedAt', q.closed_at) order by q.version_no)
                     from order_quotes q where q.order_id = o.id and q.version_no is not null),
      'rows', (select coalesce(jsonb_agg(jsonb_build_object('id', r ->> 'id', 'name', r ->> 'name', 'qty', (r ->> 'qty')::numeric, 'price', (r ->> 'price')::numeric)), '[]')
                 from order_quotes q, jsonb_array_elements(q.quote -> 'rows') r
                where q.order_id = o.id and q.version_no = (select max(version_no) from order_quotes where order_id = o.id)),
      'discount', (select q.quote -> 'discount' from order_quotes q where q.order_id = o.id and q.version_no = (select max(version_no) from order_quotes where order_id = o.id)),
      'changes', (select coalesce(jsonb_agg(jsonb_build_object('id', c.id, 'sign', c.sign, 'amount', c.amount, 'title', c.title, 'confirmedAt', c.confirmed_at)), '[]')
                    from order_changes c where c.order_id = o.id and c.status = 'confirmed'),
      'costs', (select jsonb_build_object('rows', oc.rows, 'chg', oc.chg, 'ship', oc.ship) from order_costs oc where oc.order_id = o.id),
      'spend', (select coalesce(sum(amount), 0) from cash_entries where order_id = o.id and type = 'out'),
      'stock_cost', (select coalesce(sum(round(m.quantity * c.unit_cost)), 0) from stock_movements m join stock_movement_costs c on c.movement_id = m.id
                      where m.order_id = o.id and m.type = 'out')
    ) as x
    from orders o where o.status <> 'quote') t);
end $$;

revoke execute on function public._snapshot_catalog_costs(), public._snapshot_stock_cost(), public._check_book_open(date, boolean) from public, anon, authenticated;
revoke execute on function public.save_catalog_item(uuid, text, text, text, bigint, bigint), public.delete_catalog_item(uuid),
  public.save_order_costs(uuid, jsonb, jsonb, bigint), public.save_cash_entry(uuid, text, date, bigint, text, text, text, uuid, boolean),
  public.delete_cash_entry(uuid, boolean), public.close_book(text, bigint, bigint), public.reopen_book(text), public.ledger_data(), public.orders_for_books() from anon;
