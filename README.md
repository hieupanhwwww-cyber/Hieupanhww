# Plugin SketchUp — Nội Thất Hùng Loan

Repo có 2 extension độc lập:

| Extension | File cài | Mô tả |
|---|---|---|
| **Tủ Module Hùng Loan** (mới) | `dist/hl_tumodule.rbz` | Dựng/sửa tủ bằng thư viện module, ghép bộ tủ, dữ liệu gia công |
| Tạo Ván (cũ, giữ nguyên) | `dist/hieupanhww_taovan.rbz` | Tạo ván từ mặt |

> **Trạng thái kiểm thử — đọc trước khi dùng:** môi trường xây dựng **không có SketchUp và không có ABF**.
> Lõi tính toán đã kiểm thử thuần Ruby; lớp SketchUp mới chạy trên **API giả lập**. Plugin **chưa được chạy trong SketchUp thật**
> và **chưa kiểm chứng ABF/Nesting đọc được**. Chi tiết: `TEST_REPORT.md`.

---

# Tủ Module Hùng Loan — Hướng dẫn sử dụng

## 1. Cài đặt
1. SketchUp → **Extensions › Extension Manager › Install Extension**.
2. Chọn `dist/hl_tumodule.rbz` → đồng ý → khởi động lại SketchUp nếu được hỏi.
3. Menu **Extensions › Tủ Module Hùng Loan** và thanh công cụ cùng tên xuất hiện.

Phiên bản nhắm tới: SketchUp 2021 trở lên (Windows/macOS). Chưa kiểm thử trên host thật.

## 2. Thư viện module
Mở **Thư viện module** (biểu tượng 4 ô).
- **Cây thư mục bên trái**, **thẻ mẫu bên phải**. Bấm ▸/▾ để mở/đóng thư mục con.
- **Thêm thư mục**: nút “＋ Thư mục” (tạo con của thư mục đang chọn), hoặc **chuột phải thư mục → Thêm thư mục con / Đổi tên / Xóa**. Xóa thư mục không xóa mẫu, setting hay tủ đã đặt.
- **Thêm mẫu vào thư mục**: **chuột phải thẻ mẫu → Thêm vào thư mục → chọn thư mục**. Một mẫu có thể nằm ở nhiều thư mục; mọi nơi dùng chung một bộ setting. Thêm lại không tạo bản trùng.
- **Bỏ mẫu khỏi thư mục**: chuột phải thẻ → “Bỏ khỏi thư mục …” — chỉ bỏ khỏi đúng thư mục đó. Khi đang lọc, menu bắt bạn chọn rõ thư mục cần bỏ.
- **Lọc loại**: ô “Lọc loại” ở trên. Lọc trên **toàn bộ thư viện**, không phụ thuộc thư mục đang chọn; mỗi mẫu hiện một lần. Bấm “Xóa lọc” để về tất cả.
- Thư viện **chỉ hiện mẫu đã làm thông minh**.

## 3. Bánh răng ⚙ — setting riêng từng mẫu
- Bấm **⚙ dưới thẻ mẫu** → hộp setting nổi, ghi rõ tên/ảnh/ID mẫu đang chỉnh. Bấm bánh răng **không** khởi động lệnh đặt.
- Sửa nhiều ô → **Lưu setting** (lưu một lần, ô sai báo đỏ ngay tại chỗ, không lưu).
- Setting chỉ dùng cho **các lần đặt mới** của mẫu đó. Tủ đã đặt giữ nguyên. Được nhớ sau khi tắt/mở SketchUp.
- **Khôi phục setting gốc**: nạp số gốc vào hộp để xem/chỉnh; chỉ khi bấm **Lưu setting** mới thay. **Đóng** = không lưu.

## 4. Xuất/nhập sao lưu thư viện
- **Xuất sao lưu**: lưu file `.json` gồm cây thư mục, quan hệ thư mục–mẫu và setting từng mẫu (dùng khi đổi máy/cài lại).
- **Nhập sao lưu**: plugin kiểm tra **toàn bộ file** trước; hợp lệ thì **THAY TOÀN BỘ** setting và cây thư mục hiện tại (không gộp). File lỗi → báo lý do, giữ nguyên cấu hình đang dùng. Tủ đã đặt không bị đổi.

## 5. Đặt module
1. Bấm thẻ mẫu → rê chuột trong vùng vẽ: thấy khung xem trước màu nâu + điểm bám (chấm xanh).
2. **Tab** hoặc **← / →**: xoay 90° (quanh trục đứng qua điểm bám).
3. Click → đặt. Đặt xong **lệnh kết thúc**; muốn đặt tiếp, bấm lại thẻ mẫu.
- Khung đỏ + chữ lỗi = kích thước không hợp lệ, chưa đặt được.

### Lắp một bộ tủ
- **Cục trên lên cục dưới**: chọn “Cục tủ trên”, rê lên tủ dưới → tự khớp rộng & sâu (khung xanh). Sau đó rộng/sâu liên kết hai chiều; chiều cao mỗi cục độc lập.
- **Tủ hông**: rê sát cạnh trái/phải tủ chính, nửa trước = bám **mép trước**, nửa sau = bám **mép sau** (vạch xanh chỉ mép đang bắt). Sau khi đặt không ràng buộc kích thước.
- **Chọn cả bộ / Chọn từng module** (thanh công cụ hoặc chuột phải). Ở chế độ từng module, **Move cục dưới kéo cục trên đi cùng**.
- **Scale** bộ tủ bằng công cụ Scale của SketchUp: chiều cao các cục đổi theo tỷ lệ, **độ dày tấm giữ nguyên**. Scale từng module cũng giữ độ dày.

### Tủ bếp trên/dưới
- Đặt “Tủ bếp trên” lên “Tủ bếp dưới”: **gõ khoảng hở** (mm) từ mặt trên tủ dưới tới đáy tủ trên rồi Enter, click để đặt. Mặt sau hai tủ tự thẳng hàng.
- Chỉ **chiều rộng** liên kết hai chiều. Chiều sâu từng tủ độc lập; đổi sâu tủ dưới thì tủ trên tự dịch trước/sau để vẫn thẳng mặt sau.
- Đổi cao tủ dưới: **tủ trên giữ nguyên cao độ**, khoảng hở thực tế hiện lại trong Thuộc tính. Nếu tủ dưới cao lên chạm tủ trên → báo lỗi, không áp dụng.

### Tủ chữ L
- “Tủ bếp dưới chữ L” (hai thùng ghép vuông góc) và “Tủ chữ L một thùng” (nóc/đáy chữ L thật).
- Nhập **Chiều dài nhánh A/B = kích thước tổng đo từ góc ngoài phía sau tới đầu nhánh**. **Chiều sâu chung**: sửa một lần cho cả hai nhánh. “Hướng” đổi trái/phải.

## 6. Cấu tạo khung (Thuộc tính)
- **Nóc** và **Đáy** chọn riêng: *Lọt giữa hai hồi* / *Phủ lên hai hồi* (4 tổ hợp). Đổi kiểu **giữ nguyên chiều cao tổng**; hồi và các tấm tự tính lại.
- **Hậu**: *Đóng phủ phía sau* / *Lọt trong lòng* / *Soi rãnh* (rãnh được khoét thật trên hồi, nóc, đáy). **Phạm vi hậu**: chung toàn thùng hoặc riêng từng khoang đứng (khoang có nhiều đợt vẫn một tấm hậu suốt).
- **Bo cong**: “Bo góc trước nóc/đáy/đợt” và “Bán kính đầu bo phải”. Bán kính giữ nguyên khi đổi kích thước; không vừa thì báo, không tự đổi R.

### Len chân và xà (từ 1.2.0)
- Thuộc tính module › **Len chân & xà**: *Cao len chân* (0 = không chân), *Lùi len chân trước*, *Có len chân sau*,
  *Nóc dạng* (tấm nóc / hai xà trước–sau), *Bản rộng xà*. Cũng đặt được ở ⚙ setting mẫu.
- Có len chân: đáy nâng lên và lọt giữa hai hồi, hai hồi chạy tới sàn, cánh phủ bắt đầu từ trên len chân; chiều cao tổng giữ nguyên.
- *Hiển thị rãnh hậu*: mặc định là dấu `ABF_RANH_HAU` (để ABF nhận tấm). Chọn “Khoét thật” nếu chỉ cần xem 3D.

## 7. Vách, đợt, sao chép
- **Thêm vách / Thêm đợt**: trỏ vào khoang → xem trước. **Tab** đổi điểm bám (mặt trái/tim/mặt phải; đợt: mặt dưới/tim/mặt trên). Mốc đo tự lấy mặt trong khoang **phía gần chuột** (vạch xanh).
- Click để đặt tự do, hoặc **gõ khoảng cách rồi Enter** — đặt ngay. Khi đã gõ số, mốc bị khóa, chuột không ghi đè. Esc hủy số đang gõ.
- Sửa vị trí: **Move** trực tiếp, hoặc ô khoảng cách trong Thuộc tính. Đổi kích thước tủ → vách/đợt giữ tỷ lệ bố trí, độ dày không đổi.
- **Sao chép vách/đợt**: bấm đúp mở module, chọn một vách/đợt → “Sao chép vách/đợt…” → nhập số bản và **khoảng lọt lòng** (17 mm + 400 mm lọt lòng = bước 417 mm).

## 8. Mặt trước
- Dựng bên trong trước, chọn bộ tủ/module → **Tạo mặt trước**. Bấm lại chỉ cập nhật, không nhân đôi.
- Cánh **phủ ngoài / lọt lòng**, khe biên, khe giữa trong Thuộc tính. Thêm vách giữa khoang có một cánh → tự chia hai cánh, khe bám tim vách; Move vách → hai cánh đổi rộng; xóa vách → gộp. “Số cánh khoang N” để chia đều thủ công trong từng khoang đứng.
- **Mặt ngăn kéo**: mặt phẳng, **khe luồn tay 25 mm ở mép trên từng mặt** (kể cả mặt trên cùng). Số mặt + tỷ lệ chiều cao sửa trong Thuộc tính.

## 9. Thùng ngăn kéo (ray bi gắn hai bên)
- **Đặt từng thùng**: trỏ vào khoang → **Tab** đổi neo *Đáy ngoài → Tim chiều cao → Đỉnh thùng* → click, hoặc gõ khoảng cách (tính từ mặt trong đáy khoang) + Enter.
- **Tạo cả cụm**: click vào khoang → tạo theo bố cục mặt ngăn kéo của module.
- **Rộng ngoài thùng = lọt lòng khoang − 26 mm** (13 mm mỗi bên). **Sâu ngoài thùng = chiều dài ray đã chọn** (chọn ray ở ⚙ của mẫu “Thùng ngăn kéo ray bi” hoặc trong Thuộc tính thùng). Chiều cao theo mẫu, sửa được.
- Không vừa khoang → báo đúng nguyên nhân, không tự đổi ray/chiều cao.

## 10. Liên kết Cam Minifix + chốt cam
- Chọn module/bộ tủ → **Liên kết Cam Minifix**: hiện các cạnh tiếp xúc hợp lệ (cạnh–mặt vuông góc). Đỏ = cốc cam, cam = lỗ cạnh, xanh = chốt.
- **Click** gần một liên kết: đổi mặt đặt cam. **Delete**: xóa/khôi phục liên kết. **Enter**: áp dụng. **Esc**: hủy.
- Sửa vị trí riêng: chọn tấm (trong module) → Thuộc tính → “Vị trí (mm từ đầu cạnh)”. Đổi kích thước tủ giữ đường kính/độ sâu theo preset và giữ vị trí chỉnh riêng.
- Preset hiện tại là **DEMO**, chưa phải thông số xưởng.

## 11. Tiết diện giao nhau
- Chọn bộ tủ (hoặc module) → **Quét tiết diện giao nhau** → xem trước: đỏ = sẽ đánh dấu, xám = đã có rãnh soi, vàng = chưa xác định tấm nhận (click để chọn), hộp bao chồng giả bị loại.
- **Enter** đánh dấu hàng loạt. Dấu tự cập nhật khi Move/Scale; cặp không còn giao sẽ được bỏ và báo.

## 12. Lỗ cốc bản lề (chỉ trên cánh)
- **Bản lề tự động**: số lượng/vị trí theo chiều cao cánh, tự dịch tránh đợt.
- **Bản lề thủ công**: click lên cánh để thêm (vướng đợt → tự dịch tới vị trí hợp lệ gần nhất); click gần lỗ đã có để bỏ.
- Thuộc tính cánh: **bên bản lề trái/phải**, cách tính, **khi đổi chiều cao**: giữ khoảng cách mép gần nhất / theo tỷ lệ / tính lại tự động.
- Thuộc tính module: chọn **bộ cấu hình**, chính sách khi cánh tự chia đôi, và mục “Sửa / lưu bộ cấu hình bản lề” (đường kính tự nhập, ngưỡng chiều cao) — lưu được nhiều bộ.

## 13. Dữ liệu sản xuất & bàn giao ABF/Nesting
- **Kiểm tra dữ liệu sản xuất**: báo lỗi theo mã + ID tấm/thao tác.
- **Xuất dữ liệu gia công (JSON/CSV)**: 1 file JSON + 2 file CSV (chi tiết, thao tác), đơn vị mm.
- **Tạo bản gia công**: dựng bản sao phẳng một cấp cạnh model (mỗi tấm một nhóm đặc, lỗ/rãnh/tiết diện khoét vào hình học, có thuộc tính truy về ID tấm). Model gốc giữ nguyên cấu trúc. Tạo lại sẽ thay bản cũ.
- **Dựng bộ ca kiểm thử ABF**: dựng sẵn 4 ca chuẩn để nạp thử trên ABF. Quy trình: `docs/ABF_HANDOFF.md`.
- ⚠ **Tương thích ABF/Nesting: CHƯA KIỂM CHỨNG.**

### Bảng gia công CNC trong Thuộc tính (từ 1.1.0)
- Bấm đúp mở module → chọn **một tấm** → Thuộc tính → mục **“Gia công CNC”**: liệt kê từng lỗ/rãnh/tiết diện với mặt, Ø, độ sâu, vị trí và **tag ABF** trong `[ ]`.
- Tick “Xóa…” rồi **Áp dụng**: xóa lỗ cam = xóa cả bộ cam/chốt của cạnh đó; xóa lỗ cốc = cánh chuyển sang đặt thủ công; rãnh hậu = ẩn, khôi phục ở mục “Thao tác đã xóa”.
- Chọn module: mục “Gia công CNC” tổng hợp số thao tác theo tag ABF.
- Trong model, dấu gia công nằm trên các tag `ABF_D35`, `ABF_D15`, `ABF_RANH_HAU`… (bật/tắt ở bảng Tags của SketchUp).

### Đối tượng gia công kiểu ABF (từ 1.4.0)
Cam, chốt, lỗ cạnh, bản lề và rãnh hậu do plugin tạo mang **đúng tên nhóm, layer và thuộc tính** như khi bạn dùng công cụ của ABF
(`_ABF_minifixPlasticBase`, `_ABF_minifixBolts`, `_ABF_sideDrill`, `_ABF_Intersect`, `ABF_D35`…). ABF lấy dao/độ sâu theo **tên setting**,
nên ba tên setting trong *Cài đặt chung › Tên setting trong ABF* phải trùng tên setting đang có trong ABF của bạn.

### Cài đặt chung (từ 1.3.0)
- **Extensions › Tủ Module Hùng Loan › Cài đặt chung** (hoặc nút bánh răng trên thanh công cụ).
- Bảng **Tên layer và instance gia công**: mỗi dòng một loại thao tác (cốc cam, lỗ cạnh, chốt cam, lỗ bản lề, rãnh hậu, tiết diện).
  Sửa ô *Layer (tag)* và *Instance (tên nhóm)* cho khớp tên đã khai báo trong ABF của xưởng. `{D}` = đường kính, `{Z}` = độ sâu
  (vd `ABF_D{D}` → `ABF_D15`).
- Bảng **Thông số cam**: Ø và độ sâu cốc cam, lỗ cạnh, lỗ chốt, khoảng cách.
- Tick “Cập nhật luôn mọi tủ…” rồi **Lưu cài đặt**: tủ đã đặt được vẽ lại dấu theo tên mới. Ô sai báo đỏ, không lưu.
  “Tên mặc định” chỉ nạp lại tên gốc vào bảng, bấm Lưu mới áp dụng. Tag cũ không còn dùng vẫn nằm trong bảng Tags của SketchUp (xóa bằng Purge nếu muốn).

## 14. Thuộc tính & Undo
- **Thuộc tính**: chuột phải đối tượng → Thuộc tính, hoặc nút trên thanh công cụ. Đổi đối tượng chọn → bảng tự theo.
- Sửa nhiều ô rồi bấm **Áp dụng** — cập nhật một lần. Nháp gắn theo từng đối tượng; đổi lựa chọn không áp nhầm.
- Mỗi thao tác (đặt, Apply, Move/Scale, thêm vách…) hoàn tác bằng **một lần Ctrl+Z**.
- Gán vật liệu bằng **Paint Bucket** lên tấm; vật liệu được giữ khi tủ tái sinh.

## 15. Mẫu đã hỗ trợ & giới hạn
Bộ SKP nguồn `DC_17MM_Model_Thuong.zip` (111 file) đã nhận được và **khảo sát sơ bộ ngoài SketchUp** (`docs/khao_sat/`): tên chi tiết,
số đo mm xuất hiện trong file, ảnh thumbnail, dấu vết tag ABF. Môi trường này không có SketchUp nên **chưa đọc được hình học thật**;
10 mẫu hiện tại vẫn là **template sinh bằng Ruby** theo quy tắc tham số. 6 mẫu dùng ảnh thumbnail thật của file SKP tương ứng:

| Mẫu | Loại | Đối chiếu SKP nguồn khi có ZIP |
|---|---|---|
| Khung tủ | khung tủ | 1. KHUNG TỦ.skp |
| Cục tủ trên | cục trên | 1.CucTuTren.skp |
| Tủ hông | tủ hông | — |
| Tủ bếp dưới (thẳng) | tủ bếp dưới | 3. TỦ BẾP DƯỚI (THẲNG).skp |
| Tủ bếp trên | tủ bếp trên | 3.TỦ BẾP TRÊN.skp |
| Tủ bếp dưới chữ L | tủ bếp L | 3. Tủ Bếp Dưới L.skp |
| Tủ chữ L một thùng | tủ L | — |
| Tủ 3 ngăn kéo | tủ ngăn kéo | — |
| Thùng ngăn kéo ray bi | thùng | 05B - Thùng ngăn kéo có ray.skp |
| Tủ đầu bo | bo cong | — |

Để làm thông minh đúng theo model gốc: trên máy có SketchUp chạy **Extensions › Tủ Module Hùng Loan › Khảo sát bộ mẫu SKP…**,
chọn thư mục `Model_17MM`, lưu `khao_sat_mau.json` rồi gửi lại. Lệnh này chỉ nạp tạm từng file để đo, model đang mở không bị thay đổi.
Giới hạn khác: xem `ASSUMPTIONS.md` mục “Giới hạn”.

## Phát triển
- Kiểm thử: `ruby -Itests tests/test_core.rb`, `ruby tests/test_su_flow.rb`, `ruby tests/test_su_tools.rb`
- Đóng gói: `tools/build_rbz.sh` → `dist/hl_tumodule.rbz`
- Sinh dữ liệu đối chiếu ABF: `ruby tools/make_abf_samples.rb`
- Tài liệu kỹ thuật: `docs/SCHEMA.md`, `docs/ABF_HANDOFF.md`, `ASSUMPTIONS.md`, `TEST_REPORT.md`, `CHANGELOG.md`
