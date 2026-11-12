# Thiết kế: Đơn nội thất trong HL Bán Hàng làm như Sổ Nội Thất

Ngày: 2026-11-12 · Người quyết định: Hiếu · Trạng thái: chờ duyệt
Nguồn đối chiếu: mã nguồn Sổ Nội Thất, nhánh `so-noi-that` (`parts/*.js`).

## 1. Mục tiêu

Về sau chỉ dùng **một app** HL Bán Hàng cho bán lẻ, kho và toàn bộ việc báo giá – chốt – thu tiền – bàn giao đơn nội thất; Sổ Nội Thất nghỉ dần. Thành công khi:

- Lập báo giá, gửi khách, chốt, thu tiền, ghi phát sinh, nghiệm thu hoàn toàn trên HL Bán Hàng.
- Cùng một đơn, HL Bán Hàng và Sổ Nội Thất ra **cùng con số** (tổng, từng đợt, còn nợ, lãi).
- Đơn cũ trong Sổ Nội Thất chuyển sang được bằng file sao lưu.
- Nhân viên không thấy giá nhập, lãi, sổ thu chi (chặn ở cơ sở dữ liệu).

## 2. Phạm vi

Làm theo 4 giai đoạn, không dừng hỏi giữa chừng, mỗi giai đoạn xong chạy test và báo kết quả:

- **GĐ 0 – Hoàn thiện bản đầu:** sửa menu điện thoại bị nút Netlify che; bán thử phần bán lẻ + kho trên bản thật (theo `docs/superpowers/plans/2026-11-12-hl-pos-hoan-thien.md`, bỏ phần đơn nội thất kiểu cũ).
- **GĐ 1 – Báo giá → chốt → thu tiền.**
- **GĐ 2 – Sau khi chốt:** bản sửa, phát sinh, chữ ký, nghiệm thu, ghi chú/ảnh/nhật ký.
- **GĐ 3 – Sổ sách và chuyển dữ liệu:** danh mục, lãi theo đơn, sổ thu chi, cộng sổ tháng, màn Hôm nay, doanh thu, nhập file sao lưu Sổ Nội Thất.

**Không làm** (khác Sổ Nội Thất, đã chốt với Hiếu): 4 vai trò (giữ Chủ/Nhân viên), sale chỉ thấy đơn của mình, "báo đã thu chờ xác nhận", phân công thợ, dùng khi mất mạng, gộp khi hai người sửa cùng lúc, dữ liệu demo, cảnh báo thuế.

**Thay thế:** bảng `interior_orders`, `order_payments`, view `order_balances` và các hàm đơn kiểu cũ của bản đầu bị bỏ (chưa có đơn thật). Giữ: ghi vật tư đã dùng → trừ kho.

## 3. Phân quyền (2 vai trò)

| Việc | Nhân viên | Chủ |
|---|---|---|
| Khách hàng, báo giá, chốt, bản sửa, phát sinh, nghiệm thu, ghi chú, ảnh | ✓ | ✓ |
| Ghi thu tiền, in phiếu thu, xem còn nợ | ✓ | ✓ |
| Xóa phiếu thu, xóa đơn (chỉ đơn đang báo giá chưa có tiền) | – | ✓ |
| Danh mục hạng mục: xem và chọn | ✓ | ✓ |
| Danh mục: thêm/sửa/xóa; giá nhập; lãi theo đơn | – | ✓ |
| Sổ thu chi, cộng sổ tháng, doanh thu | – | ✓ |
| Cài đặt (ngân hàng, mẫu lịch, điều khoản…), nhập file sao lưu | – | ✓ |

## 4. Dữ liệu

Tiền là số nguyên đồng. Số lượng tối đa 3 số lẻ.

- **Khách hàng** `customers`: tên, SĐT, địa chỉ, ghi chú. Tự tạo/cập nhật khi lưu báo giá (khớp theo SĐT).
- **Đơn** `orders`: mã `BG<yy><mm>-<NN>` (máy chủ cấp, tiền tố sửa ở Cài đặt, mặc định `BG`), khách, tên công trình, trạng thái `quote` Đang báo giá / `closed` Đã chốt / `building` Đang thi công / `done` Hoàn thành, ngày chốt, ngày hẹn gọi lại, lịch thanh toán hiện hành, thông tin nghiệm thu (ngày, số tháng bảo hành, hết bảo hành, ghi chú, chữ ký), người tạo.
- **Báo giá** `order_quotes`: mỗi đơn có tối đa **một bản nháp** và các **bản đã chốt** đánh số 1, 2, 3… Nội dung: ngày, khách (chụp lại tên/SĐT/địa chỉ), công trình, các dòng, giảm giá (`percent` hoặc `amount`), ghi chú, điều khoản, hiệu lực đến ngày, lịch thanh toán đề xuất. Bản đã chốt lưu thêm `sub`, `disc`, `total`, ngày chốt, chữ ký — và **không sửa được nữa**.
  - Dòng: mã dòng, tên, vật liệu, đơn vị (`m²`, `md`, `bộ`, `cái`, `gói`, `cánh`, `điểm`, `công`), số lượng, đơn giá, kích thước tùy chọn (`a`, `b`, số lượng `n`, đơn vị `mm/cm/m`).
- **Lịch thanh toán** (danh sách đợt): nhãn, `%` hoặc số tiền cố định, mốc (`sign` Khi chốt đơn / `progress` Khi bắt đầu thi công / `accept` Khi nghiệm thu, bàn giao / `date` Theo ngày hẹn), hạn trả, cờ "đã tới mốc".
- **Phiếu thu** `order_payments`: số thứ tự trong đơn, số tiền > 0, ngày, hình thức (`transfer`/`cash`), ghi chú, có phải đặt cọc, người ghi. Số phiếu `PT-<mã đơn>-<NN>`.
- **Phát sinh** `order_changes`: tăng/giảm, tiêu đề, số tiền, lý do, ghi chú, trạng thái `pending` Chờ xác nhận / `confirmed` Đã xác nhận / `cancelled` Đã hủy, ngày xác nhận, chữ ký.
- **Ghi chú** `order_notes`, **ảnh đính kèm** `order_attachments` (file trên Supabase Storage, thu nhỏ cạnh dài ≤ 2000 px trước khi tải lên), **nhật ký** `order_log` (thời gian, ai, làm gì — máy chủ tự ghi).
- **Chi phí đơn** `order_costs` (chỉ chủ): giá nhập từng dòng, giá vốn từng phát sinh, phí vận chuyển.
- **Danh mục** `catalog`: tên, vật liệu, đơn vị, giá bán; `catalog_costs` (chỉ chủ): giá nhập.
- **Sổ thu chi** `cash_entries` (chỉ chủ): thu/chi, ngày, số tiền, nhóm, ghi chú, hình thức, gắn đơn (tùy chọn). Nhóm chi: Vật tư, ván · Phụ kiện, thiết bị · Nhân công, thợ · Thuê ngoài, gia công · Vận chuyển · Quảng cáo · Lương · Thuê xưởng, mặt bằng · Điện, nước, xăng · Dụng cụ, máy móc · Tiếp khách · Chi khác. Nhóm thu: Thu khác · Bán phế liệu · Góp vốn, vay. **Tiền khách trả** (phiếu thu) và **tiền bán lẻ** (hóa đơn) tự hiện trong sổ, không nhập lại.
- **Cài đặt** (thêm vào `store_settings`): khẩu hiệu, email, logo, ngân hàng (tên, mã BIN, số TK, chủ TK), tiền tố nội dung CK (mặc định `HL`), ghi chú và điều khoản mặc định, tiền tố mã đơn, số tháng bảo hành (mặc định 36), mẫu lịch thanh toán, số ngày nhắc gọi lại (mặc định 3), số dư quỹ đầu kỳ (ngày, số tiền), các tháng đã chốt sổ.

## 5. Quy tắc tính tiền (giữ nguyên như Sổ Nội Thất)

Một mô-đun duy nhất `orderMoney` tính mọi con số của đơn; màn hình, phiếu thu, báo giá in đều lấy từ đây.

1. Thành tiền dòng = làm tròn(số lượng × đơn giá). Tạm tính = tổng các dòng.
2. Giảm giá: theo `%` (0–100) của tạm tính, hoặc số tiền (0 → tạm tính). Tổng = tạm tính − giảm giá.
3. Số lượng từ kích thước: `m²` = a × b × n; `md` = a × n; đơn vị khác = n (đổi mm/cm/m về mét, làm tròn 3 số lẻ).
4. Giá trị đơn = tổng **bản chốt mới nhất** + các phát sinh **đã xác nhận** (đơn đang báo giá: tổng bản nháp).
5. Chia đợt: các đợt trước = `%` × giá trị gốc (hoặc số cố định); **đợt cuối = phần còn lại**. Nếu các đợt trước chiếm hết giá trị → cảnh báo "Đợt cuối sẽ bằng 0".
6. Phát sinh cộng vào đợt cuối; nếu là giảm thì trừ lùi dần từ đợt cuối lên.
7. Tiền khách đã trả lấp dần từ đợt 1.
8. Trạng thái đợt: **Đã thu** (hết nợ) · **Quá hạn** (có hạn và hạn < hôm nay) · **Đến hạn** (đơn đã chốt và đã tới mốc, hoặc hạn ≤ hôm nay) · **Chưa đến hạn**. Mốc `sign` tới khi chốt; `progress` tới khi Đang thi công/Hoàn thành/đã nghiệm thu; `accept` tới khi Hoàn thành/đã nghiệm thu.
9. Còn nợ = max(0, giá trị đơn − đã trả); trả thừa = max(0, đã trả − giá trị đơn). Đơn chưa chốt: chưa có gì phải thu.
10. Mẫu lịch: 2 đợt (50 / còn lại), **3 đợt mặc định (50 khi chốt / 40 khi lắp đặt / còn lại sau nghiệm thu)**, 4 đợt (30/30/30/còn lại).
11. Lãi đơn (chỉ chủ) = doanh thu (tổng + phát sinh đã xác nhận) − (giá nhập × số lượng từng dòng + giá vốn phát sinh + vận chuyển). Giá nhập dòng lấy theo thứ tự: nhập riêng cho đơn → giá nhập danh mục (theo tên). **Khi chốt, giá nhập danh mục được chụp vào đơn** để đổi danh mục sau này không đổi lãi đơn cũ.
12. Chi phí thực của đơn = các khoản chi gắn đơn trong sổ thu chi **+ vật tư xuất kho cho đơn × giá vốn lúc xuất** (điểm mới so với Sổ Nội Thất, nhờ nối với kho). Cộng sổ dùng chi phí thực nếu có, không thì dùng ước tính ở mục 11.
13. Doanh thu theo tháng: bản chốt 1 tính vào tháng chốt; bản sửa tính phần chênh vào tháng chốt bản đó; phát sinh tính vào tháng xác nhận.
14. Sổ quỹ tháng: tồn đầu + thu − chi = tồn cuối. Lãi tháng = thu (không tính "Góp vốn, vay") − chi. Chốt sổ tháng lưu lại số lúc chốt; sửa khoản trong tháng đã chốt phải xác nhận.

Bộ test tiền của Sổ Nội Thất (`test/money.test.js`) được chuyển sang và phải đạt 100%.

## 6. Luồng và màn hình

**Danh sách đơn:** tìm theo tên/SĐT/mã; lọc Đang báo giá · Đã chốt · Đang thi công · Hoàn thành · Cần thu (có đợt đến hạn/quá hạn). Thẻ đơn hiện trạng thái, giá trị, còn nợ, đợt kế tiếp.

**Soạn báo giá:** chọn khách (gõ SĐT ra khách cũ) → thêm dòng (gõ tên gợi ý từ danh mục, tự điền vật liệu/đơn vị/giá) → kích thước tự ra số lượng → giảm giá → lịch thanh toán (chọn mẫu 2/3/4 đợt rồi sửa) → ghi chú, điều khoản, hiệu lực. Tự lưu nháp. Nút **Xem/In** (A4) và **Gửi ảnh Zalo**.

**Chốt đơn:** nhập ngày chốt, tiền cọc + hình thức, (GĐ 2) khách ký. Báo giá bị khóa thành bản 1; trạng thái → Đã chốt; tiền cọc thành phiếu thu số 1.

**Trang đơn đã chốt:** tổng quan tiền (giá trị, đã thu, còn nợ, các đợt kèm trạng thái và mã VietQR) · nút **Thu tiền** · tiến độ (chạm đổi trạng thái) · phát sinh · vật tư đã dùng · nghiệm thu · ghi chú · ảnh · nhật ký · các bản đã chốt.

**Thu tiền:** số tiền (gợi ý = đợt kế tiếp), ngày, hình thức, ghi chú → tạo phiếu thu, mở phiếu để in/gửi ảnh.

**VietQR:** tạo ngay trên máy theo chuẩn VietQR (không gọi dịch vụ ngoài), có số tiền và nội dung `<tiền tố> <mã đơn> D<số đợt>`. Hiện trên trang đơn, trên báo giá in và phiếu. Chưa nhập ngân hàng ở Cài đặt → không hiện mã, chỉ nhắc vào Cài đặt.

**Bản sửa (GĐ 2):** từ đơn đã chốt bấm "Sửa báo giá" → nháp mới chép từ bản chốt cuối, mang theo lịch và giá nhập → chốt thành bản 2, 3… Các bản cũ xem và in lại được, ghi rõ "đã được thay bằng bản N".

**Phát sinh (GĐ 2):** thêm (tăng/giảm, tiêu đề, số tiền, lý do: khách đổi ý / hiện trạng khác / thêm hạng mục / khác) → trạng thái Chờ xác nhận, **chưa tính vào tổng** → Xác nhận (ngày, khách ký tùy chọn) hoặc Hủy.

**Chữ ký (GĐ 2):** khách ký bằng ngón tay/bút trên màn hình khi chốt, khi xác nhận phát sinh, khi nghiệm thu. Lưu ảnh chữ ký, tên người ký, thời điểm, mã xác nhận 16 ký tự (băm từ nội dung + thời điểm + tên) và in trên giấy tờ tương ứng.

**Nghiệm thu (GĐ 2):** ngày bàn giao, số tháng bảo hành → tự tính ngày hết bảo hành; ghi chú; khách ký; in **biên bản nghiệm thu** A4. Nghiệm thu làm đợt mốc `accept` thành Đến hạn.

**Danh mục (GĐ 3):** tìm, thêm/sửa/xóa (chủ), giá bán và giá nhập.

**Lãi đơn (GĐ 3, chủ):** trên trang đơn: doanh thu, giá nhập hàng, vốn phát sinh, vận chuyển, lãi, %; nhập giá nhập từng dòng; báo số dòng thiếu giá nhập.

**Sổ thu chi + Cộng sổ (GĐ 3, chủ):** thêm khoản thu/chi; danh sách theo tháng; bảng 12 tháng (tồn đầu, thu khách, thu khác, chi, lãi, tồn cuối); chi theo nhóm; chốt sổ tháng; bảng lãi theo đơn chốt.

**Hôm nay (GĐ 3):** thành màn mở đầu của mục Đơn nội thất: đợt quá hạn/đến hạn (kèm số tiền), báo giá cần gọi lại (quá số ngày nhắc kể từ ngày báo giá hoặc tới ngày hẹn; có nút "Đã gọi, hẹn lại"), khách sắp hết bảo hành trong 30 ngày.

**Báo cáo hiện có:** ô "Thu từ đơn nội thất" và "Khách còn nợ" chuyển sang lấy từ dữ liệu mới.

**Xuất Excel sao lưu:** thêm các sheet khách, đơn, báo giá (dòng), phiếu thu, phát sinh, sổ thu chi, danh mục.

## 7. Chuyển dữ liệu từ Sổ Nội Thất (GĐ 3)

- Trong Sổ Nội Thất: Cài đặt → Sao lưu → được file `So-noi-that-sao-luu-<ngày>.json` (định dạng `so-noi-that` bản 2; đọc được cả định dạng cũ).
- Trong HL Bán Hàng (chủ): Cài đặt → **Nhập từ Sổ Nội Thất** → chọn file → màn xem trước (bao nhiêu khách, đơn, phiếu thu, khoản thu chi, mục danh mục; cái nào đã có) → bấm Nhập.
- Nhập lại cùng file **không tạo trùng** (nhận ra theo mã gốc). Giữ nguyên mã đơn, số phiếu thu, ngày tháng, chữ ký, nhật ký. Bỏ qua đơn demo.
- Sau khi nhập, app hiện bảng đối chiếu từng đơn: giá trị, đã thu, còn nợ theo HL Bán Hàng so với số tính lại từ file — lệch dòng nào báo dòng đó.
- Ảnh đính kèm: chuyển những ảnh có sẵn trong file sao lưu; ảnh không nằm trong file được liệt kê để chuyển tay.
- Yêu cầu người dùng "báo đã thu chờ xác nhận" còn treo trong file: liệt kê ra, không tự biến thành phiếu thu.

## 8. Kỹ thuật

- Như bản đầu: Next.js + Supabase; mọi thao tác ghi đi qua hàm trong cơ sở dữ liệu (một giao dịch), quyền chặn bằng RLS + `is_member()`/`is_owner()`.
- Bản nháp báo giá và bản đã chốt lưu dạng tài liệu (JSON) được hàm máy chủ kiểm tra hợp lệ và **tự tính lại tổng** khi chốt (không tin số từ trình duyệt). Phiếu thu, phát sinh, sổ thu chi, nhật ký là bảng riêng.
- `orderMoney` viết bằng TypeScript (chép quy tắc mục 5); máy chủ có view tổng hợp giá trị/đã thu/còn nợ cho báo cáo và có test so khớp hai bên trên cùng dữ liệu.
- Mã đơn và số phiếu do máy chủ cấp trong giao dịch, không trùng khi hai người cùng tạo.
- Hai người cùng sửa một nháp: người lưu sau nhận thông báo "Báo giá vừa được người khác sửa, tải lại" (kiểm tra phiên bản), không ghi đè âm thầm.
- In A4 bằng trình duyệt (`@page A4`), ảnh gửi Zalo bằng `html-to-image` như hóa đơn bán lẻ. Mã QR vẽ bằng thư viện tạo QR phía trình duyệt; chuỗi VietQR (EMVCo + CRC16) tự dựng và có test với mẫu chuẩn.
- Ảnh và chữ ký: Supabase Storage, thư mục riêng, chỉ thành viên đọc được.
- Thay đổi cơ sở dữ liệu trên bản thật: chạy bằng file migration mới (0006 trở đi) qua Supabase Management API; trước mỗi lần chạy xuất Excel sao lưu.

## 9. Kiểm thử

- Test tự động: toàn bộ mục 5 (gồm bộ test tiền chuyển từ Sổ Nội Thất); chốt/bản sửa/phát sinh/thu tiền/xóa phiếu; quyền (nhân viên không đọc giá nhập, lãi, sổ thu chi; người lạ không đọc gì); mã đơn/số phiếu không trùng khi tạo đồng thời; chuỗi VietQR; nhập file sao lưu (dùng dữ liệu mẫu dựng theo đúng định dạng, nhập 2 lần không trùng, số tiền khớp).
- Sau mỗi giai đoạn: chạy thử trọn luồng trên bản thật bằng tài khoản thử tạm (tự xóa), gửi Hiếu ảnh màn hình và file PDF báo giá/phiếu thu/biên bản.
- Trước khi bỏ Sổ Nội Thất: Hiếu nhập file sao lưu thật, xem bảng đối chiếu, chọn 3 đơn bất kỳ so bằng mắt giữa hai app.

## 10. Điểm đã giả định (Hiếu sửa nếu sai)

- Nhân viên được lập, chốt báo giá và ghi thu tiền trực tiếp.
- Mã đơn tiếp tục dạng `BG<yy><mm>-<NN>`, phiếu thu `PT-<mã đơn>-<NN>`.
- Bảo hành mặc định 36 tháng; nhắc gọi lại sau 3 ngày.
- Chi phí thực của đơn có cộng vật tư xuất kho (mục 5.12). Vì vậy tiền mua vật tư **nhập kho** ghi vào sổ chi nhưng không gắn đơn, để không bị tính hai lần.
- Bán lẻ và kho không đổi. Tiền bán lẻ tự hiện trong sổ quỹ ở nhóm "Bán lẻ".
- Giao diện giữ tông trắng – sữa – nâu của HL Bán Hàng, không chép giao diện "Xưởng gỗ".
- Gói Supabase miễn phí đủ dùng (ảnh đã thu nhỏ); sẽ kiểm tra dung lượng khi nhập dữ liệu thật.
