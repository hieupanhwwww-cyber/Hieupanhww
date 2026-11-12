# HL Bán Hàng – Nội Thất Hùng Loan

App bán hàng, kho, đơn nội thất và sổ sách. Chạy trên điện thoại, iPad, máy tính; cài lên màn hình như app thật.
**Link dùng hằng ngày:** https://profound-taiyaki-e22af3.netlify.app

- **Bán hàng:** tìm món → chạm thêm vào giỏ → (sửa số lượng/giảm giá) → chọn Tiền mặt/Chuyển khoản → Thanh toán. Kho tự trừ, hiện hóa đơn A5 để in hoặc gửi ảnh qua Zalo.
- **Hàng hóa:** thêm/sửa hàng (chủ), phiếu nhập/xuất kho có lý do, lịch sử phiếu, lọc hàng sắp hết.
- **Đơn nội thất** (làm như Sổ Nội Thất):
  - *Hôm nay*: đợt quá hạn / đến hạn thu, báo giá cần gọi lại, khách sắp hết bảo hành.
  - *Báo giá*: hạng mục (gõ tên → gợi ý từ Danh mục), kích thước tự ra số lượng, giảm giá, lịch thanh toán 2/3/4 đợt; tự lưu; in A4 / gửi ảnh Zalo.
  - *Chốt đơn*: khóa báo giá, nhận cọc, khách ký trên màn hình. Muốn đổi thì **Sửa báo giá** → bản 2, 3…
  - *Thu tiền*: mỗi lần thu có **phiếu thu** (in A5), **mã VietQR** đúng số tiền từng đợt (cần nhập ngân hàng ở Cài đặt).
  - *Phát sinh* tăng/giảm (chỉ tính khi đã xác nhận, khách ký được), *nghiệm thu* + biên bản + hạn bảo hành, ghi chú, ảnh công trình, vật tư đã dùng (trừ kho), nhật ký.
- **Sổ sách (chỉ chủ):** Cộng sổ (tồn quỹ, thu – chi – lãi từng tháng, chốt sổ, lãi theo đơn chốt), Sổ thu chi, Báo cáo bán lẻ, Danh mục (giá bán + giá nhập), lãi từng đơn; xuất Excel sao lưu.
- Nhân viên **không xem được giá vốn, giá nhập, lãi, sổ sách** (chặn ngay trong cơ sở dữ liệu).

---

## Cài đặt lần đầu (khoảng 30 phút)

### Bước 1 – Tạo cơ sở dữ liệu Supabase
1. Vào https://supabase.com → **Start your project** → đăng nhập bằng GitHub hoặc email.
2. **New project**: tên `hl-ban-hang`, đặt mật khẩu database (ghi lại), Region chọn **Singapore** (gần Việt Nam nhất) → **Create**.
3. Đợi 1–2 phút. Vào **SQL Editor** (menu trái) → **New query**.
4. Mở file `supabase/cai-dat-mot-lan.sql`, chọn hết (Ctrl+A), sao chép, dán vào ô SQL Editor, bấm **Run**. Phải báo `Success. No rows returned`.
   Rồi làm tương tự với `supabase/storage.sql` (kho ảnh công trình).
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

### Bước 4 – Đưa app lên mạng (Netlify)
> Gói miễn phí Vercel Hobby **không cho dùng thương mại**, nên app chạy trên **Netlify** (gói Free cho dùng thương mại theo trả lời của Netlify trên diễn đàn – điều khoản có thể đổi, thỉnh thoảng kiểm tra lại).

1. app.netlify.com → **Add new project → Import an existing project → GitHub** → chọn repo này, nhánh đang dùng. File `netlify.toml` đã khai báo sẵn thư mục `hl-pos` và bộ chuyển đổi Next.js.
2. Thêm 3 biến môi trường ở Bước 3 → **Deploy**.
3. **Project configuration → Access & security → Project visibility → Applies to: Previews only** → Save (nếu không, ai mở link cũng bị bắt đăng nhập Netlify).
4. Mỗi lần có bản mới đẩy lên nhánh, Netlify tự build lại trong 1–3 phút.

### Bước 5 – Cài lên điện thoại
- **iPhone/iPad:** mở địa chỉ app bằng Safari → nút Chia sẻ → **Thêm vào MH chính**.
- **Android:** mở bằng Chrome → menu ⋮ → **Thêm vào màn hình chính / Cài đặt ứng dụng**.

### Thêm nhân viên
Cài đặt → **Tạo tài khoản** (tên, email, mật khẩu ≥ 8 ký tự) → gửi nhân viên link app + email + mật khẩu → nhân viên cài app lên màn hình (Bước 5).

### Chuyển dữ liệu từ Sổ Nội Thất
1. Sổ Nội Thất: Cài đặt → **Sao lưu** → được file `So-noi-that-sao-luu-….json`.
2. HL Bán Hàng (tài khoản chủ): Cài đặt → **Nhập từ Sổ Nội Thất** → chọn file → xem trước → **Nhập**.
3. Xem bảng đối chiếu: mọi đơn phải "khớp". Mở thử 3 đơn bất kỳ, so số với Sổ Nội Thất bằng mắt.
4. Nhập lại cùng file bao nhiêu lần cũng không trùng. Ảnh đính kèm và các khoản "báo đã thu chờ xác nhận" không chuyển tự động – màn xem trước liệt kê để làm tay.

### Bước 6 – Bán thử trước khi dùng thật
1. SQL Editor → dán file `supabase/seed.sql` → Run (thêm 7 món mẫu, tên có chữ **[Mẫu]**, giá chỉ để thử).
2. Đăng nhập app → Cài đặt → tạo 1 tài khoản nhân viên → đăng nhập bằng tài khoản đó trên điện thoại khác.
3. Bán thử vài hóa đơn, in thử, gửi ảnh Zalo thử; tạo thử 1 đơn nội thất, ghi thu cọc, thêm vật tư.
4. Kiểm tra: tài khoản nhân viên **không** thấy giá vốn và mục Báo cáo; kho trừ đúng; báo cáo ra đúng số.
5. Dùng thật: SQL Editor → chạy `supabase/xoa-du-lieu-mau.sql` (xóa sạch hàng, hóa đơn, đơn nội thất, khách, sổ thu chi thử; giữ tài khoản, cài đặt, danh mục) → nhập hàng thật.

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
- Next.js 16 + Tailwind 4, Supabase (Postgres + Auth + Storage), Netlify. Quy tắc nghiệp vụ và phân quyền nằm trong `supabase/migrations/` (RLS + hàm RPC trong 1 giao dịch). Tiền của đơn nội thất tính ở `src/lib/orderMoney.ts` (chép quy tắc Sổ Nội Thất), có test so khớp với máy chủ.
- Thay đổi cơ sở dữ liệu: thêm file `supabase/migrations/00NN_….sql`, chạy `npm run bundle-sql` (cập nhật `cai-dat-mot-lan.sql`), sao lưu rồi chạy file migration mới trên Supabase.
- `npm install` → `npm test` (cần Postgres 16 cục bộ: tự dựng cụm tạm; hoặc đặt `TEST_DATABASE_URL`) → `npm run build`.
- Kiểm thử trên bản thật: `tests/e2e/run.sh ban-thu.mjs|gd1.mjs|gd2.mjs|gd3.mjs <thư mục ảnh>` – tự tạo và xóa tài khoản/đơn thử.
