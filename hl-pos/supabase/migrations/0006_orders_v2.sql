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
