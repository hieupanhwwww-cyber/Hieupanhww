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
