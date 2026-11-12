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
