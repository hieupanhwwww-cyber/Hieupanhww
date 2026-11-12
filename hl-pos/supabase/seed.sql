-- DỮ LIỆU MẪU ĐỂ BÁN THỬ. Giá và tên chỉ là ví dụ, KHÔNG phải bảng giá thật của cửa hàng.
-- Xóa trước khi dùng thật: chạy file supabase/xoa-du-lieu-mau.sql

with p as (
  insert into public.products (code, name, kind, unit, sale_price, low_stock_threshold) values
    ('MAU-TAB01', '[Mẫu] Tab đầu giường 2 ngăn', 'goods', 'cái', 1200000, 2),
    ('MAU-BTP01', '[Mẫu] Bàn trang điểm có gương', 'goods', 'cái', 2500000, 1),
    ('MAU-KE01',  '[Mẫu] Kệ treo tường 1200mm', 'goods', 'cái', 450000, 3),
    ('MAU-GHE01', '[Mẫu] Ghế đôn bọc nỉ', 'goods', 'cái', 350000, 2),
    ('MAU-MDF17', '[Mẫu] Ván MDF chống ẩm 17mm', 'material', 'tấm', 0, 5),
    ('MAU-BL01',  '[Mẫu] Bản lề giảm chấn', 'material', 'cái', 0, 20),
    ('MAU-RAY45', '[Mẫu] Ray bi 450mm', 'material', 'bộ', 0, 10)
  returning id, code
), c as (
  insert into public.product_costs (product_id, cost_price)
  select id, case code
    when 'MAU-TAB01' then 750000 when 'MAU-BTP01' then 1600000 when 'MAU-KE01' then 250000
    when 'MAU-GHE01' then 200000 when 'MAU-MDF17' then 380000 when 'MAU-BL01' then 25000 else 60000 end
  from p
)
insert into public.stock_movements (product_id, type, quantity, reason)
select id, 'in', case code when 'MAU-BL01' then 100 when 'MAU-RAY45' then 40 when 'MAU-MDF17' then 30 else 10 end,
       'Tồn đầu kỳ (dữ liệu mẫu)'
from p;
