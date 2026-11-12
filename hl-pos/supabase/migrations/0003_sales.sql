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
