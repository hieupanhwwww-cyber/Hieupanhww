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
