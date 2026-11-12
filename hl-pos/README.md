# HL Bán Hàng – Nội Thất Hùng Loan

App bán hàng, kho và đơn nội thất. Chạy trên điện thoại, iPad, máy tính; cài lên màn hình như app thật.

- **Bán hàng:** tìm món → chạm thêm vào giỏ → (sửa số lượng/giảm giá) → chọn Tiền mặt/Chuyển khoản → Thanh toán. Kho tự trừ, hiện hóa đơn A5 để in hoặc gửi ảnh qua Zalo.
- **Hàng hóa:** thêm/sửa hàng (chủ), phiếu nhập/xuất kho có lý do, lịch sử phiếu, lọc hàng sắp hết.
- **Đơn nội thất:** chia đợt thanh toán, đánh dấu đã thu, xem còn nợ, đổi tiến độ, ghi vật tư đã dùng (tự trừ kho).
- **Báo cáo (chỉ chủ):** doanh thu, lợi nhuận, bán chạy, sắp hết, khách còn nợ; nút xuất Excel sao lưu.
- Nhân viên **không xem được giá vốn, lợi nhuận, báo cáo** (chặn ngay trong cơ sở dữ liệu).

---

## Cài đặt lần đầu (khoảng 30 phút)

### Bước 1 – Tạo cơ sở dữ liệu Supabase
1. Vào https://supabase.com → **Start your project** → đăng nhập bằng GitHub hoặc email.
2. **New project**: tên `hl-ban-hang`, đặt mật khẩu database (ghi lại), Region chọn **Singapore** (gần Việt Nam nhất) → **Create**.
3. Đợi 1–2 phút. Vào **SQL Editor** (menu trái) → **New query**.
4. Mở file `supabase/cai-dat-mot-lan.sql`, chọn hết (Ctrl+A), sao chép, dán vào ô SQL Editor, bấm **Run**. Phải báo `Success. No rows returned`.
5. **Chặn người lạ tự đăng ký:** Authentication → Sign In / Providers → tắt **Allow new users to sign up** → Save.
   (App đã tự chặn quyền của tài khoản lạ, bước này khóa thêm một lớp.)

### Bước 2 – Tạo tài khoản chủ
1. Authentication → Users → **Add user** → **Create new user**: nhập email + mật khẩu của bạn, tích **Auto Confirm User** → Create.
2. SQL Editor → New query → dán nội dung file `supabase/tao-tai-khoan-chu.sql`, sửa email trong dấu nháy thành email vừa tạo → **Run**.

### Bước 3 – Lấy khóa kết nối
Project Settings → **API Keys**. Ghi lại 3 giá trị (xem file `.env.example`):
- Project URL → `NEXT_PUBLIC_SUPABASE_URL`
- Publishable key (hoặc `anon`) → `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- Secret key (hoặc `service_role`) → `SUPABASE_SERVICE_ROLE_KEY` – **giữ bí mật**, ai có khóa này đọc/sửa được toàn bộ dữ liệu.

### Bước 4 – Đưa app lên mạng
> ⚠️ Gói miễn phí **Vercel Hobby chỉ cho dùng cá nhân, không thương mại**. App bán hàng của cửa hàng là dùng thương mại → trên Vercel cần gói **Pro** (trả phí theo tháng, xem giá tại vercel.com/pricing). Kiểm tra lại điều khoản trước khi chọn.

Cách làm trên Vercel:
1. Vào https://vercel.com → đăng nhập bằng GitHub → **Add New → Project** → chọn repo này.
2. **Root Directory**: chọn `hl-pos`.
3. Mở **Environment Variables**, thêm đủ 3 biến ở Bước 3.
4. Bấm **Deploy**. Xong sẽ có địa chỉ dạng `https://hl-ban-hang.vercel.app`.

### Bước 5 – Cài lên điện thoại
- **iPhone/iPad:** mở địa chỉ app bằng Safari → nút Chia sẻ → **Thêm vào MH chính**.
- **Android:** mở bằng Chrome → menu ⋮ → **Thêm vào màn hình chính / Cài đặt ứng dụng**.

### Bước 6 – Bán thử trước khi dùng thật
1. SQL Editor → dán file `supabase/seed.sql` → Run (thêm 7 món mẫu, tên có chữ **[Mẫu]**, giá chỉ để thử).
2. Đăng nhập app → Cài đặt → tạo 1 tài khoản nhân viên → đăng nhập bằng tài khoản đó trên điện thoại khác.
3. Bán thử vài hóa đơn, in thử, gửi ảnh Zalo thử; tạo thử 1 đơn nội thất, ghi thu cọc, thêm vật tư.
4. Kiểm tra: tài khoản nhân viên **không** thấy giá vốn và mục Báo cáo; kho trừ đúng; báo cáo ra đúng số.
5. Dùng thật: SQL Editor → chạy `supabase/xoa-du-lieu-mau.sql` (xóa sạch hàng, hóa đơn, đơn thử; giữ tài khoản) → nhập hàng thật.

---

## Dùng hằng ngày – lưu ý quan trọng
- **Sao lưu mỗi tuần:** Báo cáo → **Xuất Excel sao lưu**, lưu file vào Google Drive/Zalo Cloud. Gói Supabase miễn phí *không* có sao lưu tự động (theo các nguồn tham khảo tháng 11/2026 – kiểm tra lại trên supabase.com/pricing).
- **Supabase miễn phí tạm dừng dự án sau 7 ngày không có ai dùng.** Cửa hàng dùng hằng ngày thì không sao; nếu nghỉ dài ngày, vào supabase.com bấm **Restore** để bật lại.
- Giới hạn gói miễn phí khoảng **500 MB dữ liệu** – đủ cho nhiều năm hóa đơn của một cửa hàng.
- **Mất mạng:** app hiện thanh đỏ và khóa nút Thanh toán. Không có dữ liệu nào bị ghi dở.
- **Bán nhầm:** hóa đơn không xóa được (để kho và báo cáo luôn khớp). Nếu khách trả hàng, vào Hàng hóa → Nhập/Xuất → **Nhập kho** với lý do "Khách trả – HDxxxxxx".
- **Ngừng bán một món:** Hàng hóa → Sửa → *Ngừng bán món này* (không xóa để giữ lịch sử).
- Đổi logo/biểu tượng app: thay `public/icon-192.png`, `public/icon-512.png`, `src/app/apple-icon.png` bằng logo của cửa hàng (cùng kích thước).

---

## Dành cho kỹ thuật
- Next.js 16 + Tailwind 4, Supabase (Postgres + Auth). Mọi quy tắc nghiệp vụ và phân quyền nằm trong `supabase/migrations/` (RLS + hàm RPC trong 1 giao dịch).
- `npm install` → `npm test` (cần Postgres 16 cục bộ: tự dựng cụm tạm; hoặc đặt `TEST_DATABASE_URL`) → `npm run build`.
- Chạy thử: tạo `.env.local` từ `.env.example` → `npm run dev`.
