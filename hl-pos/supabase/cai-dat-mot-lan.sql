-- ===== 0001_auth.sql =====
-- 0001: tài khoản, vai trò, thông tin cửa hàng

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null default '',
  role text not null default 'staff' check (role in ('owner', 'staff')),
  created_at timestamptz not null default now()
);

create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  -- Chỉ tài khoản do chủ tạo (qua app, gắn cờ hl_staff mà người dùng không tự đặt được) mới có hồ sơ.
  -- Người lạ tự đăng ký qua API sẽ không có hồ sơ => không có quyền gì.
  if coalesce((new.raw_app_meta_data ->> 'hl_staff')::boolean, false) then
    insert into public.profiles (id, full_name)
    values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', ''))
    on conflict (id) do nothing;
  end if;
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();
-- Phòng khi Supabase ghi app_metadata sau bước tạo tài khoản
create trigger on_auth_user_flagged after update of raw_app_meta_data on auth.users
  for each row execute function public.handle_new_user();

create function public.is_member() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid())
$$;

create function public.is_owner() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'owner')
$$;

alter table public.profiles enable row level security;
revoke all on public.profiles from anon, authenticated;
grant select, update (full_name, role) on public.profiles to authenticated;

create policy profiles_read on public.profiles for select to authenticated using (public.is_member());
-- Chủ sửa hồ sơ người khác (không tự hạ quyền mình để tránh cửa hàng mất chủ)
create policy profiles_owner_update on public.profiles for update to authenticated
  using (public.is_owner() and id <> auth.uid())
  with check (public.is_owner());

create table public.store_settings (
  id int primary key default 1 check (id = 1),
  name text not null,
  address text not null default '',
  phone text not null default '',
  note text
);
insert into public.store_settings (name, address, phone)
values ('Nội Thất Hùng Loan', 'Làng nghề Hà Lâm 1 – Thư Lâm – Hà Nội', '0916.771.586 – 0961.761.868');

alter table public.store_settings enable row level security;
revoke all on public.store_settings from anon, authenticated;
grant select, update (name, address, phone, note) on public.store_settings to authenticated;
create policy store_read on public.store_settings for select to authenticated using (public.is_member());
create policy store_owner_update on public.store_settings for update to authenticated
  using (public.is_owner()) with check (public.is_owner());

revoke execute on function public.is_owner() from anon;
revoke execute on function public.is_member() from anon;
revoke execute on function public.handle_new_user() from anon, authenticated;

-- ===== 0002_products.sql =====
-- 0002: hàng hóa, giá vốn (chỉ chủ), phiếu kho, tồn kho

create table public.products (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (btrim(code) <> ''),
  name text not null check (btrim(name) <> ''),
  kind text not null default 'goods' check (kind in ('goods', 'material')),
  unit text not null default 'cái',
  sale_price bigint not null default 0 check (sale_price >= 0),
  low_stock_threshold numeric not null default 0 check (low_stock_threshold >= 0),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.product_costs (
  product_id uuid primary key references public.products (id) on delete cascade,
  cost_price bigint not null default 0 check (cost_price >= 0)
);

create table public.stock_movements (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id),
  type text not null check (type in ('in', 'out')),
  quantity numeric not null check (quantity > 0),
  reason text not null default '',
  sale_id uuid,
  order_id uuid,
  created_by uuid references auth.users (id) default auth.uid(),
  created_at timestamptz not null default now()
);
create index on public.stock_movements (product_id);

-- Quyền: đọc qua API, ghi chỉ qua hàm bên dưới
alter table public.products enable row level security;
alter table public.product_costs enable row level security;
alter table public.stock_movements enable row level security;
revoke all on public.products, public.product_costs, public.stock_movements from anon, authenticated;
grant select on public.products, public.stock_movements to authenticated;
grant select on public.product_costs to authenticated;
create policy products_read on public.products for select to authenticated using (public.is_member());
create policy movements_read on public.stock_movements for select to authenticated using (public.is_member());
create policy costs_owner_read on public.product_costs for select to authenticated using (public.is_owner());

create view public.product_stock with (security_invoker = true) as
  select p.id as product_id,
         coalesce(sum(case m.type when 'in' then m.quantity else -m.quantity end), 0) as stock,
         coalesce(sum(case m.type when 'in' then m.quantity else -m.quantity end), 0) <= p.low_stock_threshold as is_low
    from public.products p
    left join public.stock_movements m on m.product_id = p.id
   group by p.id;
revoke all on public.product_stock from anon;
grant select on public.product_stock to authenticated;

create function public.require_login() returns void language plpgsql stable
security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'Chưa đăng nhập'; end if;
  if not public.is_member() then raise exception 'Tài khoản không có quyền dùng app'; end if;
end $$;

create function public.require_owner() returns void language plpgsql stable
security definer set search_path = public as $$
begin
  if not public.is_owner() then raise exception 'Chỉ chủ cửa hàng được làm việc này'; end if;
end $$;

-- Thêm/sửa hàng hóa (chỉ chủ). p_cost_price null = giữ nguyên giá vốn.
create function public.save_product(
  p_id uuid, p_code text, p_name text, p_kind text, p_unit text,
  p_sale_price bigint, p_low_stock_threshold numeric, p_cost_price bigint
) returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  perform public.require_owner();
  if p_id is null then
    insert into products (code, name, kind, unit, sale_price, low_stock_threshold)
    values (btrim(p_code), btrim(p_name), p_kind, coalesce(nullif(btrim(p_unit), ''), 'cái'), p_sale_price, coalesce(p_low_stock_threshold, 0))
    returning id into v_id;
  else
    update products set code = btrim(p_code), name = btrim(p_name), kind = p_kind,
           unit = coalesce(nullif(btrim(p_unit), ''), 'cái'), sale_price = p_sale_price,
           low_stock_threshold = coalesce(p_low_stock_threshold, 0)
     where id = p_id returning id into v_id;
    if v_id is null then raise exception 'Không tìm thấy hàng hóa'; end if;
  end if;
  if p_cost_price is not null then
    insert into product_costs (product_id, cost_price) values (v_id, p_cost_price)
    on conflict (product_id) do update set cost_price = excluded.cost_price;
  end if;
  return v_id;
end $$;

-- Ngừng bán / bán lại (chỉ chủ). Không xóa để giữ lịch sử.
create function public.set_product_active(p_id uuid, p_active boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform public.require_owner();
  update products set active = p_active where id = p_id;
end $$;

-- Dùng nội bộ: khóa hàng, kiểm tra tồn, ghi phiếu. Không mở cho API.
create function public._move_stock(
  p_product_id uuid, p_type text, p_quantity numeric, p_reason text, p_sale_id uuid, p_order_id uuid
) returns uuid language plpgsql security definer set search_path = public as $$
declare v_name text; v_stock numeric; v_id uuid;
begin
  if p_quantity is null or p_quantity <= 0 then raise exception 'Số lượng phải lớn hơn 0'; end if;
  select name into v_name from products where id = p_product_id for update;
  if v_name is null then raise exception 'Không tìm thấy hàng hóa'; end if;
  if p_type = 'out' then
    select coalesce(sum(case type when 'in' then quantity else -quantity end), 0) into v_stock
      from stock_movements where product_id = p_product_id;
    if v_stock < p_quantity then
      raise exception 'Không đủ tồn kho: % (còn %, cần %)', v_name, trim_scale(v_stock), trim_scale(p_quantity);
    end if;
  end if;
  insert into stock_movements (product_id, type, quantity, reason, sale_id, order_id, created_by)
  values (p_product_id, p_type, p_quantity, coalesce(p_reason, ''), p_sale_id, p_order_id, auth.uid())
  returning id into v_id;
  return v_id;
end $$;
revoke execute on function public._move_stock(uuid, text, numeric, text, uuid, uuid) from public, anon, authenticated;

-- Phiếu nhập/xuất thủ công (chủ và nhân viên)
create function public.record_stock(p_product_id uuid, p_type text, p_quantity numeric, p_reason text)
returns uuid language plpgsql security definer set search_path = public as $$
begin
  perform public.require_login();
  if p_type not in ('in', 'out') then raise exception 'Loại phiếu không hợp lệ'; end if;
  return public._move_stock(p_product_id, p_type, p_quantity, p_reason, null, null);
end $$;

revoke execute on function public.save_product(uuid, text, text, text, text, bigint, numeric, bigint) from anon;
revoke execute on function public.set_product_active(uuid, boolean) from anon;
revoke execute on function public.record_stock(uuid, text, numeric, text) from anon;

-- ===== 0003_sales.sql =====
-- 0003: hóa đơn bán lẻ, bán + trừ kho trong một giao dịch

create sequence public.sale_code_seq;

create table public.sales (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  subtotal bigint not null check (subtotal >= 0),
  discount bigint not null default 0 check (discount >= 0 and discount <= subtotal),
  total bigint not null check (total = subtotal - discount),
  payment_method text not null check (payment_method in ('cash', 'transfer')),
  created_by uuid references auth.users (id) default auth.uid(),
  created_at timestamptz not null default now()
);
create index on public.sales (created_at);

create table public.sale_items (
  id uuid primary key default gen_random_uuid(),
  sale_id uuid not null references public.sales (id) on delete cascade,
  product_id uuid not null references public.products (id),
  product_name text not null,
  unit text not null,
  quantity numeric not null check (quantity > 0),
  unit_price bigint not null check (unit_price >= 0),
  line_total bigint not null check (line_total >= 0)
);
create index on public.sale_items (sale_id);

create table public.sale_item_costs (
  sale_item_id uuid primary key references public.sale_items (id) on delete cascade,
  unit_cost bigint not null check (unit_cost >= 0)
);

alter table public.stock_movements
  add constraint stock_movements_sale_fk foreign key (sale_id) references public.sales (id);

alter table public.sales enable row level security;
alter table public.sale_items enable row level security;
alter table public.sale_item_costs enable row level security;
revoke all on public.sales, public.sale_items, public.sale_item_costs from anon, authenticated;
revoke all on sequence public.sale_code_seq from anon, authenticated;
grant select on public.sales, public.sale_items, public.sale_item_costs to authenticated;
create policy sales_read on public.sales for select to authenticated using (public.is_member());
create policy sale_items_read on public.sale_items for select to authenticated using (public.is_member());
create policy sale_costs_owner_read on public.sale_item_costs for select to authenticated using (public.is_owner());

-- p_items: [{"product_id": "...", "quantity": 2}, ...]
create function public.create_sale(p_items jsonb, p_discount bigint, p_payment_method text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_line record;
  v_prod record;
  v_stock numeric;
  v_subtotal bigint := 0;
  v_sale_id uuid;
  v_code text;
  v_item_id uuid;
  v_lines jsonb := '[]'::jsonb;
  v_l jsonb;
begin
  perform public.require_login();
  if p_payment_method is null or p_payment_method not in ('cash', 'transfer') then
    raise exception 'Hình thức thanh toán không hợp lệ';
  end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'Giỏ hàng trống';
  end if;
  if exists (select 1 from jsonb_array_elements(p_items) e
              where (e ->> 'quantity') is null or (e ->> 'quantity')::numeric <= 0) then
    raise exception 'Số lượng phải lớn hơn 0';
  end if;

  -- Gộp món trùng, khóa theo thứ tự id để hai người bán cùng lúc không kẹt nhau
  for v_line in
    select (e ->> 'product_id')::uuid as product_id, sum((e ->> 'quantity')::numeric) as quantity
      from jsonb_array_elements(p_items) e group by 1 order by 1
  loop
    select p.id, p.name, p.unit, p.sale_price, p.active, coalesce(c.cost_price, 0) as cost
      into v_prod
      from products p left join product_costs c on c.product_id = p.id
     where p.id = v_line.product_id
       for update of p;
    if v_prod.id is null then raise exception 'Không tìm thấy hàng hóa'; end if;
    if not v_prod.active then raise exception 'Món đã ngừng bán: %', v_prod.name; end if;
    select coalesce(sum(case type when 'in' then quantity else -quantity end), 0) into v_stock
      from stock_movements where product_id = v_prod.id;
    if v_stock < v_line.quantity then
      raise exception 'Không đủ tồn kho: % (còn %, cần %)', v_prod.name, trim_scale(v_stock), trim_scale(v_line.quantity);
    end if;
    v_l := jsonb_build_object('product_id', v_prod.id, 'name', v_prod.name, 'unit', v_prod.unit,
      'quantity', v_line.quantity, 'price', v_prod.sale_price, 'cost', v_prod.cost,
      'total', round(v_line.quantity * v_prod.sale_price)::bigint);
    v_lines := v_lines || v_l;
    v_subtotal := v_subtotal + (v_l ->> 'total')::bigint;
  end loop;

  if p_discount is null or p_discount < 0 or p_discount > v_subtotal then
    raise exception 'Giảm giá phải từ 0 đến tổng tiền hàng';
  end if;

  v_code := 'HD' || lpad(nextval('sale_code_seq')::text, 6, '0');
  insert into sales (code, subtotal, discount, total, payment_method, created_by)
  values (v_code, v_subtotal, p_discount, v_subtotal - p_discount, p_payment_method, auth.uid())
  returning id into v_sale_id;

  for v_l in select * from jsonb_array_elements(v_lines) loop
    insert into sale_items (sale_id, product_id, product_name, unit, quantity, unit_price, line_total)
    values (v_sale_id, (v_l ->> 'product_id')::uuid, v_l ->> 'name', v_l ->> 'unit',
            (v_l ->> 'quantity')::numeric, (v_l ->> 'price')::bigint, (v_l ->> 'total')::bigint)
    returning id into v_item_id;
    insert into sale_item_costs (sale_item_id, unit_cost) values (v_item_id, (v_l ->> 'cost')::bigint);
    perform public._move_stock((v_l ->> 'product_id')::uuid, 'out', (v_l ->> 'quantity')::numeric,
                               'Bán hàng ' || v_code, v_sale_id, null);
  end loop;

  return jsonb_build_object('id', v_sale_id, 'code', v_code, 'total', v_subtotal - p_discount);
end $$;
revoke execute on function public.create_sale(jsonb, bigint, text) from anon;

-- ===== 0004_orders.sql =====
-- 0004: đơn nội thất làm theo đơn

create sequence public.order_code_seq;

create table public.interior_orders (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  customer_name text not null check (btrim(customer_name) <> ''),
  phone text not null default '',
  address text not null default '',
  total_value bigint not null check (total_value >= 0),
  status text not null default 'design_confirmed'
    check (status in ('design_confirmed', 'production', 'installation', 'completed')),
  note text,
  created_by uuid references auth.users (id) default auth.uid(),
  created_at timestamptz not null default now()
);

create table public.order_payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.interior_orders (id) on delete cascade,
  label text not null check (btrim(label) <> ''),
  amount bigint not null check (amount > 0),
  paid boolean not null default false,
  paid_at date,
  sort int not null default 0,
  check (paid = (paid_at is not null))
);
create index on public.order_payments (order_id);

alter table public.stock_movements
  add constraint stock_movements_order_fk foreign key (order_id) references public.interior_orders (id);

alter table public.interior_orders enable row level security;
alter table public.order_payments enable row level security;
revoke all on public.interior_orders, public.order_payments from anon, authenticated;
revoke all on sequence public.order_code_seq from anon, authenticated;
grant select on public.interior_orders, public.order_payments to authenticated;
create policy orders_read on public.interior_orders for select to authenticated using (public.is_member());
create policy payments_read on public.order_payments for select to authenticated using (public.is_member());

create view public.order_balances with (security_invoker = true) as
  select o.id as order_id,
         coalesce(sum(p.amount) filter (where p.paid), 0)::bigint as paid_total,
         (o.total_value - coalesce(sum(p.amount) filter (where p.paid), 0))::bigint as remaining,
         coalesce(sum(p.amount), 0)::bigint as scheduled_total
    from public.interior_orders o
    left join public.order_payments p on p.order_id = o.id
   group by o.id;
revoke all on public.order_balances from anon;
grant select on public.order_balances to authenticated;

-- p_payments: [{"label": "Cọc", "amount": 15000000}, ...]
create function public.create_order(
  p_customer_name text, p_phone text, p_address text, p_total_value bigint, p_payments jsonb
) returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_sum bigint;
begin
  perform public.require_login();
  if p_payments is null or jsonb_typeof(p_payments) <> 'array' or jsonb_array_length(p_payments) = 0 then
    raise exception 'Cần ít nhất một đợt thanh toán';
  end if;
  select coalesce(sum((e ->> 'amount')::bigint), 0) into v_sum from jsonb_array_elements(p_payments) e;
  if v_sum <> p_total_value then
    raise exception 'Tổng các đợt (%) phải bằng giá trị đơn (%)', v_sum, p_total_value;
  end if;
  insert into interior_orders (code, customer_name, phone, address, total_value, created_by)
  values ('DH' || lpad(nextval('order_code_seq')::text, 6, '0'), btrim(p_customer_name),
          coalesce(btrim(p_phone), ''), coalesce(btrim(p_address), ''), p_total_value, auth.uid())
  returning id into v_id;
  insert into order_payments (order_id, label, amount, sort)
  select v_id, btrim(e.value ->> 'label'), (e.value ->> 'amount')::bigint, e.ordinality
    from jsonb_array_elements(p_payments) with ordinality e;
  return v_id;
end $$;

-- Sửa thông tin khách / giá trị đơn (không kiểm tổng các đợt; giao diện cảnh báo nếu lệch)
create function public.update_order(
  p_order_id uuid, p_customer_name text, p_phone text, p_address text, p_total_value bigint, p_note text
) returns void language plpgsql security definer set search_path = public as $$
begin
  perform public.require_login();
  update interior_orders set customer_name = btrim(p_customer_name), phone = coalesce(btrim(p_phone), ''),
         address = coalesce(btrim(p_address), ''), total_value = p_total_value, note = p_note
   where id = p_order_id;
  if not found then raise exception 'Không tìm thấy đơn'; end if;
end $$;

create function public.save_payment(p_id uuid, p_order_id uuid, p_label text, p_amount bigint)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  perform public.require_login();
  if p_id is null then
    insert into order_payments (order_id, label, amount, sort)
    values (p_order_id, btrim(p_label), p_amount,
            (select coalesce(max(sort), 0) + 1 from order_payments where order_id = p_order_id))
    returning id into v_id;
  else
    update order_payments set label = btrim(p_label), amount = p_amount
     where id = p_id and not paid returning id into v_id;
    if v_id is null then raise exception 'Không sửa được đợt đã thu (bỏ đánh dấu đã thu trước)'; end if;
  end if;
  return v_id;
end $$;

create function public.delete_payment(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform public.require_login();
  delete from order_payments where id = p_id and not paid;
  if not found then raise exception 'Không xóa được đợt đã thu (bỏ đánh dấu đã thu trước)'; end if;
end $$;

create function public.set_payment_paid(p_payment_id uuid, p_paid boolean, p_paid_at date)
returns void language plpgsql security definer set search_path = public as $$
declare v_order uuid; v_total bigint; v_paid bigint;
begin
  perform public.require_login();
  select order_id into v_order from order_payments where id = p_payment_id;
  if v_order is null then raise exception 'Không tìm thấy đợt thanh toán'; end if;
  select total_value into v_total from interior_orders where id = v_order for update;
  update order_payments
     set paid = p_paid, paid_at = case when p_paid then coalesce(p_paid_at, current_date) end
   where id = p_payment_id;
  select coalesce(sum(amount), 0) into v_paid from order_payments where order_id = v_order and paid;
  if v_paid > v_total then
    raise exception 'Số đã thu vượt giá trị đơn. Sửa số tiền các đợt hoặc giá trị đơn trước.';
  end if;
end $$;

create function public.set_order_status(p_order_id uuid, p_status text) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform public.require_login();
  update interior_orders set status = p_status where id = p_order_id;
  if not found then raise exception 'Không tìm thấy đơn'; end if;
end $$;

create function public.add_order_material(p_order_id uuid, p_product_id uuid, p_quantity numeric)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_code text;
begin
  perform public.require_login();
  select code into v_code from interior_orders where id = p_order_id;
  if v_code is null then raise exception 'Không tìm thấy đơn'; end if;
  return public._move_stock(p_product_id, 'out', p_quantity, 'Vật tư đơn ' || v_code, null, p_order_id);
end $$;

revoke execute on function public.create_order(text, text, text, bigint, jsonb) from anon;
revoke execute on function public.update_order(uuid, text, text, text, bigint, text) from anon;
revoke execute on function public.save_payment(uuid, uuid, text, bigint) from anon;
revoke execute on function public.delete_payment(uuid) from anon;
revoke execute on function public.set_payment_paid(uuid, boolean, date) from anon;
revoke execute on function public.set_order_status(uuid, text) from anon;
revoke execute on function public.add_order_material(uuid, uuid, numeric) from anon;

-- ===== 0005_reports.sql =====
-- 0005: báo cáo (chỉ chủ) và xuất toàn bộ dữ liệu. Tính trực tiếp từ hóa đơn/đơn, không lưu bảng tổng.

create function public.vn_date(ts timestamptz) returns date
language sql immutable as $$ select (ts at time zone 'Asia/Ho_Chi_Minh')::date $$;

create function public.report_revenue(p_from date, p_to date, p_group text)
returns table (period date, invoices int, revenue bigint, cost bigint, profit bigint, order_collected bigint)
language plpgsql stable security definer set search_path = public as $$
begin
  perform public.require_owner();
  if p_group not in ('day', 'month') then raise exception 'Kiểu gộp không hợp lệ'; end if;
  return query
  with s as (
    select date_trunc(p_group, vn_date(sa.created_at))::date as period,
           count(*)::int as invoices,
           sum(sa.total)::bigint as revenue,
           sum((select coalesce(sum(round(i.quantity * c.unit_cost)), 0)
                  from sale_items i join sale_item_costs c on c.sale_item_id = i.id
                 where i.sale_id = sa.id))::bigint as cost
      from sales sa
     where vn_date(sa.created_at) between p_from and p_to
     group by 1
  ), o as (
    select date_trunc(p_group, op.paid_at)::date as period, sum(op.amount)::bigint as collected
      from order_payments op
     where op.paid and op.paid_at between p_from and p_to
     group by 1
  )
  select coalesce(s.period, o.period), coalesce(s.invoices, 0), coalesce(s.revenue, 0)::bigint,
         coalesce(s.cost, 0)::bigint, (coalesce(s.revenue, 0) - coalesce(s.cost, 0))::bigint,
         coalesce(o.collected, 0)::bigint
    from s full join o on o.period = s.period
   order by 1;
end $$;

create function public.report_top_products(p_from date, p_to date, p_limit int)
returns table (product_id uuid, name text, quantity numeric, revenue bigint)
language plpgsql stable security definer set search_path = public as $$
begin
  perform public.require_owner();
  return query
  select i.product_id, max(i.product_name), sum(i.quantity), sum(i.line_total)::bigint
    from sale_items i join sales sa on sa.id = i.sale_id
   where vn_date(sa.created_at) between p_from and p_to
   group by i.product_id
   order by 3 desc, 4 desc
   limit coalesce(p_limit, 10);
end $$;

create function public.report_low_stock()
returns table (product_id uuid, code text, name text, unit text, stock numeric, threshold numeric)
language plpgsql stable security definer set search_path = public as $$
begin
  perform public.require_owner();
  return query
  select p.id, p.code, p.name, p.unit, s.stock, p.low_stock_threshold
    from products p join product_stock s on s.product_id = p.id
   where p.active and s.is_low
   order by s.stock, p.name;
end $$;

create function public.report_order_debts()
returns table (order_id uuid, code text, customer_name text, phone text, status text, total_value bigint, paid_total bigint, remaining bigint)
language plpgsql stable security definer set search_path = public as $$
begin
  perform public.require_owner();
  return query
  select o.id, o.code, o.customer_name, o.phone, o.status, o.total_value, b.paid_total, b.remaining
    from interior_orders o join order_balances b on b.order_id = o.id
   where b.remaining > 0
   order by b.remaining desc;
end $$;

-- Sao lưu: mỗi bảng một mảng, tên cột tiếng Việt không dấu để mở Excel dễ đọc
create function public.export_all() returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  perform public.require_owner();
  return jsonb_build_object(
    'hang_hoa', (select coalesce(jsonb_agg(x order by x.ma), '[]') from (
      select p.code as ma, p.name as ten, case p.kind when 'goods' then 'Hàng có sẵn' else 'Vật tư' end as loai,
             p.unit as don_vi, p.sale_price as gia_ban, c.cost_price as gia_von, s.stock as ton_kho,
             p.low_stock_threshold as muc_canh_bao, p.active as dang_ban
        from products p left join product_costs c on c.product_id = p.id join product_stock s on s.product_id = p.id) x),
    'phieu_kho', (select coalesce(jsonb_agg(x order by x.thoi_gian), '[]') from (
      select m.created_at as thoi_gian, p.code as ma_hang, p.name as ten_hang,
             case m.type when 'in' then 'Nhập' else 'Xuất' end as loai, m.quantity as so_luong, m.reason as ly_do,
             pr.full_name as nguoi_tao
        from stock_movements m join products p on p.id = m.product_id left join profiles pr on pr.id = m.created_by) x),
    'hoa_don', (select coalesce(jsonb_agg(x order by x.ma), '[]') from (
      select sa.code as ma, sa.created_at as thoi_gian, sa.subtotal as tien_hang, sa.discount as giam_gia, sa.total as tong,
             case sa.payment_method when 'cash' then 'Tiền mặt' else 'Chuyển khoản' end as thanh_toan, pr.full_name as nguoi_ban
        from sales sa left join profiles pr on pr.id = sa.created_by) x),
    'dong_hoa_don', (select coalesce(jsonb_agg(x order by x.ma_hoa_don), '[]') from (
      select sa.code as ma_hoa_don, i.product_name as ten_hang, i.unit as don_vi, i.quantity as so_luong,
             i.unit_price as don_gia, i.line_total as thanh_tien, c.unit_cost as gia_von
        from sale_items i join sales sa on sa.id = i.sale_id left join sale_item_costs c on c.sale_item_id = i.id) x),
    'don_noi_that', (select coalesce(jsonb_agg(x order by x.ma), '[]') from (
      select o.code as ma, o.created_at as ngay_tao, o.customer_name as khach, o.phone as dien_thoai, o.address as dia_chi,
             o.total_value as gia_tri, b.paid_total as da_thu, b.remaining as con_no, o.status as tien_do, o.note as ghi_chu
        from interior_orders o join order_balances b on b.order_id = o.id) x),
    'dot_thanh_toan', (select coalesce(jsonb_agg(x order by x.ma_don, x.thu_tu), '[]') from (
      select o.code as ma_don, p.sort as thu_tu, p.label as dot, p.amount as so_tien, p.paid as da_thu, p.paid_at as ngay_thu
        from order_payments p join interior_orders o on o.id = p.order_id) x),
    'nguoi_dung', (select coalesce(jsonb_agg(x), '[]') from (
      select full_name as ten, case role when 'owner' then 'Chủ' else 'Nhân viên' end as vai_tro, created_at as ngay_tao from profiles) x)
  );
end $$;

revoke execute on function public.report_revenue(date, date, text) from anon;
revoke execute on function public.report_top_products(date, date, int) from anon;
revoke execute on function public.report_low_stock() from anon;
revoke execute on function public.report_order_debts() from anon;
revoke execute on function public.export_all() from anon;

-- ===== 0006_orders_v2.sql =====
-- 0006: Đơn nội thất kiểu mới (theo Sổ Nội Thất): khách hàng, báo giá nháp/bản chốt, lịch thanh toán, phiếu thu, nhật ký.
-- Thay thế hoàn toàn mô hình đơn của bản đầu (interior_orders).

-- ---------- gỡ mô hình cũ ----------
drop function if exists public.report_order_debts();
drop function if exists public.report_revenue(date, date, text);
drop function if exists public.export_all();
drop function if exists public.create_order(text, text, text, bigint, jsonb);
drop function if exists public.update_order(uuid, text, text, text, bigint, text);
drop function if exists public.save_payment(uuid, uuid, text, bigint);
drop function if exists public.delete_payment(uuid);
drop function if exists public.set_payment_paid(uuid, boolean, date);
drop function if exists public.set_order_status(uuid, text);
drop function if exists public.add_order_material(uuid, uuid, numeric);
drop view if exists public.order_balances;
alter table public.stock_movements drop constraint if exists stock_movements_order_fk;
drop table if exists public.order_payments;
drop table if exists public.interior_orders;
drop sequence if exists public.order_code_seq;

-- Xóa tài khoản nhân viên cũ không được làm kẹt hay mất chứng từ: chỉ để trống người làm.
alter table public.sales drop constraint sales_created_by_fkey,
  add constraint sales_created_by_fkey foreign key (created_by) references auth.users (id) on delete set null;
alter table public.stock_movements drop constraint stock_movements_created_by_fkey,
  add constraint stock_movements_created_by_fkey foreign key (created_by) references auth.users (id) on delete set null;

-- ---------- tiện ích ----------
create function public.vn_today() returns date language sql stable as $$
  select (now() at time zone 'Asia/Ho_Chi_Minh')::date
$$;
create function public.fmt_vnd(n bigint) returns text language sql immutable as $$
  select replace(to_char(n, 'FM999,999,999,999,999,990'), ',', '.') || ' đ'
$$;
create function public.fmt_date(d date) returns text language sql immutable as $$
  select to_char(d, 'DD/MM/YYYY')
$$;

-- ---------- cài đặt mới ----------
alter table public.store_settings
  add column tagline text not null default 'Thiết kế – thi công nội thất trọn gói',
  add column email text not null default '',
  add column logo text,
  add column bank_name text not null default '',
  add column bank_bin text not null default '',
  add column bank_account text not null default '',
  add column bank_holder text not null default '',
  add column memo_prefix text not null default 'HL',
  add column default_note text not null default '',
  add column default_terms text not null default '',
  add column code_prefix text not null default 'BG',
  add column warranty_months int not null default 36 check (warranty_months >= 0),
  add column plan_template jsonb,
  add column follow_days int not null default 3 check (follow_days >= 0),
  add column cash_start_date date,
  add column cash_start_amount bigint not null default 0;
grant update (tagline, email, logo, bank_name, bank_bin, bank_account, bank_holder, memo_prefix, default_note, default_terms,
              code_prefix, warranty_months, plan_template, follow_days, cash_start_date, cash_start_amount)
  on public.store_settings to authenticated;

-- ---------- bảng ----------
create table public.customers (
  id uuid primary key default gen_random_uuid(),
  name text not null check (btrim(name) <> ''),
  phone text not null default '',
  phone_digits text generated always as (regexp_replace(phone, '\D', '', 'g')) stored,
  address text not null default '',
  note text not null default '',
  created_at timestamptz not null default now()
);
create unique index customers_phone_uq on public.customers (phone_digits) where phone_digits <> '';

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  customer_id uuid references public.customers (id),
  -- chép từ báo giá hiện hành để liệt kê/tìm nhanh
  customer_name text not null default '',
  customer_phone text not null default '',
  project text not null default '',
  quote_date date,
  total bigint not null default 0,
  status text not null default 'quote' check (status in ('quote', 'closed', 'building', 'done')),
  closed_at date,
  follow_at date,
  plan jsonb not null default '[]'::jsonb,
  pay_due date,                           -- đơn không chia đợt: ngày hẹn trả khoản duy nhất
  handover jsonb,
  rev int not null default 1,
  created_by uuid references auth.users (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.orders (status);

create table public.order_quotes (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  version_no int,                         -- null = bản nháp đang soạn
  quote jsonb not null,
  sub bigint, disc bigint, total bigint,  -- chỉ có ở bản đã chốt, do máy chủ tính
  closed_at date,
  sign jsonb,
  created_at timestamptz not null default now()
);
create unique index order_quotes_one_draft on public.order_quotes (order_id) where version_no is null;
create unique index order_quotes_version on public.order_quotes (order_id, version_no) where version_no is not null;

create table public.order_payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id),
  no int not null,
  amount bigint not null check (amount > 0),
  date date not null,
  method text not null check (method in ('transfer', 'cash')),
  note text not null default '',
  deposit boolean not null default false,
  created_by uuid references auth.users (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  unique (order_id, no)
);
create index on public.order_payments (date);

create table public.order_log (
  id bigint generated always as identity primary key,
  order_id uuid not null references public.orders (id) on delete cascade,
  at timestamptz not null default clock_timestamp(),
  by uuid references auth.users (id) on delete set null,
  text text not null
);
create index on public.order_log (order_id);

alter table public.stock_movements
  add constraint stock_movements_order_fk foreign key (order_id) references public.orders (id);

-- ---------- quyền: thành viên đọc, ghi chỉ qua hàm ----------
do $$
declare t text;
begin
  foreach t in array array['customers', 'orders', 'order_quotes', 'order_payments', 'order_log'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon, authenticated', t);
    execute format('grant select on public.%I to authenticated', t);
    execute format('create policy %I on public.%I for select to authenticated using (public.is_member())', t || '_read', t);
  end loop;
end $$;

-- ---------- tính tiền báo giá (quy tắc 5.1–5.2) ----------
create function public.quote_totals(q jsonb) returns table (sub bigint, disc bigint, total bigint)
language plpgsql immutable as $$
declare v_sub bigint; v_disc bigint; v_val numeric;
begin
  select coalesce(sum(round(coalesce((r ->> 'qty')::numeric, 0) * coalesce((r ->> 'price')::numeric, 0))), 0)::bigint
    into v_sub from jsonb_array_elements(coalesce(q -> 'rows', '[]'::jsonb)) r;
  v_val := coalesce((q -> 'discount' ->> 'value')::numeric, 0);
  if q -> 'discount' ->> 'type' = 'percent' then
    v_disc := round(v_sub * least(greatest(v_val, 0), 100) / 100);
  else
    v_disc := least(greatest(round(v_val), 0), v_sub);
  end if;
  return query select v_sub, v_disc, v_sub - v_disc;
end $$;

-- Số tiền đợt cuối theo lịch (phần còn lại sau các đợt trước). Lịch < 2 đợt: trả về total.
create function public.plan_last_amount(p_plan jsonb, p_total bigint) returns bigint
language sql immutable as $$
  select case when jsonb_array_length(coalesce(p_plan, '[]'::jsonb)) < 2 then p_total else
    p_total - coalesce((
      select sum(case when coalesce((e.value ->> 'fixed')::boolean, false)
                      then round(coalesce((e.value ->> 'amt')::numeric, 0))
                      else round(p_total * coalesce((e.value ->> 'pct')::numeric, 0) / 100) end)
        from jsonb_array_elements(p_plan) with ordinality e
       where e.ordinality < jsonb_array_length(p_plan)), 0)::bigint end
$$;

create function public._check_quote(q jsonb) returns void language plpgsql immutable as $$
declare r jsonb;
begin
  if q is null or jsonb_typeof(q) <> 'object' then raise exception 'Báo giá không hợp lệ'; end if;
  if octet_length(q::text) > 400000 then raise exception 'Báo giá quá dài'; end if;
  if btrim(coalesce(q -> 'customer' ->> 'name', '')) = '' then raise exception 'Chưa nhập tên khách'; end if;
  if jsonb_typeof(coalesce(q -> 'rows', '[]'::jsonb)) <> 'array' then raise exception 'Báo giá không hợp lệ'; end if;
  for r in select * from jsonb_array_elements(coalesce(q -> 'rows', '[]'::jsonb)) loop
    if coalesce(r ->> 'unit', '') not in ('m²', 'md', 'bộ', 'cái', 'gói', 'cánh', 'điểm', 'công') then
      raise exception 'Đơn vị không hợp lệ: %', coalesce(r ->> 'unit', '(trống)');
    end if;
    if coalesce((r ->> 'qty')::numeric, 0) < 0 or coalesce((r ->> 'price')::numeric, 0) < 0 then
      raise exception 'Số lượng và đơn giá không được âm';
    end if;
  end loop;
  if coalesce(q -> 'discount' ->> 'type', 'amount') not in ('percent', 'amount')
     or coalesce((q -> 'discount' ->> 'value')::numeric, 0) < 0 then
    raise exception 'Giảm giá không hợp lệ';
  end if;
  for r in select * from jsonb_array_elements(coalesce(q -> 'plan', '[]'::jsonb)) loop
    if coalesce(r ->> 'trigger', '') not in ('sign', 'progress', 'accept', 'date') then raise exception 'Mốc thanh toán không hợp lệ'; end if;
    if coalesce((r ->> 'pct')::numeric, 0) < 0 or coalesce((r ->> 'pct')::numeric, 0) > 100 then raise exception 'Phần trăm đợt phải từ 0 đến 100'; end if;
  end loop;
end $$;

create function public._log(p_order_id uuid, p_text text) returns void
language sql security definer set search_path = public as $$
  insert into order_log (order_id, by, text) values (p_order_id, auth.uid(), p_text)
$$;

-- Tạo/cập nhật khách theo SĐT (hoặc theo tên nếu không có SĐT). Trả về id khách.
create function public._upsert_customer(p_name text, p_phone text, p_address text) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_digits text := regexp_replace(coalesce(p_phone, ''), '\D', '', 'g');
begin
  if v_digits <> '' then
    select id into v_id from customers where phone_digits = v_digits;
  else
    select id into v_id from customers where phone_digits = '' and lower(name) = lower(btrim(p_name)) limit 1;
  end if;
  if v_id is null then
    insert into customers (name, phone, address) values (btrim(p_name), btrim(coalesce(p_phone, '')), btrim(coalesce(p_address, '')))
    returning id into v_id;
  else
    update customers set name = btrim(p_name),
           address = case when btrim(coalesce(p_address, '')) <> '' then btrim(p_address) else address end
     where id = v_id;
  end if;
  return v_id;
end $$;

-- Mã đơn kế tiếp: <tiền tố><yy><mm>-<NN>, không trùng khi hai người cùng tạo.
create function public._next_order_code() returns text
language plpgsql security definer set search_path = public as $$
declare v_pre text; v_stem text; v_max int;
begin
  select coalesce(nullif(left(regexp_replace(code_prefix, '[^A-Za-z0-9-]', '', 'g'), 6), ''), 'BG') into v_pre from store_settings;
  v_stem := v_pre || to_char(vn_today(), 'YYMM') || '-';
  perform pg_advisory_xact_lock(hashtext('order_code:' || v_stem));
  select coalesce(max(nullif(regexp_replace(substr(code, length(v_stem) + 1), '\D', '', 'g'), '')::int), 0) into v_max
    from orders where code like v_stem || '%';
  return v_stem || lpad((v_max + 1)::text, 2, '0');
end $$;

create function public._sync_order_head(p_order_id uuid, q jsonb, p_customer_id uuid) returns void
language sql security definer set search_path = public as $$
  update orders set customer_id = coalesce(p_customer_id, customer_id),
         customer_name = btrim(q -> 'customer' ->> 'name'),
         customer_phone = btrim(coalesce(q -> 'customer' ->> 'phone', '')),
         project = btrim(coalesce(q ->> 'project', '')),
         quote_date = nullif(q ->> 'date', '')::date,
         total = (select t.total from quote_totals(q) t),
         updated_at = now()
   where id = p_order_id
$$;

-- ---------- lưu báo giá nháp ----------
create function public.save_quote_draft(p_order_id uuid, p_quote jsonb, p_rev int) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_order orders; v_code text; v_cust uuid; v_draft uuid;
begin
  perform public.require_login();
  perform public._check_quote(p_quote);
  v_cust := public._upsert_customer(p_quote -> 'customer' ->> 'name', p_quote -> 'customer' ->> 'phone', p_quote -> 'customer' ->> 'address');

  if p_order_id is null then
    v_code := public._next_order_code();
    insert into orders (code, created_by) values (v_code, auth.uid()) returning * into v_order;
    insert into order_quotes (order_id, quote) values (v_order.id, p_quote);
    perform public._sync_order_head(v_order.id, p_quote, v_cust);
    perform public._log(v_order.id, 'Tạo báo giá ' || v_code);
    return jsonb_build_object('order_id', v_order.id, 'code', v_code, 'rev', 1);
  end if;

  select * into v_order from orders where id = p_order_id for update;
  if v_order.id is null then raise exception 'Không tìm thấy đơn'; end if;
  if p_rev is distinct from v_order.rev then raise exception 'Báo giá vừa được người khác sửa, hãy tải lại'; end if;
  select id into v_draft from order_quotes where order_id = p_order_id and version_no is null;
  if v_draft is null then
    raise exception 'Đơn đã chốt. Bấm "Sửa báo giá" để tạo bản mới';
  end if;
  update order_quotes set quote = p_quote where id = v_draft;
  -- đơn đã chốt đang soạn bản sửa: thông tin đầu đơn vẫn theo bản chốt cho tới khi chốt bản mới
  if v_order.status = 'quote' then perform public._sync_order_head(p_order_id, p_quote, v_cust); end if;
  update orders set rev = rev + 1, updated_at = now() where id = p_order_id;
  return jsonb_build_object('order_id', p_order_id, 'code', v_order.code, 'rev', v_order.rev + 1);
end $$;

-- ---------- phiếu thu ----------
create function public._add_payment(p_order_id uuid, p_amount bigint, p_date date, p_method text, p_note text, p_deposit boolean)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_no int; v_id uuid; v_date date := coalesce(p_date, vn_today());
begin
  if p_amount is null or p_amount <= 0 then raise exception 'Số tiền phải lớn hơn 0'; end if;
  if p_method is null or p_method not in ('transfer', 'cash') then raise exception 'Hình thức thanh toán không hợp lệ'; end if;
  select coalesce(max(no), 0) + 1 into v_no from order_payments where order_id = p_order_id;
  insert into order_payments (order_id, no, amount, date, method, note, deposit, created_by)
  values (p_order_id, v_no, p_amount, v_date, p_method, btrim(coalesce(p_note, '')), coalesce(p_deposit, false), auth.uid())
  returning id into v_id;
  perform public._log(p_order_id, case when coalesce(p_deposit, false)
    then 'Ghi nhận đặt cọc ' || fmt_vnd(p_amount) || ' (' || case p_method when 'cash' then 'Tiền mặt' else 'Chuyển khoản' end || ')'
    else 'Thu ' || fmt_vnd(p_amount) || ' ngày ' || fmt_date(v_date) || ' (' || case p_method when 'cash' then 'Tiền mặt' else 'Chuyển khoản' end || ')'
         || case when btrim(coalesce(p_note, '')) <> '' then ' – ' || btrim(p_note) else '' end end);
  return jsonb_build_object('id', v_id, 'no', v_no);
end $$;

create function public.add_payment(p_order_id uuid, p_amount bigint, p_date date, p_method text, p_note text, p_deposit boolean)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_status text;
begin
  perform public.require_login();
  select status into v_status from orders where id = p_order_id for update;
  if v_status is null then raise exception 'Không tìm thấy đơn'; end if;
  if v_status = 'quote' then raise exception 'Đơn chưa chốt, chưa thu tiền được'; end if;
  return public._add_payment(p_order_id, p_amount, p_date, p_method, p_note, p_deposit);
end $$;

create function public.delete_payment(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare v_p order_payments;
begin
  perform public.require_owner();
  delete from order_payments where id = p_id returning * into v_p;
  if v_p.id is null then raise exception 'Không tìm thấy phiếu thu'; end if;
  perform public._log(v_p.order_id, 'Xóa phiếu thu số ' || v_p.no || ': ' || fmt_vnd(v_p.amount) || ' ngày ' || fmt_date(v_p.date));
end $$;

-- ---------- chốt đơn / chốt bản sửa ----------
create function public.close_order(p_order_id uuid, p_date date, p_deposit bigint, p_method text, p_sign jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_order orders; v_draft order_quotes; v_q jsonb; v_rows jsonb; v_plan jsonb;
  v_sub bigint; v_disc bigint; v_total bigint; v_no int; v_prev bigint; v_first boolean;
  v_date date := coalesce(p_date, vn_today());
begin
  perform public.require_login();
  select * into v_order from orders where id = p_order_id for update;
  if v_order.id is null then raise exception 'Không tìm thấy đơn'; end if;
  select * into v_draft from order_quotes where order_id = p_order_id and version_no is null;
  if v_draft.id is null then raise exception 'Không có báo giá nháp để chốt'; end if;

  -- bỏ dòng trống
  select coalesce(jsonb_agg(r), '[]'::jsonb) into v_rows
    from jsonb_array_elements(coalesce(v_draft.quote -> 'rows', '[]'::jsonb)) r
   where btrim(coalesce(r ->> 'name', '')) <> '' or round(coalesce((r ->> 'qty')::numeric, 0) * coalesce((r ->> 'price')::numeric, 0)) <> 0;
  if jsonb_array_length(v_rows) = 0 then raise exception 'Báo giá chưa có hạng mục'; end if;
  -- mỗi đợt phải có mã để giữ ngày hẹn qua các bản
  select coalesce(jsonb_agg(case when coalesce(e ->> 'id', '') = '' then e || jsonb_build_object('id', gen_random_uuid()::text) else e end), '[]'::jsonb)
    into v_plan from jsonb_array_elements(coalesce(v_draft.quote -> 'plan', '[]'::jsonb)) e;
  v_q := (v_draft.quote - 'planBak') || jsonb_build_object('rows', v_rows, 'plan', v_plan);
  perform public._check_quote(v_q);
  select t.sub, t.disc, t.total into v_sub, v_disc, v_total from quote_totals(v_q) t;
  if jsonb_array_length(v_plan) >= 2 and public.plan_last_amount(v_plan, v_total) <= 0 then
    raise exception 'Các đợt trước đã chiếm hết giá trị đơn, đợt cuối sẽ bằng 0. Hãy giảm bớt.';
  end if;

  select coalesce(max(version_no), 0) + 1 into v_no from order_quotes where order_id = p_order_id;
  v_first := v_no = 1;
  select total into v_prev from order_quotes where order_id = p_order_id and version_no = v_no - 1;
  update order_quotes set version_no = v_no, quote = v_q, sub = v_sub, disc = v_disc, total = v_total, closed_at = v_date, sign = p_sign
   where id = v_draft.id;

  -- lịch của đơn theo bản vừa chốt; đợt cùng mã giữ lại hạn và cờ "đã tới mốc" đã đặt
  update orders set plan = (
      select coalesce(jsonb_agg(e.value || jsonb_strip_nulls(jsonb_build_object(
               'due', coalesce(nullif(o.value ->> 'due', ''), nullif(e.value ->> 'due', '')),
               'reached', case when coalesce((o.value ->> 'reached')::boolean, false) then true end)) order by e.ordinality), '[]'::jsonb)
        from jsonb_array_elements(v_plan) with ordinality e
        left join jsonb_array_elements(v_order.plan) o on o.value ->> 'id' = e.value ->> 'id'),
    rev = rev + 1
   where id = p_order_id;
  perform public._sync_order_head(p_order_id, v_q,
    public._upsert_customer(v_q -> 'customer' ->> 'name', v_q -> 'customer' ->> 'phone', v_q -> 'customer' ->> 'address'));

  if v_first then
    update orders set status = 'closed', closed_at = v_date where id = p_order_id;
    perform public._log(p_order_id, 'Chốt đơn ngày ' || fmt_date(v_date) || ': ' || fmt_vnd(v_total));
    if coalesce(p_deposit, 0) > 0 then
      perform public._add_payment(p_order_id, p_deposit, v_date, p_method, 'Đặt cọc khi chốt đơn', true);
    end if;
  else
    perform public._log(p_order_id, 'Chốt bản ' || v_no || ' ngày ' || fmt_date(v_date) || ': ' || fmt_vnd(v_prev) || ' → ' || fmt_vnd(v_total));
  end if;
  if p_sign is not null then
    perform public._log(p_order_id, 'Khách ' || coalesce(p_sign ->> 'name', '') || ' ký xác nhận bản ' || v_no || ' (mã ' || coalesce(p_sign ->> 'hash', '') || ')');
  end if;
  return jsonb_build_object('version_no', v_no, 'total', v_total);
end $$;

-- ---------- các thao tác khác trên đơn ----------
create function public.set_order_status(p_order_id uuid, p_status text) returns void
language plpgsql security definer set search_path = public as $$
declare v_old text;
  v_label constant jsonb := '{"quote":"Đang báo giá","closed":"Đã chốt","building":"Đang thi công","done":"Hoàn thành"}';
begin
  perform public.require_login();
  if p_status is null or p_status not in ('closed', 'building', 'done') then raise exception 'Trạng thái không hợp lệ'; end if;
  select status into v_old from orders where id = p_order_id for update;
  if v_old is null then raise exception 'Không tìm thấy đơn'; end if;
  if v_old = 'quote' then raise exception 'Đơn chưa chốt, chưa đổi trạng thái được'; end if;
  if v_old = p_status then return; end if;
  update orders set status = p_status, updated_at = now() where id = p_order_id;
  perform public._log(p_order_id, 'Đổi trạng thái: ' || (v_label ->> v_old) || ' → ' || (v_label ->> p_status));
end $$;

create function public.set_plan_row(p_order_id uuid, p_plan_id text, p_due date, p_reached boolean) returns void
language plpgsql security definer set search_path = public as $$
declare v_n int;
begin
  perform public.require_login();
  if p_plan_id = 'all' then  -- đơn không chia đợt
    update orders set pay_due = p_due, updated_at = now() where id = p_order_id and status <> 'quote' and jsonb_array_length(plan) = 0;
    if not found then raise exception 'Không tìm thấy đợt thanh toán'; end if;
    return;
  end if;
  update orders set plan = (
      select jsonb_agg(case when e.value ->> 'id' = p_plan_id
               then (e.value - 'due' - 'reached') || jsonb_strip_nulls(jsonb_build_object('due', p_due::text, 'reached', case when coalesce(p_reached, false) then true end))
               else e.value end order by e.ordinality)
        from jsonb_array_elements(plan) with ordinality e),
    updated_at = now()
   where id = p_order_id and status <> 'quote'
     and exists (select 1 from jsonb_array_elements(plan) e where e ->> 'id' = p_plan_id);
  get diagnostics v_n = row_count;
  if v_n = 0 then raise exception 'Không tìm thấy đợt thanh toán'; end if;
end $$;

create function public.set_follow_at(p_order_id uuid, p_date date) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform public.require_login();
  update orders set follow_at = p_date, updated_at = now() where id = p_order_id;
  if not found then raise exception 'Không tìm thấy đơn'; end if;
end $$;

create function public.delete_order(p_order_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare v_status text;
begin
  perform public.require_owner();
  select status into v_status from orders where id = p_order_id for update;
  if v_status is null then raise exception 'Không tìm thấy đơn'; end if;
  if v_status <> 'quote' or exists (select 1 from order_payments where order_id = p_order_id) then
    raise exception 'Chỉ xóa được đơn đang báo giá và chưa thu tiền';
  end if;
  delete from orders where id = p_order_id;
end $$;

create function public.add_order_material(p_order_id uuid, p_product_id uuid, p_quantity numeric) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_order orders;
begin
  perform public.require_login();
  select * into v_order from orders where id = p_order_id;
  if v_order.id is null then raise exception 'Không tìm thấy đơn'; end if;
  if v_order.status = 'quote' then raise exception 'Đơn chưa chốt, chưa ghi vật tư được'; end if;
  return public._move_stock(p_product_id, 'out', p_quantity, 'Vật tư đơn ' || v_order.code, null, p_order_id);
end $$;

-- ---------- tổng hợp tiền của đơn cho danh sách và báo cáo ----------
-- (phát sinh được thêm ở 0008; từng đợt tính ở trình duyệt bằng orderMoney)
create view public.order_totals with (security_invoker = true) as
  select o.id as order_id,
         o.total as base,
         0::bigint as changes,
         o.total as total,
         coalesce(p.paid, 0)::bigint as paid,
         case when o.status = 'quote' then 0 else greatest(0, o.total - coalesce(p.paid, 0)) end::bigint as due,
         greatest(0, coalesce(p.paid, 0) - o.total)::bigint as over
    from public.orders o
    left join (select order_id, sum(amount) as paid from public.order_payments group by order_id) p on p.order_id = o.id;
revoke all on public.order_totals from anon;
grant select on public.order_totals to authenticated;

-- hàm nội bộ: không mở cho API
revoke execute on function public._check_quote(jsonb), public._log(uuid, text), public._upsert_customer(text, text, text),
  public._next_order_code(), public._sync_order_head(uuid, jsonb, uuid),
  public._add_payment(uuid, bigint, date, text, text, boolean) from public, anon, authenticated;
revoke execute on function public.save_quote_draft(uuid, jsonb, int), public.close_order(uuid, date, bigint, text, jsonb),
  public.add_payment(uuid, bigint, date, text, text, boolean), public.delete_payment(uuid), public.set_order_status(uuid, text),
  public.set_plan_row(uuid, text, date, boolean), public.set_follow_at(uuid, date), public.delete_order(uuid),
  public.add_order_material(uuid, uuid, numeric) from anon;

-- ===== 0007_reports_v2.sql =====
-- 0007: báo cáo và sao lưu theo mô hình đơn mới (0006)

create function public.report_revenue(p_from date, p_to date, p_group text)
returns table (period date, invoices int, revenue bigint, cost bigint, profit bigint, order_collected bigint)
language plpgsql stable security definer set search_path = public as $$
begin
  perform public.require_owner();
  if p_group not in ('day', 'month') then raise exception 'Kiểu gộp không hợp lệ'; end if;
  return query
  with s as (
    select date_trunc(p_group, vn_date(sa.created_at))::date as period,
           count(*)::int as invoices,
           sum(sa.total)::bigint as revenue,
           sum((select coalesce(sum(round(i.quantity * c.unit_cost)), 0)
                  from sale_items i join sale_item_costs c on c.sale_item_id = i.id
                 where i.sale_id = sa.id))::bigint as cost
      from sales sa
     where vn_date(sa.created_at) between p_from and p_to
     group by 1
  ), o as (
    select date_trunc(p_group, op.date)::date as period, sum(op.amount)::bigint as collected
      from order_payments op
     where op.date between p_from and p_to
     group by 1
  )
  select coalesce(s.period, o.period), coalesce(s.invoices, 0), coalesce(s.revenue, 0)::bigint,
         coalesce(s.cost, 0)::bigint, (coalesce(s.revenue, 0) - coalesce(s.cost, 0))::bigint,
         coalesce(o.collected, 0)::bigint
    from s full join o on o.period = s.period
   order by 1;
end $$;

create function public.report_order_debts()
returns table (order_id uuid, code text, customer_name text, phone text, status text, total_value bigint, paid_total bigint, remaining bigint)
language plpgsql stable security definer set search_path = public as $$
begin
  perform public.require_owner();
  return query
  select o.id, o.code, o.customer_name, o.customer_phone, o.status, t.total, t.paid, t.due
    from orders o join order_totals t on t.order_id = o.id
   where o.status <> 'quote' and t.due > 0
   order by t.due desc;
end $$;

create function public.export_all() returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  perform public.require_owner();
  return jsonb_build_object(
    'hang_hoa', (select coalesce(jsonb_agg(x order by x.ma), '[]') from (
      select p.code as ma, p.name as ten, case p.kind when 'goods' then 'Hàng có sẵn' else 'Vật tư' end as loai,
             p.unit as don_vi, p.sale_price as gia_ban, c.cost_price as gia_von, s.stock as ton_kho,
             p.low_stock_threshold as muc_canh_bao, p.active as dang_ban
        from products p left join product_costs c on c.product_id = p.id join product_stock s on s.product_id = p.id) x),
    'phieu_kho', (select coalesce(jsonb_agg(x order by x.thoi_gian), '[]') from (
      select m.created_at as thoi_gian, p.code as ma_hang, p.name as ten_hang,
             case m.type when 'in' then 'Nhập' else 'Xuất' end as loai, m.quantity as so_luong, m.reason as ly_do,
             pr.full_name as nguoi_tao
        from stock_movements m join products p on p.id = m.product_id left join profiles pr on pr.id = m.created_by) x),
    'hoa_don', (select coalesce(jsonb_agg(x order by x.ma), '[]') from (
      select sa.code as ma, sa.created_at as thoi_gian, sa.subtotal as tien_hang, sa.discount as giam_gia, sa.total as tong,
             case sa.payment_method when 'cash' then 'Tiền mặt' else 'Chuyển khoản' end as thanh_toan, pr.full_name as nguoi_ban
        from sales sa left join profiles pr on pr.id = sa.created_by) x),
    'dong_hoa_don', (select coalesce(jsonb_agg(x order by x.ma_hoa_don), '[]') from (
      select sa.code as ma_hoa_don, i.product_name as ten_hang, i.unit as don_vi, i.quantity as so_luong,
             i.unit_price as don_gia, i.line_total as thanh_tien, c.unit_cost as gia_von
        from sale_items i join sales sa on sa.id = i.sale_id left join sale_item_costs c on c.sale_item_id = i.id) x),
    'khach_hang', (select coalesce(jsonb_agg(x order by x.ten), '[]') from (
      select name as ten, phone as dien_thoai, address as dia_chi, note as ghi_chu, created_at as ngay_tao from customers) x),
    'don_noi_that', (select coalesce(jsonb_agg(x order by x.ma), '[]') from (
      select o.code as ma, o.created_at as ngay_tao, o.customer_name as khach, o.customer_phone as dien_thoai, o.project as cong_trinh,
             case o.status when 'quote' then 'Đang báo giá' when 'closed' then 'Đã chốt' when 'building' then 'Đang thi công' else 'Hoàn thành' end as trang_thai,
             o.closed_at as ngay_chot, t.total as gia_tri, t.paid as da_thu, t.due as con_no,
             (select max(version_no) from order_quotes q where q.order_id = o.id) as so_ban_chot
        from orders o join order_totals t on t.order_id = o.id) x),
    'bao_gia_dong', (select coalesce(jsonb_agg(x order by x.ma_don, x.ban, x.thu_tu), '[]') from (
      select o.code as ma_don, coalesce(q.version_no::text, 'nháp') as ban, r.ordinality as thu_tu,
             r.value ->> 'name' as hang_muc, r.value ->> 'material' as vat_lieu, r.value ->> 'unit' as don_vi,
             (r.value ->> 'qty')::numeric as so_luong, (r.value ->> 'price')::numeric as don_gia,
             round(coalesce((r.value ->> 'qty')::numeric, 0) * coalesce((r.value ->> 'price')::numeric, 0)) as thanh_tien
        from order_quotes q join orders o on o.id = q.order_id,
             jsonb_array_elements(coalesce(q.quote -> 'rows', '[]'::jsonb)) with ordinality r) x),
    'phieu_thu', (select coalesce(jsonb_agg(x order by x.ma_don, x.so), '[]') from (
      select o.code as ma_don, p.no as so, 'PT-' || o.code || '-' || lpad(p.no::text, 2, '0') as so_phieu, p.date as ngay, p.amount as so_tien,
             case p.method when 'cash' then 'Tiền mặt' else 'Chuyển khoản' end as hinh_thuc, p.deposit as dat_coc, p.note as ghi_chu,
             pr.full_name as nguoi_thu
        from order_payments p join orders o on o.id = p.order_id left join profiles pr on pr.id = p.created_by) x),
    'nguoi_dung', (select coalesce(jsonb_agg(x), '[]') from (
      select full_name as ten, case role when 'owner' then 'Chủ' else 'Nhân viên' end as vai_tro, created_at as ngay_tao from profiles) x)
  );
end $$;


revoke execute on function public.report_revenue(date, date, text) from anon;
revoke execute on function public.report_order_debts() from anon;
revoke execute on function public.export_all() from anon;

-- ===== 0008_after_close.sql =====
-- 0008: sau khi chốt — bản sửa, phát sinh, nghiệm thu, ghi chú, ảnh đính kèm

-- ---------- bản sửa ----------
-- Tạo nháp mới từ bản chốt cuối: dòng có mã mới (trả về id_map cũ → mới), lịch = lịch hiện hành của đơn (giữ mã đợt).
create function public.revise_order(p_order_id uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_order orders; v_q jsonb; v_rows jsonb := '[]'::jsonb; v_map jsonb := '{}'::jsonb; v_new text; r jsonb;
begin
  perform public.require_login();
  select * into v_order from orders where id = p_order_id for update;
  if v_order.id is null then raise exception 'Không tìm thấy đơn'; end if;
  if v_order.status = 'quote' then raise exception 'Đơn chưa chốt, cứ sửa báo giá trực tiếp'; end if;
  if exists (select 1 from order_quotes where order_id = p_order_id and version_no is null) then
    raise exception 'Đơn đang có bản sửa chưa chốt';
  end if;
  select quote into v_q from order_quotes where order_id = p_order_id order by version_no desc limit 1;
  for r in select * from jsonb_array_elements(coalesce(v_q -> 'rows', '[]'::jsonb)) loop
    v_new := 'r' || replace(gen_random_uuid()::text, '-', '');
    v_map := v_map || jsonb_build_object(coalesce(r ->> 'id', ''), v_new);
    v_rows := v_rows || jsonb_build_array(r || jsonb_build_object('id', v_new));
  end loop;
  v_q := v_q || jsonb_build_object('rows', v_rows, 'date', vn_today()::text,
    'plan', (select coalesce(jsonb_agg(e - 'due' - 'reached'), '[]'::jsonb) from jsonb_array_elements(v_order.plan) e));
  insert into order_quotes (order_id, quote) values (p_order_id, v_q);
  update orders set rev = rev + 1, updated_at = now() where id = p_order_id;
  perform public._log(p_order_id, 'Tạo bản sửa báo giá (bản ' || ((select max(version_no) from order_quotes where order_id = p_order_id) + 1) || ')');
  return jsonb_build_object('rev', v_order.rev + 1, 'id_map', v_map);
end $$;

-- Hủy bản sửa đang soạn (đơn đã chốt): quay về bản chốt hiện hành.
create function public.discard_revision(p_order_id uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform public.require_login();
  delete from order_quotes q using orders o
   where q.order_id = p_order_id and q.version_no is null and o.id = q.order_id and o.status <> 'quote';
  if not found then raise exception 'Không có bản sửa để hủy'; end if;
  update orders set rev = rev + 1, updated_at = now() where id = p_order_id;
  perform public._log(p_order_id, 'Hủy bản sửa báo giá chưa chốt');
end $$;

-- ---------- phát sinh ----------
create table public.order_changes (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id),
  sign smallint not null check (sign in (1, -1)),
  title text not null check (btrim(title) <> ''),
  amount bigint not null check (amount > 0),
  reason text not null default 'other' check (reason in ('customer', 'site', 'added', 'other')),
  note text not null default '',
  status text not null default 'pending' check (status in ('pending', 'confirmed', 'cancelled')),
  confirmed_at date,
  sign_rec jsonb,
  created_by uuid references auth.users (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);
create index on public.order_changes (order_id);

create table public.order_notes (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  text text not null check (btrim(text) <> ''),
  created_by uuid references auth.users (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);
create index on public.order_notes (order_id);

create table public.order_attachments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  path text not null unique,
  name text not null default '',
  stage text not null default 'other' check (stage in ('survey', 'factory', 'install', 'handover', 'warranty', 'other')),
  created_by uuid references auth.users (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);
create index on public.order_attachments (order_id);

do $$
declare t text;
begin
  foreach t in array array['order_changes', 'order_notes', 'order_attachments'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon, authenticated', t);
    execute format('grant select on public.%I to authenticated', t);
    execute format('create policy %I on public.%I for select to authenticated using (public.is_member())', t || '_read', t);
  end loop;
end $$;

create function public.add_change(p_order_id uuid, p_sign int, p_title text, p_amount bigint, p_reason text, p_note text) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_status text; v_id uuid;
begin
  perform public.require_login();
  select status into v_status from orders where id = p_order_id;
  if v_status is null then raise exception 'Không tìm thấy đơn'; end if;
  if v_status = 'quote' then raise exception 'Đơn chưa chốt, hãy sửa thẳng báo giá'; end if;
  if btrim(coalesce(p_title, '')) = '' then raise exception 'Chưa nhập nội dung phát sinh'; end if;
  if p_amount is null or p_amount <= 0 then raise exception 'Số tiền phải lớn hơn 0'; end if;
  if coalesce(p_reason, '') not in ('customer', 'site', 'added', 'other') then raise exception 'Lý do không hợp lệ'; end if;
  if p_sign not in (1, -1) then raise exception 'Phát sinh phải là tăng hoặc giảm'; end if;
  insert into order_changes (order_id, sign, title, amount, reason, note, created_by)
  values (p_order_id, p_sign, btrim(p_title), p_amount, p_reason, btrim(coalesce(p_note, '')), auth.uid()) returning id into v_id;
  perform public._log(p_order_id, 'Thêm phát sinh ' || case when p_sign < 0 then 'giảm ' else 'tăng ' end || fmt_vnd(p_amount) || ': ' || btrim(p_title) || ' (chờ xác nhận)');
  return v_id;
end $$;

create function public.confirm_change(p_id uuid, p_date date, p_sign jsonb) returns void
language plpgsql security definer set search_path = public as $$
declare c order_changes; v_date date := coalesce(p_date, vn_today());
begin
  perform public.require_login();
  select * into c from order_changes where id = p_id for update;
  if c.id is null then raise exception 'Không tìm thấy phát sinh'; end if;
  if c.status <> 'pending' then raise exception 'Phát sinh đã xác nhận hoặc đã hủy'; end if;
  update order_changes set status = 'confirmed', confirmed_at = v_date, sign_rec = p_sign where id = p_id;
  update orders set updated_at = now() where id = c.order_id;
  perform public._log(c.order_id, 'Xác nhận phát sinh ngày ' || fmt_date(v_date) || ': ' || case when c.sign < 0 then '−' else '+' end || fmt_vnd(c.amount) || ' ' || c.title
    || case when p_sign is not null then ' (khách ' || coalesce(p_sign ->> 'name', '') || ' ký, mã ' || coalesce(p_sign ->> 'hash', '') || ')' else '' end);
end $$;

create function public.cancel_change(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare c order_changes;
begin
  perform public.require_login();
  select * into c from order_changes where id = p_id for update;
  if c.id is null then raise exception 'Không tìm thấy phát sinh'; end if;
  if c.status = 'cancelled' then return; end if;
  if c.status = 'confirmed' and not public.is_owner() then raise exception 'Chỉ chủ cửa hàng được hủy phát sinh đã xác nhận'; end if;
  update order_changes set status = 'cancelled' where id = p_id;
  perform public._log(c.order_id, 'Hủy phát sinh: ' || c.title || ' (' || fmt_vnd(c.amount) || ')');
end $$;

-- ---------- nghiệm thu, bàn giao ----------
create function public.set_handover(p_order_id uuid, p_date date, p_months int, p_note text, p_sign jsonb) returns void
language plpgsql security definer set search_path = public as $$
declare v_status text; v_m int := greatest(coalesce(p_months, 0), 0); v_date date := coalesce(p_date, vn_today());
begin
  perform public.require_login();
  select status into v_status from orders where id = p_order_id for update;
  if v_status is null then raise exception 'Không tìm thấy đơn'; end if;
  if v_status = 'quote' then raise exception 'Đơn chưa chốt, chưa nghiệm thu được'; end if;
  update orders set status = 'done', updated_at = now(),
    handover = jsonb_build_object('date', v_date::text, 'warrantyMonths', v_m, 'warrantyUntil', (v_date + make_interval(months => v_m))::date::text,
                                  'note', btrim(coalesce(p_note, '')), 'sign', p_sign, 'at', now())
   where id = p_order_id;
  perform public._log(p_order_id, 'Nghiệm thu, bàn giao ngày ' || fmt_date(v_date) || case when v_m > 0 then ', bảo hành ' || v_m || ' tháng đến ' || fmt_date((v_date + make_interval(months => v_m))::date) else '' end
    || case when p_sign is not null then ' (khách ' || coalesce(p_sign ->> 'name', '') || ' ký, mã ' || coalesce(p_sign ->> 'hash', '') || ')' else '' end);
end $$;

-- ---------- ghi chú ----------
create function public.add_note(p_order_id uuid, p_text text) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  perform public.require_login();
  if btrim(coalesce(p_text, '')) = '' then raise exception 'Ghi chú trống'; end if;
  insert into order_notes (order_id, text, created_by) values (p_order_id, btrim(p_text), auth.uid()) returning id into v_id;
  return v_id;
end $$;

create function public.delete_note(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare v_by uuid;
begin
  perform public.require_login();
  select created_by into v_by from order_notes where id = p_id;
  if not found then raise exception 'Không tìm thấy ghi chú'; end if;
  if v_by is distinct from auth.uid() and not public.is_owner() then raise exception 'Chỉ người viết hoặc chủ cửa hàng được xóa'; end if;
  delete from order_notes where id = p_id;
end $$;

-- ---------- ảnh đính kèm (file nằm ở Supabase Storage, bucket "don-hang", thư mục = mã đơn nội bộ) ----------
create function public.add_attachment(p_order_id uuid, p_path text, p_name text, p_stage text) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  perform public.require_login();
  if not exists (select 1 from orders where id = p_order_id) then raise exception 'Không tìm thấy đơn'; end if;
  if p_path is null or p_path not like p_order_id::text || '/%' then raise exception 'Đường dẫn ảnh không hợp lệ'; end if;
  if coalesce(p_stage, '') not in ('survey', 'factory', 'install', 'handover', 'warranty', 'other') then raise exception 'Giai đoạn không hợp lệ'; end if;
  insert into order_attachments (order_id, path, name, stage, created_by) values (p_order_id, p_path, coalesce(p_name, ''), p_stage, auth.uid()) returning id into v_id;
  return v_id;
end $$;

-- Trả về đường dẫn file để giao diện xóa tiếp trong Storage.
create function public.delete_attachment(p_id uuid) returns text
language plpgsql security definer set search_path = public as $$
declare a order_attachments;
begin
  perform public.require_login();
  select * into a from order_attachments where id = p_id;
  if a.id is null then raise exception 'Không tìm thấy ảnh'; end if;
  if a.created_by is distinct from auth.uid() and not public.is_owner() then raise exception 'Chỉ người viết hoặc chủ cửa hàng được xóa'; end if;
  delete from order_attachments where id = p_id;
  return a.path;
end $$;

-- ---------- tổng tiền có phát sinh ----------
create or replace view public.order_totals with (security_invoker = true) as
  select o.id as order_id,
         o.total as base,
         coalesce(c.chg, 0)::bigint as changes,
         (o.total + coalesce(c.chg, 0))::bigint as total,
         coalesce(p.paid, 0)::bigint as paid,
         case when o.status = 'quote' then 0 else greatest(0, o.total + coalesce(c.chg, 0) - coalesce(p.paid, 0)) end::bigint as due,
         greatest(0, coalesce(p.paid, 0) - (o.total + coalesce(c.chg, 0)))::bigint as over
    from public.orders o
    left join (select order_id, sum(amount) as paid from public.order_payments group by order_id) p on p.order_id = o.id
    left join (select order_id, sum(sign * amount) as chg from public.order_changes where status = 'confirmed' group by order_id) c on c.order_id = o.id;

revoke execute on function public.revise_order(uuid), public.discard_revision(uuid), public.add_change(uuid, int, text, bigint, text, text),
  public.confirm_change(uuid, date, jsonb), public.cancel_change(uuid), public.set_handover(uuid, date, int, text, jsonb),
  public.add_note(uuid, text), public.delete_note(uuid), public.add_attachment(uuid, text, text, text), public.delete_attachment(uuid) from anon;

-- ===== 0009_books.sql =====
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

-- ===== 0010_import.sql =====
-- 0010: nhập dữ liệu từ Sổ Nội Thất (file sao lưu) + sao lưu Excel có thêm phát sinh, sổ thu chi, danh mục

alter table public.customers add column legacy_id text unique;
alter table public.orders add column legacy_id text unique;
alter table public.order_payments add column legacy_id text unique;
alter table public.order_changes add column legacy_id text unique;

create function public._ts(t text) returns timestamptz language sql immutable as $$
  select case when coalesce(t, '') ~ '^\d{4}-\d{2}-\d{2}' then t::timestamptz end
$$;

-- p: kết quả toImportPayload() (src/lib/importSnt.ts). Nhập lại cùng file không tạo trùng (nhận ra theo legacy_id).
create function public.import_snt(p jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  c jsonb; k jsonb; o jsonb; v jsonb; x jsonb; e jsonb;
  v_id uuid; v_oid uuid; v_cid uuid; v_code text; v_n int; v_head jsonb; v_t record; v_map jsonb;
  n_cust int := 0; e_cust int := 0; n_cat int := 0; e_cat int := 0; n_ord int := 0; e_ord int := 0;
  n_pay int := 0; n_chg int := 0; n_cash int := 0; e_cash int := 0;
  v_renamed jsonb := '[]'::jsonb; v_mismatch jsonb := '[]'::jsonb;
begin
  perform public.require_owner();

  -- khách
  for c in select * from jsonb_array_elements(coalesce(p -> 'customers', '[]'::jsonb)) loop
    select id into v_id from customers where legacy_id = c ->> 'legacy_id';
    if v_id is null and regexp_replace(coalesce(c ->> 'phone', ''), '\D', '', 'g') <> '' then
      select id into v_id from customers where phone_digits = regexp_replace(c ->> 'phone', '\D', '', 'g');
      if v_id is not null then update customers set legacy_id = coalesce(legacy_id, c ->> 'legacy_id') where id = v_id; end if;
    end if;
    if v_id is null then
      insert into customers (name, phone, address, legacy_id) values (btrim(c ->> 'name'), coalesce(c ->> 'phone', ''), coalesce(c ->> 'address', ''), c ->> 'legacy_id');
      n_cust := n_cust + 1;
    else e_cust := e_cust + 1; end if;
    v_id := null;
  end loop;

  -- danh mục
  for k in select * from jsonb_array_elements(coalesce(p -> 'catalog', '[]'::jsonb)) loop
    select id into v_id from catalog where legacy_id = k ->> 'legacy_id' or norm_name(name) = norm_name(k ->> 'name') limit 1;
    if v_id is null then
      insert into catalog (name, material, unit, price, legacy_id) values (btrim(k ->> 'name'), coalesce(k ->> 'material', ''), k ->> 'unit', coalesce((k ->> 'price')::bigint, 0), k ->> 'legacy_id')
      returning id into v_id;
      n_cat := n_cat + 1;
    else
      update catalog set legacy_id = coalesce(legacy_id, k ->> 'legacy_id') where id = v_id and not exists (select 1 from catalog where legacy_id = k ->> 'legacy_id');
      e_cat := e_cat + 1;
    end if;
    if (k ->> 'cost') is not null then
      insert into catalog_costs (catalog_id, cost) values (v_id, (k ->> 'cost')::bigint) on conflict (catalog_id) do nothing;
    end if;
    v_id := null;
  end loop;

  -- đơn
  for o in select * from jsonb_array_elements(coalesce(p -> 'orders', '[]'::jsonb)) loop
    if exists (select 1 from orders where legacy_id = o ->> 'legacy_id') then e_ord := e_ord + 1; continue; end if;
    v_code := o ->> 'code'; v_n := 1;
    while exists (select 1 from orders where code = v_code) loop
      v_code := (o ->> 'code') || '-S' || case when v_n > 1 then v_n::text else '' end; v_n := v_n + 1;
    end loop;
    if v_code <> o ->> 'code' then v_renamed := v_renamed || jsonb_build_object('from', o ->> 'code', 'to', v_code); end if;
    -- báo giá đầu đơn: bản chốt mới nhất, hoặc nháp
    v_head := coalesce((select vv -> 'quote' from jsonb_array_elements(o -> 'versions') vv order by (vv ->> 'no')::int desc limit 1), o -> 'draft');
    select id into v_cid from customers where legacy_id = o ->> 'customer_legacy_id';
    if v_cid is null then v_cid := public._upsert_customer(v_head -> 'customer' ->> 'name', v_head -> 'customer' ->> 'phone', v_head -> 'customer' ->> 'address'); end if;
    select * into v_t from quote_totals(v_head);
    insert into orders (code, customer_id, customer_name, customer_phone, project, quote_date, total, status, closed_at, plan, pay_due, handover, legacy_id, created_by, created_at)
    values (v_code, v_cid, btrim(v_head -> 'customer' ->> 'name'), coalesce(v_head -> 'customer' ->> 'phone', ''), coalesce(v_head ->> 'project', ''),
            nullif(v_head ->> 'date', '')::date, v_t.total, o ->> 'status', nullif(o ->> 'closed_at', '')::date, coalesce(o -> 'plan', '[]'::jsonb),
            nullif(o ->> 'pay_due', '')::date, case when jsonb_typeof(o -> 'handover') = 'object' then o -> 'handover' end, o ->> 'legacy_id', null,
            coalesce(public._ts(o ->> 'created_at'), now()))
    returning id into v_oid;
    n_ord := n_ord + 1;

    for v in select * from jsonb_array_elements(coalesce(o -> 'versions', '[]'::jsonb)) loop
      select * into v_t from quote_totals(v -> 'quote');
      insert into order_quotes (order_id, version_no, quote, sub, disc, total, closed_at, sign)
      values (v_oid, (v ->> 'no')::int, v -> 'quote', v_t.sub, v_t.disc, v_t.total, nullif(v ->> 'closed_at', '')::date,
              case when jsonb_typeof(v -> 'sign') = 'object' then v -> 'sign' end);
      if (v ->> 'file_total') is not null and (v ->> 'file_total')::bigint <> v_t.total then
        v_mismatch := v_mismatch || jsonb_build_object('code', v_code, 'version', (v ->> 'no')::int, 'file', (v ->> 'file_total')::bigint, 'app', v_t.total);
      end if;
    end loop;
    if jsonb_typeof(o -> 'draft') = 'object' then
      insert into order_quotes (order_id, quote) values (v_oid, o -> 'draft');
    end if;

    for x in select * from jsonb_array_elements(coalesce(o -> 'payments', '[]'::jsonb)) loop
      insert into order_payments (order_id, no, amount, date, method, note, deposit, legacy_id, created_by)
      values (v_oid, (x ->> 'no')::int, (x ->> 'amount')::bigint, (x ->> 'date')::date, x ->> 'method', coalesce(x ->> 'note', ''), coalesce((x ->> 'deposit')::boolean, false), x ->> 'legacy_id', null)
      on conflict (legacy_id) do nothing;
      if found then n_pay := n_pay + 1; end if;
    end loop;

    v_map := '{}'::jsonb;
    for x in select * from jsonb_array_elements(coalesce(o -> 'changes', '[]'::jsonb)) loop
      insert into order_changes (order_id, sign, title, amount, reason, note, status, confirmed_at, sign_rec, legacy_id, created_by)
      values (v_oid, (x ->> 'sign')::smallint, x ->> 'title', (x ->> 'amount')::bigint, coalesce(x ->> 'reason', 'other'), coalesce(x ->> 'note', ''), x ->> 'status',
              nullif(x ->> 'confirmed_at', '')::date, case when jsonb_typeof(x -> 'sign_rec') = 'object' then x -> 'sign_rec' end, x ->> 'legacy_id', null)
      returning id into v_id;
      v_map := v_map || jsonb_build_object(x ->> 'legacy_id', v_id::text);
      n_chg := n_chg + 1;
    end loop;

    for x in select * from jsonb_array_elements(coalesce(o -> 'notes', '[]'::jsonb)) loop
      insert into order_notes (order_id, text, created_by, created_at) values (v_oid, x ->> 'text', null, coalesce(public._ts(x ->> 'at'), now()));
    end loop;
    for x in select * from jsonb_array_elements(coalesce(o -> 'log', '[]'::jsonb)) loop
      insert into order_log (order_id, at, by, text) values (v_oid, coalesce(public._ts(x ->> 'at'), now()), null, x ->> 'text');
    end loop;
    insert into order_log (order_id, by, text) values (v_oid, auth.uid(), 'Nhập từ Sổ Nội Thất' || case when v_code <> o ->> 'code' then ' (mã cũ ' || (o ->> 'code') || ')' else '' end);

    if jsonb_typeof(o -> 'costs') = 'object' then
      insert into order_costs (order_id, rows, chg, ship)
      values (v_oid, coalesce(o -> 'costs' -> 'rows', '{}'::jsonb),
              (select coalesce(jsonb_object_agg(v_map ->> kv.key, kv.value), '{}'::jsonb) from jsonb_each(coalesce(o -> 'costs' -> 'chg', '{}'::jsonb)) kv where v_map ? kv.key),
              coalesce((o -> 'costs' ->> 'ship')::bigint, 0));
    end if;
  end loop;

  -- sổ thu chi
  for e in select * from jsonb_array_elements(coalesce(p -> 'cash', '[]'::jsonb)) loop
    if exists (select 1 from cash_entries where legacy_id = e ->> 'legacy_id') then e_cash := e_cash + 1; continue; end if;
    insert into cash_entries (type, date, amount, cat, note, method, order_id, legacy_id, created_by)
    values (e ->> 'type', (e ->> 'date')::date, (e ->> 'amount')::bigint, e ->> 'cat', coalesce(e ->> 'note', ''), coalesce(e ->> 'method', 'cash'),
            (select id from orders where legacy_id = e ->> 'order_legacy_id'), e ->> 'legacy_id', auth.uid());
    n_cash := n_cash + 1;
  end loop;

  return jsonb_build_object(
    'created', jsonb_build_object('customers', n_cust, 'catalog', n_cat, 'orders', n_ord, 'payments', n_pay, 'changes', n_chg, 'cash', n_cash),
    'existed', jsonb_build_object('customers', e_cust, 'catalog', e_cat, 'orders', e_ord, 'cash', e_cash),
    'renamed', v_renamed, 'mismatch', v_mismatch);
end $$;

-- ---------- sao lưu Excel: thêm phát sinh, sổ thu chi, danh mục ----------
alter function public.export_all() rename to _export_base;
revoke execute on function public._export_base() from public, anon, authenticated;
create function public.export_all() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare base jsonb;
begin
  perform public.require_owner();
  select public._export_base() into base;
  return base || jsonb_build_object(
    'phat_sinh', (select coalesce(jsonb_agg(x order by x.ma_don, x.ngay_tao), '[]') from (
      select o.code as ma_don, case when c.sign < 0 then 'Giảm' else 'Tăng' end as loai, c.title as noi_dung, c.amount as so_tien,
             case c.status when 'pending' then 'Chờ xác nhận' when 'confirmed' then 'Đã xác nhận' else 'Đã hủy' end as trang_thai,
             c.confirmed_at as ngay_xac_nhan, c.note as ghi_chu, c.created_at as ngay_tao
        from order_changes c join orders o on o.id = c.order_id) x),
    'so_thu_chi', (select coalesce(jsonb_agg(x order by x.ngay), '[]') from (
      select e.date as ngay, case e.type when 'in' then 'Thu' else 'Chi' end as loai, e.cat as nhom, e.amount as so_tien, e.note as ghi_chu,
             case e.method when 'cash' then 'Tiền mặt' else 'Chuyển khoản' end as hinh_thuc, o.code as ma_don
        from cash_entries e left join orders o on o.id = e.order_id) x),
    'danh_muc', (select coalesce(jsonb_agg(x order by x.ten), '[]') from (
      select k.name as ten, k.material as vat_lieu, k.unit as don_vi, k.price as gia_ban, cc.cost as gia_nhap
        from catalog k left join catalog_costs cc on cc.catalog_id = k.id) x));
end $$;

revoke execute on function public.import_snt(jsonb) from anon;
revoke execute on function public._ts(text) from anon;
