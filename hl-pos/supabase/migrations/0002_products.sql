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
