# HL POS – Đơn nội thất như Sổ Nội Thất: kế hoạch triển khai

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Thay phần đơn nội thất của HL POS bằng mô hình báo giá → chốt → thu tiền → phát sinh → nghiệm thu → sổ sách của Sổ Nội Thất, và nhập được dữ liệu cũ.

**Architecture:** Giữ kiến trúc bản đầu: Postgres (Supabase) giữ quy tắc và quyền, mọi ghi đi qua RPC một giao dịch; báo giá (nháp và bản chốt) là tài liệu JSON do RPC kiểm tra và tự tính tổng; phiếu thu, phát sinh, sổ thu chi, nhật ký là bảng. Phép tính tiền của đơn nằm ở một mô-đun TypeScript `orderMoney` chép quy tắc Sổ Nội Thất; DB có view tổng hợp cho báo cáo, có test so khớp.

**Tech Stack:** Next.js 16, Tailwind 4, Supabase, Vitest + pg (Postgres 16 cục bộ), `qrcode` (vẽ QR), html-to-image, exceljs, Playwright (kiểm thử bản thật).

**Spec:** `docs/superpowers/specs/2026-11-12-hl-pos-don-noi-that-design.md`. Nguồn đối chiếu: nhánh `origin/so-noi-that` (`parts/core.js`, `orders.js`, `profit.js`, `ledger.js`, `cash.js`, `qr.js`, `test/money.test.js`).

## Global Constraints

- Tiền: số nguyên đồng (`bigint`). Số lượng: `numeric`, tối đa 3 số lẻ.
- 2 vai trò `owner`/`staff`; mọi policy đọc dùng `is_member()`; giá nhập, lãi, sổ thu chi, cộng sổ, doanh thu: chỉ `is_owner()`.
- Không tin số tiền từ trình duyệt: RPC tự tính `sub/disc/total` khi chốt.
- Bản đã chốt không sửa được. Phiếu thu chỉ chủ xóa. Đơn chỉ xóa khi đang báo giá và chưa có phiếu thu.
- Mã đơn `BG<yy><mm>-<NN>` (tiền tố ở Cài đặt, mặc định `BG`); phiếu thu `PT-<mã đơn>-<NN>`; nội dung CK `<memo_prefix> <mã đơn> D<đợt>` (mặc định `HL`).
- Đơn vị: `m²`, `md`, `bộ`, `cái`, `gói`, `cánh`, `điểm`, `công`. Trạng thái đơn: `quote`/`closed`/`building`/`done`. Mốc đợt: `sign`/`progress`/`accept`/`date`. Hình thức: `transfer`/`cash`.
- Mặc định: bảo hành 36 tháng, nhắc gọi lại 3 ngày, lịch 3 đợt 50/40/còn lại.
- Ngày "hôm nay" theo giờ Việt Nam (`Asia/Ho_Chi_Minh`) ở cả DB và trình duyệt.
- Giao diện tiếng Việt, tông trắng – sữa – nâu; dùng các lớp `btn-*`, `input`, `card`, `chip`, `Modal`, `MoneyInput` sẵn có.
- Bản thật: app `https://profound-taiyaki-e22af3.netlify.app`, Supabase ref `jqcgaalecfjfibqyglkz`. Migration mới chạy qua Management API; mỗi migration cũng phải được nối vào `supabase/cai-dat-mot-lan.sql` (test bundle sẵn có ép điều này).
- Tài khoản thử `kiemthu-*@hlpos.test` luôn bị xóa sau kiểm thử. Không in khóa bí mật.
- Sau mỗi task: `npm test`, `npm run lint`, `npm run build` sạch; commit; cuối mỗi giai đoạn push + kiểm thử bản thật.
- Không làm: 4 vai trò, sale chỉ thấy đơn mình, "báo đã thu chờ xác nhận", phân công thợ, offline, gộp khi sửa cùng lúc, demo, cảnh báo thuế.

## Review Focus

1. Hai người lưu cùng một nháp: người sau phải bị từ chối với thông báo tải lại, không ghi đè (T1.1 test `rev`).
2. Hai người thu tiền / tạo đơn cùng lúc: số phiếu và mã đơn không trùng (T1.1 test song song).
3. Thu tiền nhiều hơn còn nợ: cho phép (Sổ Nội Thất có "trả thừa") nhưng hiện rõ "Trả thừa X đ" (T1.2, T1.4).
4. Lịch thanh toán mà các đợt trước ≥ 100% hoặc ≥ giá trị: cảnh báo, không chặn lưu nháp, **chặn chốt** (T1.1).
5. Xóa phiếu thu ở giữa: số phiếu các phiếu còn lại không đổi; phiếu mới lấy số max+1 (T1.1).
6. Phát sinh giảm lớn hơn giá trị đơn: tổng không âm trong hiển thị đợt (quy tắc trừ lùi), còn nợ = 0, hiện trả thừa (T1.2, T2.1).
7. File sao lưu Sổ Nội Thất thiếu trường / định dạng cũ / có đơn demo / nhập lần 2: không trùng, không vỡ, báo rõ dòng bỏ qua (T3.5).
8. Ảnh lớn từ điện thoại: thu nhỏ trước khi tải; lỗi tải lên không làm mất ghi chú đang nhập (T2.3).

---

## Cấu trúc file

```
hl-pos/supabase/migrations/
  0006_orders_v2.sql     bỏ đơn kiểu cũ; customers, cài đặt mới, orders, order_quotes, order_payments, order_log; RPC báo giá/chốt/thu
  0007_reports_v2.sql    báo cáo + export_all theo dữ liệu mới
  0008_after_close.sql   revise, order_changes, handover, notes, attachments
  0009_books.sql         catalog(+costs), order_costs, giá vốn phiếu xuất, cash_entries, chốt sổ, doanh thu
  0010_import.sql        legacy_id + import_snt()
hl-pos/supabase/storage.sql        bucket + policy ảnh (chỉ chạy trên Supabase thật)
hl-pos/src/lib/
  orderMoney.ts (+test)  quoteTotals, planAmounts, orderMoney, dimsQty, dimText, moneyWords, valueEvents
  vietqr.ts (+test)      chuỗi VietQR + CRC16
  ordersApi.ts           đọc/ghi đơn qua Supabase (map dữ liệu DB → kiểu Order của orderMoney)
  profit.ts (+test)      profitOf
  ledger.ts (+test)      ledger, accrual
  importSnt.ts (+test)   readBackup, đổi file sao lưu → payload import
hl-pos/src/components/orders/   QuoteEditor, PlanEditor, PaymentForm, VietQr, SignPad, ChangeForm, HandoverForm, PrintSheet (khung A4 + nút In/Ảnh)
hl-pos/src/app/(app)/don-noi-that/        page (Hôm nay + danh sách), [id]/page, [id]/sua/page (soạn nháp)
hl-pos/src/app/(app)/in/                  bao-gia/[id], phieu-thu/[id], nghiem-thu/[id]
hl-pos/src/app/(app)/danh-muc, so-thu-chi, cong-so
hl-pos/tests/db/orders2.test.ts, after_close.test.ts, books.test.ts, import.test.ts
hl-pos/tests/e2e/*.mjs                    kiểm thử bản thật (không nằm trong npm test)
```

Kiểu dữ liệu dùng chung (định nghĩa trong `orderMoney.ts`, mọi task dùng đúng tên này):

```ts
type Unit = 'm²'|'md'|'bộ'|'cái'|'gói'|'cánh'|'điểm'|'công';
type Dims = { a: number; b: number; n: number; u: 'mm'|'cm'|'m' };
type QuoteRow = { id: string; name: string; material: string; unit: Unit; qty: number; price: number; dims: Dims | null };
type PlanRow = { id: string; label: string; pct: number; trigger: 'sign'|'progress'|'accept'|'date'; fixed?: boolean; amt?: number; due?: string; reached?: boolean };
type Quote = { date: string; customer: { name: string; phone: string; address: string }; project: string; rows: QuoteRow[];
  discount: { type: 'percent'|'amount'; value: number }; note: string; terms: string; validUntil: string; plan: PlanRow[] };
type Version = { no: number; quote: Quote; sub: number; disc: number; total: number; closedAt: string; sign: SignRecord | null };
type SignRecord = { img: string; name: string; at: string; hash: string };
type Payment = { id: string; no: number; amount: number; date: string; method: 'transfer'|'cash'; note: string; deposit: boolean };
type Change = { id: string; sign: 1|-1; title: string; amount: number; reason: string; note: string; status: 'pending'|'confirmed'|'cancelled'; confirmedAt: string | null; signRec: SignRecord | null };
type Order = { id: string; code: string; status: 'quote'|'closed'|'building'|'done'; draft: Quote | null; versions: Version[]; plan: PlanRow[];
  payments: Payment[]; changes: Change[]; handover: { date: string; warrantyMonths: number; warrantyUntil: string; note: string; sign: SignRecord | null } | null; closedAt: string | null };
```

---

## GĐ 0 – Hoàn thiện bản đầu

### Task 0.1: Menu điện thoại không bị nút Netlify che
Theo Task 1 của `2026-11-12-hl-pos-hoan-thien.md` (menu điện thoại lên đầu trang, `tests/e2e/nav-overlap.mjs` FAIL trước → PASS sau trên bản thật).

### Task 0.2: Bán thử bán lẻ + kho trên bản thật
Theo Task 2–3 của kế hoạch trên, **bỏ** mục 8 (đơn nội thất kiểu cũ) và phần đơn trong mục 9. Giữ hàng mẫu lại cho các giai đoạn sau.

## GĐ 1 – Báo giá → chốt → thu tiền

### Task 1.1: Cơ sở dữ liệu đơn mới (0006)

**Files:** `supabase/migrations/0006_orders_v2.sql`, `tests/db/orders2.test.ts`; xóa `tests/db/orders.test.ts`; sửa `tests/db/reports.test.ts`, `seed.test.ts`, `auth.test.ts`, `xoa-du-lieu-mau.sql` cho tên bảng mới; cập nhật `cai-dat-mot-lan.sql`.

**Produces:**
- Bỏ: `report_order_debts`, `report_revenue`, `export_all` (tạo lại ở 0007 — trong 0006 tạo lại bản tối thiểu để test cũ không gãy giữa chừng thì **không**: 0006 và 0007 làm liền nhau, test báo cáo sửa ở 1.5), `order_balances`, `order_payments`, `interior_orders`, các RPC đơn cũ.
- `customers(id, name, phone, address, note, created_at)`; unique theo `phone` khi phone ≠ ''.
- `store_settings` thêm: `tagline` ('Thiết kế – thi công nội thất trọn gói'), `email`, `logo`, `bank_name`, `bank_bin`, `bank_account`, `bank_holder`, `memo_prefix` ('HL'), `default_note`, `default_terms`, `code_prefix` ('BG'), `warranty_months` (36), `plan_template jsonb`, `follow_days` (3), `cash_start_date`, `cash_start_amount`.
- `orders(id, code unique, customer_id, project, status, closed_at date, follow_at date, plan jsonb default '[]', handover jsonb, rev int default 1, created_by, created_at, updated_at)`.
- `order_quotes(id, order_id, version_no int null, quote jsonb, sub, disc, total bigint, closed_at date, sign jsonb, created_at)`; unique `(order_id) where version_no is null` (một nháp); unique `(order_id, version_no)`.
- `order_payments(id, order_id, no int, amount > 0, date, method, note, deposit bool, created_by, created_at)`; unique `(order_id, no)`.
- `order_log(id, order_id, at, by uuid, text)`.
- `stock_movements.order_id` trỏ sang `orders`.
- Hàm `quote_totals(q jsonb) returns table(sub bigint, disc bigint, total bigint)` – đúng quy tắc 5.1–5.2.
- Hàm `vn_today() returns date`.
- View `order_totals(order_id, base, changes, total, paid, due, over)` (security_invoker; `changes` = 0 cho tới 0008).
- RPC (đều `require_login()`, ghi `order_log`):
  - `save_quote_draft(p_order_id uuid, p_quote jsonb, p_rev int) returns jsonb` → `{order_id, code, rev}`. `p_order_id` null = tạo đơn mới (cấp mã). Kiểm tra: tên khách không rỗng; mỗi dòng `unit` hợp lệ, `qty ≥ 0`, `price ≥ 0`; giảm giá hợp lệ; `p_rev` khác `orders.rev` → lỗi `Báo giá vừa được người khác sửa, hãy tải lại`. Tự tạo/cập nhật `customers` theo SĐT. Đơn đã chốt mà chưa có nháp → lỗi (nháp bản sửa tạo bằng `revise_order` ở 0008).
  - `close_order(p_order_id, p_date date, p_deposit bigint, p_method text, p_sign jsonb) returns jsonb` → `{version_no, total}`. Bỏ dòng rỗng; không còn dòng → lỗi `Báo giá chưa có hạng mục`; lịch có đợt cuối ≤ 0 → lỗi `Các đợt trước đã chiếm hết giá trị đơn`; tính tổng; nháp → bản `no` kế tiếp; `orders.plan` = lịch của bản (giữ `due`/`reached` của đợt cùng `id`); lần đầu: `status='closed'`, `closed_at`, cọc > 0 → phiếu thu số 1 `deposit=true`, ghi chú `Đặt cọc khi chốt đơn`.
  - `add_payment(p_order_id, p_amount bigint, p_date date, p_method text, p_note text, p_deposit bool) returns jsonb` → `{id, no}`; chỉ đơn đã chốt; `no` = max+1 (khóa dòng đơn).
  - `delete_payment(p_id)` – chỉ chủ.
  - `set_order_status(p_order_id, p_status)` – không quay về `quote`; đơn `quote` không đổi tay được.
  - `set_plan_row(p_order_id, p_plan_id text, p_due date, p_reached bool)`.
  - `set_follow_at(p_order_id, p_date date)`.
  - `delete_order(p_order_id)` – chỉ chủ, chỉ `quote` và 0 phiếu thu.
  - `add_order_material(p_order_id, p_product_id, p_quantity)` – như cũ, lý do `Vật tư đơn <mã>`.
- Cấp mã: `BG<yy><mm>-<NN>` theo tháng VN của ngày tạo, NN = số lớn nhất cùng tiền tố + 1 (khóa advisory theo tiền tố), tối thiểu 2 chữ số.

**Test (`orders2.test.ts`)** – tên và khẳng định chính:
- `tạo nháp cấp mã BG2611-01, lần hai BG2611-02` (đặt `now` bằng cách chèn đơn trước).
- `lưu nháp tự tạo khách theo SĐT, lưu lại không tạo trùng`.
- `rev cũ bị từ chối với thông báo tải lại`.
- `quote_totals: 2×1.000.000 + 1,5×2.000.000, giảm 10% → sub 5.000.000, disc 500.000, total 4.500.000; giảm tiền 6.000.000 bị kẹp về sub`.
- `chốt: khóa bản 1, status closed, cọc thành phiếu số 1, total do máy chủ tính (gửi kèm total giả trong JSON không ảnh hưởng)`.
- `chốt báo giá rỗng / lịch đợt cuối ≤ 0 bị từ chối`.
- `sau chốt không lưu nháp đè, không sửa order_quotes trực tiếp`.
- `thu tiền: số phiếu 1,2,3; xóa phiếu 2 (chủ) → phiếu mới là 4; nhân viên xóa bị từ chối`.
- `hai người thu tiền cùng lúc: hai số phiếu khác nhau`; `hai người tạo đơn cùng lúc: hai mã khác nhau`.
- `order_totals: total 4.500.000, thu 2.000.000 → due 2.500.000; thu 5.000.000 → due 0, over 500.000`.
- `đổi trạng thái hợp lệ; quay về quote bị từ chối`.
- `xóa đơn: chủ xóa đơn nháp được; đơn có phiếu thu không xóa được`.
- `người lạ không đọc được orders/order_quotes/order_payments/customers; khách vãng lai bị từ chối`.
- `vật tư: trừ kho, phiếu gắn đơn mới`.
- `nhật ký ghi chốt đơn và thu tiền kèm người làm`.

- [ ] Viết test → FAIL → viết 0006 → PASS → cập nhật bundle + file xóa dữ liệu mẫu → `npm test` (các test báo cáo cũ tạm gãy được sửa ở 1.5: **làm 1.5 phần DB ngay sau 1.1 trước khi commit**).

### Task 1.5a (làm liền sau 1.1): Báo cáo theo dữ liệu mới (0007)
`report_revenue` giữ chữ ký, `order_collected` lấy từ `order_payments.date`; `report_order_debts()` trả `(order_id, code, customer_name, phone, status, total_value, paid_total, remaining)` từ `order_totals` (đơn đã chốt, `due > 0`); `export_all()` thay 2 khóa đơn cũ bằng `khach_hang`, `don_noi_that`, `bao_gia_dong`, `phieu_thu`. Sửa `reports.test.ts` tương ứng. Commit chung với 1.1.

### Task 1.2: `orderMoney.ts`

**Produces** (đúng tên): `rowAmount(r)`, `quoteTotals(q) → {sub, disc, total}`, `planAmounts(plan, total)`, `planOver(plan, total)`, `planWarnText(plan, total)`, `orderTotal(o)`, `orderPaid(o)`, `orderMoney(o, opts?: {quote?, plan?, pays?, today?}) → {base, chg, total, paid, due, over, rows, next}` (mỗi row thêm `n, last, amount, paid, left, state: 'paid'|'overdue'|'due'|'later'`), `dimsQty(unit, d)`, `dimText(unit, d)`, `moneyWords(n)`, `receiptNo(code, no)`, `PLAN_PRESETS`, `DEFAULT_PLAN`, `TRIGGERS`, `STATUS`, `UNITS`, `vnToday()`.

- [ ] Chuyển `origin/so-noi-that:test/money.test.js` thành `orderMoney.test.ts` (giữ nguyên từng ca và số), thêm ca Review Focus 3, 6 → FAIL → chép logic từ `core.js` dòng 127–233, 291–306, 49–88 (đổi sang kiểu ở trên; `today` truyền vào để test được) → PASS.
- [ ] Test so khớp DB: `tests/db/orders2.test.ts` thêm `order_totals khớp orderMoney trên 3 đơn mẫu`.

### Task 1.3: VietQR

**Produces:** `vietQrPayload({bin, account, amount, memo}) → string` (EMVCo: 000201, 010212, mục 38 với AID `A000000727`, dịch vụ `QRIBFTTA`, 5303704, 54 số tiền, 5802VN, 62/08 nội dung bỏ dấu ≤ 50 ký tự, 6304 + CRC16-CCITT); `memoFor(prefix, code, n)`; component `VietQr` vẽ bằng `qrcode`.
- [ ] Test với chuỗi mẫu tính từ `parts/qr.js` của Sổ Nội Thất (chạy hàm gốc bằng node để lấy giá trị kỳ vọng cho 3 bộ dữ liệu) → FAIL → code → PASS.

### Task 1.4: Giao diện GĐ 1
`ordersApi.ts`: `listOrders()`, `getOrder(id): Order & meta`, `saveDraft`, `closeOrder`, `addPayment`, `deletePayment`, `setStatus`, `setPlanRow`.
Màn: danh sách (lọc + Cần thu), soạn nháp (`QuoteEditor` + `PlanEditor`, tự lưu sau 800 ms ngừng gõ, hiện "Đã lưu"/"Đang lưu…"/lỗi), chốt đơn (Modal), trang đơn (tiền + đợt + VietQR + thu tiền + tiến độ + vật tư + các bản chốt + nhật ký), `in/bao-gia/[id]?ban=<no|nhap>`, `in/phieu-thu/[id]`; Cài đặt thêm khối ngân hàng, mẫu lịch, điều khoản, tiền tố. `PrintSheet`: khung A4 (`210mm`), nút In và Gửi ảnh Zalo dùng chung; đổi `@page` thành A5 chỉ cho hóa đơn bán lẻ (named page).
- [ ] Build + lint sạch. Kiểm bằng mắt qua ảnh chụp ở 1.6.

### Task 1.6: Lên bản thật + chạy thử
- [ ] Xuất Excel sao lưu (qua RPC) → chạy 0006, 0007 lên Supabase thật → push → đợi Netlify.
- [ ] `tests/e2e/gd1.mjs`: nhân viên tạo báo giá 3 dòng (1 dòng nhập kích thước 2400×600 mm ×2 → 2,88 m²), giảm 5%, lịch 3 đợt → in báo giá ra PDF 1 trang A4 có tổng và 3 đợt → chốt, cọc 50% chuyển khoản → trang đơn hiện đợt 1 Đã thu, đợt 2 Chưa đến hạn → đổi Đang thi công → đợt 2 Đến hạn, có QR → thu đợt 2 → phiếu thu `PT-…-02` in PDF → báo cáo chủ: Thu từ đơn, Khách còn nợ đúng số. Mọi số so với `orderMoney` tính trong script.
- [ ] Gửi Hiếu ảnh + PDF. Báo kết quả GĐ 1.

## GĐ 2 – Sau khi chốt (0008)

### Task 2.1: DB
- `revise_order(p_order_id) returns jsonb {rev}`: đơn đã chốt, chưa có nháp → nháp = bản chốt cuối với `id` dòng mới (trả kèm `id_map`), lịch = `orders.plan` hiện hành.
- `close_order` chốt bản ≥ 2: không đổi status, ghi nhật ký `Chốt bản N: A → B`.
- `order_changes(id, order_id, sign, title, amount > 0, reason, note, status, confirmed_at date, sign_rec jsonb, created_by, created_at)`; RPC `add_change`, `confirm_change(p_id, p_date, p_sign jsonb)`, `cancel_change(p_id)` (đã xác nhận rồi thì chỉ chủ hủy được).
- `order_totals.changes` = tổng phát sinh đã xác nhận.
- `set_handover(p_order_id, p_date, p_warranty_months int, p_note, p_sign jsonb)`: tính `warrantyUntil` (cộng tháng, kẹp cuối tháng), `status='done'`.
- `order_notes(id, order_id, text, created_by, created_at)` + `add_note`, `delete_note` (người viết hoặc chủ).
- `order_attachments(id, order_id, path, name, stage, created_by, created_at)` + `add_attachment`, `delete_attachment`; `storage.sql`: bucket riêng tư `don-hang`, policy đọc/ghi cho `is_member()`.
- Test `after_close.test.ts`: bản sửa 2 đổi tổng, bản 1 còn nguyên; đang có nháp thì `revise_order` lần hai bị từ chối; phát sinh chờ không đổi `order_totals`, xác nhận +2.400.000 đổi, hủy trả lại; nhân viên không hủy được phát sinh đã xác nhận; nghiệm thu 31/08 + 6 tháng → 28/02 (hoặc 29/02 năm nhuận), status done; ghi chú/đính kèm: người lạ không đọc.

### Task 2.2: Chữ ký
`SignPad` (canvas, chuột + chạm, nút Xóa, `toDataURL()` PNG ≤ 600×240), `makeSignRecord(img, name, content) → SignRecord` (SHA-256, 16 ký tự hoa) trong `orderMoney.ts` + test băm ổn định. Dùng ở chốt, xác nhận phát sinh, nghiệm thu; in trên giấy tờ.

### Task 2.3: Giao diện GĐ 2
Trang đơn thêm: Sửa báo giá (bản mới), danh sách bản + in bản cũ (đóng dấu "Đã được thay bằng bản N", `pays:false`), phát sinh, nghiệm thu + `in/nghiem-thu/[id]`, ghi chú, ảnh (thu nhỏ ≤ 2000 px bằng canvas trước khi tải; lỗi tải giữ nguyên form), nhật ký.

### Task 2.4: Lên bản thật + `tests/e2e/gd2.mjs`
Bản sửa thêm 1 dòng → chốt bản 2; phát sinh +2.400.000 chờ → tổng chưa đổi → xác nhận có chữ ký → tổng tăng, đợt cuối tăng; nghiệm thu → biên bản PDF có hạn bảo hành; tải 1 ảnh. Chạy `storage.sql` trên bản thật trước. Báo kết quả GĐ 2.

## GĐ 3 – Sổ sách và chuyển dữ liệu

### Task 3.1: DB (0009)
- `catalog(id, name unique (không phân biệt hoa thường), material, unit, price, created_at)` đọc: thành viên; ghi: RPC `save_catalog_item`, `delete_catalog_item` (chủ). `catalog_costs(catalog_id, cost, at)` chỉ chủ.
- `order_costs(order_id pk, rows jsonb, chg jsonb, ship bigint)` chỉ chủ; RPC `save_order_costs`. `close_order` chụp giá nhập danh mục (khớp tên dòng) vào `rows` cho dòng chưa có.
- `stock_movement_costs(movement_id pk, unit_cost)` chỉ chủ; `_move_stock` ghi giá vốn lúc xuất/nhập.
- `cash_entries(id, type in/out, date, amount > 0, cat, note, method, order_id null, created_by, created_at)` chỉ chủ; RPC `save_cash_entry`, `delete_cash_entry`; sửa/xóa khoản trong tháng đã chốt cần `p_confirm = true`.
- `books(month text pk 'YYYY-MM', in_total, out_total, closed_at, closed_by)`; RPC `close_book(p_month)`, `reopen_book(p_month)`.
- RPC chỉ chủ `ledger_data(p_from date, p_to date) returns jsonb`: `{cash: [...], payments: [...], retail: [{date, amount}] theo ngày VN, start: {date, amount}, books: {...}}`; `orders_for_books() returns jsonb`: đơn đã chốt kèm versions (no, total, closedAt), changes đã xác nhận, costs, chi gắn đơn, giá vốn vật tư xuất kho.
- Test `books.test.ts`: quyền (nhân viên bị chặn mọi thứ ở trên, vẫn đọc `catalog`); chụp giá nhập khi chốt rồi đổi danh mục không đổi `order_costs`; giá vốn phiếu xuất được lưu; sửa khoản tháng đã chốt không `p_confirm` bị từ chối.

### Task 3.2: `profit.ts`, `ledger.ts`
- `profitOf(order, costs, catalogCosts) → {rev, goods, chgCost, ship, cost, profit, pct, missing, any}` (quy tắc 5.11).
- `valueEvents(order)` (5.13). `ledger(months, data) → [{m, open, in, inCust, inRetail, inOther, capital, income, out, profit, pct, close, cats, book, changed}]` (5.14, thêm `inRetail`). `accrual(months, orders, cash)`: doanh thu theo `valueEvents`, chi phí đơn = thực (chi gắn đơn + vật tư kho) nếu > 0, không thì ước tính; `orderCostInfo → {cost, kind: 'real'|'est'|'none'}`.
- Test chuyển các ca tương ứng từ `test/` của Sổ Nội Thất nếu có, thêm: tháng có góp vốn không tính vào lãi; tồn cuối tháng này = tồn đầu tháng sau; đơn chốt T10 sửa bản T11 → doanh thu chia đúng 2 tháng.

### Task 3.3: Giao diện sổ sách
`danh-muc` (mọi người xem; chủ sửa, thấy giá nhập); gợi ý danh mục trong `QuoteEditor`; khối Lãi trên trang đơn (chủ); `so-thu-chi`; `cong-so` (12 tháng, chi theo nhóm, chốt sổ, lãi theo đơn chốt); Nav: thêm "Sổ sách" (chủ) gom Sổ thu chi · Cộng sổ · Báo cáo · Danh mục để thanh menu không quá 5 mục.

### Task 3.4: Hôm nay
Đầu trang Đơn nội thất: Quá hạn / Đến hạn (tổng tiền, bấm vào đơn), Cần gọi lại (đơn `quote` có `follow_at ≤ hôm nay`, hoặc chưa đặt và ngày báo giá + `follow_days` ≤ hôm nay; nút "Đã gọi, hẹn lại" đặt `follow_at`), Sắp hết bảo hành 30 ngày. Logic chọn lọc là hàm thuần `todayLists(orders, settings, today)` trong `orderMoney.ts` + test.

### Task 3.5: Nhập từ Sổ Nội Thất (0010)
- `orders.legacy_id`, `customers.legacy_id`, `catalog.legacy_id`, `cash_entries.legacy_id`, `order_payments.legacy_id`, `order_changes.legacy_id` (unique khi không null).
- `importSnt.ts`: `readBackup(raw) → {cols} | null` (2 định dạng), `toImportPayload(cols) → {customers, orders, catalog, cash, costs, skipped: [{kind, id, why}]}` (bỏ `demo`, liệt kê `payReqs` còn `pending`, ảnh không có dữ liệu), `compare(payload, importedOrders) → [{code, field, file, app}]` dùng `orderMoney` trên cả hai phía.
- RPC chỉ chủ `import_snt(p jsonb) returns jsonb {created: {...}, updated: {...}}`: ghi thẳng (giữ mã đơn, số phiếu, ngày, versions kèm `sub/disc/total` tính lại bằng `quote_totals` — lệch với số trong file thì vẫn nhập và trả về trong `mismatch`), upsert theo `legacy_id`.
- Màn Cài đặt → "Nhập từ Sổ Nội Thất": chọn file → xem trước số lượng + `skipped` → Nhập → bảng đối chiếu.
- Test `importSnt.test.ts` (file mẫu dựng theo `demo` data builder của `ui.js` dòng ~1220–1260 và định dạng cũ) + `import.test.ts` (nhập 2 lần không trùng; tổng/đã thu/còn nợ khớp; nhân viên bị chặn).

### Task 3.6: Lên bản thật + `tests/e2e/gd3.mjs` + tài liệu
Chạy 0009, 0010; e2e: danh mục → báo giá gợi ý → chốt → lãi đơn; ghi 2 khoản chi (1 gắn đơn) → cộng sổ tháng đúng số; nhập file sao lưu mẫu → bảng đối chiếu không lệch → xóa dữ liệu nhập thử. Cập nhật `README.md` (Netlify, thêm nhân viên, các màn mới, cách chuyển dữ liệu). Hỏi Hiếu trước khi xóa dữ liệu thử; nhắc xóa các mã truy cập tạm.
