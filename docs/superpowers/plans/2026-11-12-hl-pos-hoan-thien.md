# HL POS – Hoàn thiện bản đầu

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Đưa bản đầu từ "đã lên mạng" tới "Hiếu dùng thật được": sửa menu bị nút Netlify che, bán thử trọn luồng trên bản thật, dọn dữ liệu thử, cập nhật hướng dẫn.

**Architecture:** Không đổi kiến trúc. Một thay đổi giao diện (thanh menu điện thoại), còn lại là kiểm thử trên bản thật bằng Playwright với tài khoản thử tạm và thao tác dữ liệu qua Supabase Management API.

**Tech Stack:** Như bản đầu (Next.js 16, Supabase, Netlify). Playwright có sẵn trong môi trường.

**Spec:** `docs/superpowers/specs/2026-11-12-hl-pos-design.md` (mục 8: "Trước khi dùng thật: nhập dữ liệu mẫu, bán thử vài hóa đơn và tạo thử một đơn nội thất để Hiếu kiểm tra").

## Global Constraints

- App thật: `https://profound-taiyaki-e22af3.netlify.app`; Supabase project ref `jqcgaalecfjfibqyglkz`; nhánh `claude/relaxed-lamport-70rhsj` (Netlify tự build khi push).
- Không thêm tính năng ngoài spec. Không ẩn/chặn nút "Powered by Netlify" (thuộc gói miễn phí của họ) – chỉ tránh nó.
- Tài khoản thử có email dạng `kiemthu-*@hlpos.test`, tạo bằng khóa quản trị, **luôn xóa** khi xong kể cả lúc lỗi. Không đụng tài khoản `hieupanhwwww@gmail.com`.
- Không in khóa bí mật ra màn hình/log/commit.
- Xóa dữ liệu trên bản thật (Task 4) chỉ chạy sau khi Hiếu nói đồng ý.
- Mỗi task xong: `npm test` + `npm run lint` + `npm run build` trong `hl-pos/` phải sạch.

## Review Focus

1. Nút Netlify cũng có thể che nút **Thanh toán** / nội dung cuối trang trên điện thoại → cuộn hết trang phải bấm được (Task 1).
2. iPhone có tai thỏ/thanh Home: menu trên cùng không bị thanh trạng thái che khi cài như app (Task 1).
3. Hóa đơn nhiều dòng in A5 có bị tràn/cắt không (Task 3: in thử 8 dòng).
4. Bán thử làm lệch số hóa đơn: sau khi dọn, hóa đơn thật đầu tiên phải là `HD000001` (Task 4).
5. Tài khoản thử sót lại sau khi kiểm thử lỗi giữa chừng (Task 3, Task 4 kiểm tra danh sách user).

---

### Task 1: Menu điện thoại không bị nút Netlify che

**Files:**
- Modify: `hl-pos/src/components/Nav.tsx`, `hl-pos/src/app/(app)/layout.tsx`
- Create: `hl-pos/tests/e2e/nav-overlap.mjs` (script kiểm tra trên bản thật, không nằm trong `npm test`)

**Quyết định:** Trên điện thoại chuyển thanh menu từ **đáy** lên **đầu trang** (sticky, `top-0`, có `padding-top: env(safe-area-inset-top)`); máy tính giữ nguyên menu bên trái. `main` trên điện thoại giữ `pb-24` để nội dung cuối trang cuộn lên khỏi nút Netlify. `OfflineBanner` nằm ngay dưới menu.

**Interfaces – Produces:** `node tests/e2e/nav-overlap.mjs` (biến `SB_SECRET`) → đăng nhập bằng tài khoản thử, ở khổ iPhone 13 kiểm tra trên `/ban-hang`:
- mọi link trong `nav` có `boundingBox` không giao với phần tử nút Netlify (`[data-netlify-site-id]` sinh ra, tìm theo text "Powered by Netlify");
- sau khi cuộn hết trang, tâm nút **Thanh toán** không nằm dưới nút Netlify (`document.elementFromPoint` trả về chính nút đó);
- in `PASS`/`FAIL` từng dòng, exit code ≠ 0 nếu có FAIL; xóa tài khoản thử trong `finally`.

- [ ] Step 1: Viết `nav-overlap.mjs`, chạy trên bản hiện tại → **FAIL** ở dòng "link Báo cáo/Cài đặt bị che" (đúng lỗi đang có).
- [ ] Step 2: Sửa `Nav.tsx` + layout theo quyết định trên. `npm run lint && npm run build` sạch; `npm test` 67/67.
- [ ] Step 3: Commit, push; đợi Netlify báo `ready` cho commit mới (hỏi API deploys hoặc thử `curl` trang).
- [ ] Step 4: Chạy lại `nav-overlap.mjs` → toàn **PASS**. Chụp ảnh `/ban-hang` khổ điện thoại (deviceScaleFactor mặc định của iPhone 13) gửi Hiếu.

### Task 2: Nạp hàng mẫu vào bản thật

**Files:** không đổi code (dùng `hl-pos/supabase/seed.sql` đã có test).

- [ ] Step 1: Kiểm tra bản thật đang trống: `select count(*) from products` = 0, `sales` = 0, `interior_orders` = 0. Nếu khác 0 → dừng, hỏi Hiếu (có thể Hiếu đã nhập hàng thật).
- [ ] Step 2: Chạy `seed.sql` qua Management API.
- [ ] Step 3: Xác nhận: 7 hàng mã `MAU-*`, mọi `product_stock.stock > 0`, 7 dòng `product_costs`.

### Task 3: Bán thử trọn luồng trên bản thật

**Files:** Create `hl-pos/tests/e2e/ban-thu.mjs` (không nằm trong `npm test`).

**Interfaces – Consumes:** hàng mẫu Task 2. **Produces:** ảnh/PDF trong scratchpad gửi Hiếu: `hoa-don-A5.pdf`, `ban-hang.png`, `don-noi-that.png`, `bao-cao.png`.

Kịch bản (tài khoản chủ thử + 1 nhân viên thử tạo qua app), mỗi dòng là một kiểm tra in `PASS/FAIL`:

- [ ] Step 1: Viết script theo kịch bản dưới; chạy.
  1. **Nhân viên bán lẻ đúng 4 chạm:** chạm `MAU-TAB01` → chạm `MAU-KE01` → chạm **Chuyển khoản** → chạm **Thanh toán**; tới `/hoa-don/…`, thấy `HD000001`, tổng `1.650.000 đ`.
  2. **Giảm giá:** hóa đơn thứ hai `MAU-GHE01` ×2, giảm `50.000` → tổng `650.000 đ`.
  3. **Kho tự trừ:** DB: tồn `MAU-TAB01` = 9, `MAU-KE01` = 9, `MAU-GHE01` = 8.
  4. **Bán quá tồn bị chặn trên giao diện:** đặt SL `MAU-BTP01` = 11 → nút Thanh toán khóa, hiện "Không đủ tồn kho".
  5. **Hóa đơn A5:** `page.pdf({ preferCSSPageSize: true })` của hóa đơn 8 dòng (bán thêm 1 hóa đơn đủ 7 món + 1 món lặp không tính – dùng 7 dòng) → PDF 1 trang, khổ 148×210 mm (đọc MediaBox), có tên cửa hàng + SĐT `0916.771.586`.
  6. **Ảnh Zalo:** bấm "Gửi ảnh Zalo" (trình duyệt máy tính không có share) → có sự kiện download file `HD….png` > 10 KB.
  7. **Nhân viên không thấy giá vốn:** trang Hàng hóa của nhân viên không chứa chữ "vốn"; gọi REST `product_costs` bằng phiên nhân viên trả `[]`.
  8. **Đơn nội thất:** tạo đơn `30.000.000` (mặc định 9/12/9 triệu) → đánh dấu **Cọc** đã thu → hiện "Còn nợ 21.000.000 đ" → đổi tiến độ **Sản xuất** → thêm vật tư `MAU-MDF17` ×3 → DB tồn MDF = 27.
  9. **Báo cáo (chủ):** "Tháng này" hiện Doanh thu bán lẻ = tổng 3 hóa đơn, Lợi nhuận = doanh thu − giá vốn (tính lại từ seed trong script), Thu từ đơn nội thất `9.000.000 đ`, Khách còn nợ `21.000.000 đ`.
  10. **Xuất Excel:** bấm nút → download `HL-POS-sao-luu-YYYY-MM-DD.xlsx`, mở bằng exceljs có 7 sheet, sheet "Hóa đơn" 3 dòng dữ liệu.
  11. **Mất mạng:** `context.setOffline(true)` → hiện thanh đỏ "Mất mạng", nút Thanh toán khóa; bật lại → hết.
- [ ] Step 2: FAIL nào do **app** sai → dùng superpowers:systematic-debugging, viết test tái hiện trong `npm test` (DB hoặc lib), sửa, push, chạy lại. FAIL do **script** sai → sửa script.
- [ ] Step 3: Toàn PASS → xóa tài khoản thử (kiểm tra `auth.users` chỉ còn tài khoản Hiếu), commit 2 script e2e, gửi Hiếu 4 file ảnh/PDF. **Giữ lại** hàng mẫu + hóa đơn thử để Hiếu tự bấm thử trên điện thoại.

### Task 4: Dọn dữ liệu thử (chỉ sau khi Hiếu đồng ý)

- [ ] Step 1: Hỏi Hiếu: "Đã thử xong chưa, tôi xóa dữ liệu mẫu nhé?" – **chờ trả lời**.
- [ ] Step 2: Chạy `supabase/xoa-du-lieu-mau.sql`.
- [ ] Step 3: Xác nhận: `products`, `sales`, `interior_orders`, `stock_movements` đều 0 dòng; `nextval` thử trong transaction rollback cho `sale_code_seq` và `order_code_seq` = 1; `profiles` còn nguyên; `store_settings` còn nguyên.

### Task 5: Cập nhật hướng dẫn theo thực tế

**Files:** Modify `hl-pos/README.md`.

- [ ] Step 1: Thay mục "Bước 4 – Đưa app lên mạng" (Vercel) bằng các bước Netlify đã làm thật: import repo + chọn nhánh, 3 biến môi trường, **Project visibility → Applies to: Previews only**, link chính thức. Giữ một dòng ghi chú Vercel Hobby không dùng thương mại.
- [ ] Step 2: Thêm mục "Thêm nhân viên": Cài đặt → Tạo tài khoản → gửi link + email/mật khẩu → nhân viên cài app lên màn hình.
- [ ] Step 3: Ghi vùng Supabase thực tế (Sydney) và link app. Commit + push.
- [ ] Step 4: Nhắc Hiếu xóa 2 mã truy cập tạm (Supabase `claude-tam`, Netlify) – mã Netlify đã lộ trong chat nên phải xóa.
