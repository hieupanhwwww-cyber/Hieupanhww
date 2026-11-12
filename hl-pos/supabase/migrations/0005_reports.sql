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
