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
