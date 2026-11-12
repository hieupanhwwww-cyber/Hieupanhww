# Thiết kế app quản lý bán hàng – Nội Thất Hùng Loan

Ngày: 2026-11-12 · Người quyết định: Hiếu · Trạng thái: chờ duyệt

## 1. Mục tiêu

Thay Excel/sổ tay bằng một app giống KiotViet để cả cửa hàng cùng quản lý bán hàng, tồn kho và đơn nội thất làm theo đơn. Thành công khi: bán một hóa đơn trong tối đa 4 chạm, kho tự trừ đúng, chủ xem được doanh thu/lợi nhuận, nhân viên không thấy giá vốn.

## 2. Phạm vi bản đầu

Có: (1) bán hàng và in hóa đơn, (2) hàng hóa và tồn kho, (4) báo cáo doanh thu/lợi nhuận, (6) đơn nội thất làm theo đơn.

Chưa có (để bản sau): quản lý khách hàng và công nợ riêng, phân quyền chi tiết hơn 2 vai trò, làm việc khi mất mạng, quét mã vạch bằng camera, in máy in nhiệt 80mm.

## 3. Người dùng và thiết bị

Chủ và nhân viên, nhiều người dùng cùng lúc trên điện thoại, iPad, máy tính. Dữ liệu đồng bộ qua mạng; bản đầu cần có mạng để bán hàng.

## 4. Dữ liệu

- **Hàng hóa:** mã, tên, loại (hàng có sẵn / vật tư), đơn vị, giá vốn, giá bán, tồn kho hiện tại, mức cảnh báo sắp hết.
- **Phiếu kho:** mỗi lần nhập/xuất tạo một phiếu (loại, hàng, số lượng, thời gian, người tạo, lý do/đơn liên quan). Tồn kho tính từ các phiếu.
- **Hóa đơn bán lẻ:** các dòng hàng (số lượng, giá bán, giá vốn tại thời điểm bán), giảm giá, hình thức thanh toán, tổng tiền. Lưu xong tự tạo phiếu xuất kho.
- **Đơn nội thất:** khách, điện thoại, địa chỉ, tổng giá trị, các đợt thanh toán (cọc, đợt 2, nghiệm thu: số tiền, đã thu chưa, ngày thu), tiến độ (chốt thiết kế, sản xuất, lắp đặt, hoàn thành), danh sách vật tư đã dùng (tạo phiếu xuất kho).
- **Người dùng:** tài khoản đăng nhập, vai trò chủ hoặc nhân viên.
- Tiền lưu bằng số nguyên đồng. Báo cáo tính từ hóa đơn và đơn, không lưu riêng.

## 5. Màn hình

Thanh điều hướng: Bán hàng (màn chính) · Hàng hóa · Đơn nội thất · Báo cáo (chỉ chủ) · Cài đặt (tài khoản, thông tin cửa hàng in trên hóa đơn).

**Luồng bán lẻ:** tìm món theo tên/mã, chạm thêm vào giỏ, sửa số lượng/giảm giá, chọn tiền mặt hoặc chuyển khoản, bấm Thanh toán. Kho tự trừ, hiện hóa đơn để in hoặc gửi ảnh qua Zalo.

**Luồng đơn nội thất:** tạo đơn và chia đợt thanh toán; ghi từng lần thu tiền, app hiện còn nợ; chạm đổi trạng thái tiến độ; thêm vật tư đã dùng.

**Báo cáo:** doanh thu theo ngày/tháng, lợi nhuận, mặt hàng bán chạy, hàng sắp hết, tiền khách còn nợ trên đơn nội thất.

**In hóa đơn:** khổ A5 qua trình duyệt (mặc định). Mẫu 80mm thêm sau khi có máy in nhiệt.

## 6. Kỹ thuật

- Giao diện: Next.js (React) + Tailwind, cài lên màn hình điện thoại như app thật (PWA).
- Dữ liệu và đăng nhập: Supabase (Postgres). Chạy online trên Vercel.
- Hiếu tự tạo tài khoản Supabase và Vercel (có gói miễn phí; giá và giới hạn sẽ kiểm tra lại trước khi triển khai). Claude hướng dẫn và làm phần còn lại.

## 7. Bảo mật và an toàn dữ liệu

- Nhân viên không đọc được giá vốn và lợi nhuận: chặn ở cơ sở dữ liệu (không chỉ ẩn trên giao diện).
- Bán hàng và trừ kho nằm trong một giao dịch duy nhất, tránh lệch kho khi hai người bán cùng lúc.
- Nút xuất toàn bộ dữ liệu ra Excel để sao lưu thủ công hằng tuần; kiểm tra thêm gói miễn phí có tự sao lưu không.
- Mất mạng: app báo rõ, không ghi dữ liệu nửa chừng.

## 8. Kiểm thử

- Test tự động cho: tính tiền, giảm giá, trừ kho, công nợ đơn nội thất, quyền xem giá vốn.
- Trước khi dùng thật: nhập dữ liệu mẫu, bán thử vài hóa đơn và tạo thử một đơn nội thất để Hiếu kiểm tra.

## 9. Điểm đã giả định (Hiếu sửa nếu sai)

- Khổ in A5 mặc định (Hiếu chưa xác nhận loại máy in).
- Chỉ có 2 vai trò: chủ và nhân viên.
- Chưa cần quét mã vạch trong bản đầu.
- Không nhập dữ liệu cũ từ Sổ Nội Thất / HL SALE DESK trong bản đầu.
