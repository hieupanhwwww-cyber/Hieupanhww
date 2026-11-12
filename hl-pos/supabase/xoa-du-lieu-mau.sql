-- Xóa SẠCH mọi hóa đơn, đơn nội thất, khách hàng, phiếu kho và hàng hóa (dùng 1 lần sau khi bán thử, trước khi dùng thật).
-- Tài khoản và thông tin cửa hàng được giữ lại.
begin;
truncate public.sale_item_costs, public.sale_items, public.stock_movements, public.sales,
         public.order_log, public.order_payments, public.order_quotes, public.orders, public.customers,
         public.product_costs, public.products;
alter sequence public.sale_code_seq restart;
commit;
