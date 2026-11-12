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
