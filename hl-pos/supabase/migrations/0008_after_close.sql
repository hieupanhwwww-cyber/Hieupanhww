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
