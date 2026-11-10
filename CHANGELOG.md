# Nhật ký thay đổi

## 1.5.0 — 10/11/2026 — Chống lỗi, tự kiểm tra
Căn cứ: `test.skp` — ABF đã nhận 19/19 tấm và 56 bộ cam từ plugin (`docs/khao_sat/ABF_KET_QUA_TEST.md`).
- **Lớp an toàn (`su/safe.rb`)**: mọi lệnh, mọi callback công cụ chuột (rê, vẽ, click, phím, gõ số) được bọc. Lỗi Ruby không còn làm đứng
  công cụ hay spam hộp thoại: ghi vào nhật ký, báo một lần, công cụ lỗi ≥ 5 lần tự thoát.
- **Nhật ký lỗi** `loi.log` (menu *Mở nhật ký lỗi*), có phiên bản SketchUp, hệ điều hành và vết lỗi.
- **Tự kiểm tra trong SketchUp thật** (menu *Tự kiểm tra plugin…*): thử API host, đặt từng mẫu, bật mặt trước/cam/bản lề, ghép bộ tủ,
  Move/Scale, vách/đợt/thùng, đổi tên ABF, xuất bản gia công; xóa sạch sau khi xong; ghi `tu_kiem_tra.txt` kèm nhật ký.
- Hộp thoại lưu/mở file luôn có thư mục mặc định hợp lệ (trước đây truyền `nil`). Timer observer 0 → 0,01 s.
- Thao tác lỗi: hoàn lại bằng `abort_operation` có bắt lỗi; không còn nuốt lỗi âm thầm.
- Khảo sát model: từng nhóm lỗi không làm hỏng cả file; làm sạch chuỗi UTF-8/NaN trước khi ghi JSON; nhóm ABF ghi đủ đỉnh mặt/cạnh.

## 1.4.1 — 10/11/2026
- **Sửa lỗi ghép ngược ở 1.4.0:** cốc cam Ø15 phải là `_ABF_minifixBolts` (part-b, cùng tấm với lỗ cạnh), lỗ Ø5 ở tấm đối diện là
  `_ABF_minifixPlasticBase` (part-a). Đã kiểm trên 150/150 tấm có lỗ cạnh của dự án ABF thật. Cấu hình tên đã lưu từ 1.4.0 được tự sửa.
- `minifix-up-face-normal` gắn đủ trên cả bốn loại nhóm cam.
- **Tên tấm theo cách gọi của xưởng** (ABF in nhãn theo tên nhóm): Hồi Trái/Phải, Đình, Chân Trước/Sau, Xà Trước/Sau, Cánh Trái/Phải,
  Đợt 1…, Vách 1…, Thành Trái/Phải/Trước/Sau NK, Tấm Đáy NK, Mặt Ngăn Kéo 1…
- Thuộc tính module thêm **Ký hiệu tủ** (vd `TU 1`) — in trước tên tấm trên nhãn ABF.
- Thêm lệnh **Khảo sát model đang mở…** (ghi cấu trúc nhóm/tag/thuộc tính + ID ra JSON để đối chiếu với ABF).

## 1.4.0 — 10/11/2026 — Đối tượng gia công đúng kiểu ABF
Căn cứ: dự án ABF thật của xưởng `CHAU_NAM_CNC` (`docs/khao_sat/ABF_DU_AN_THAT.md`).
- Cam/chốt, lỗ cạnh, bản lề, rãnh hậu sinh ra **đúng tên nhóm, layer và thuộc tính** như công cụ ABF:
  `_ABF_minifixPlasticBase` / `ABF-D15`, `_ABF_minifixBolts` / `ABF-D5`, `_ABF_sideDrill` + `_ABF_sideDrillDepth` / `ABF-DSIDE-8`,
  `ABF_D35`, `_ABF_Intersect` / `ABF_SOI HAU`; dictionary `ABF` có `setting-name`, ID tấm đối tác, `is-minifix-part-a/b`…
- Mỗi lỗ là một nhóm riêng (trước đây gộp theo tag). Lỗ cạnh có thêm dấu độ sâu (chữ nhật ở giữa độ dày).
- Mặc định theo số xưởng: cốc cam sâu 13, chốt sâu 13, rãnh hậu sâu 9, rộng hơn hậu 2.
- Cài đặt chung thêm mục **Tên setting trong ABF** (cam, bản lề, rãnh hậu, intersect-x) và dòng “Dấu độ sâu lỗ cạnh”.
- Cấu hình tên đã lưu từ 1.3.0: ô nào còn nguyên tên mặc định cũ được tự đổi sang tên ABF thật; ô bạn đã tự đặt thì giữ.

## 1.3.0 — 10/11/2026 — Cài đặt chung
- **Mới: cửa sổ “Cài đặt chung”** (menu và thanh công cụ): đổi tên **layer (tag)** và **instance (tên nhóm)** cho từng loại gia công —
  cốc cam, lỗ cạnh, lỗ chốt cam, lỗ cốc bản lề, rãnh hậu, tiết diện khoét, tiết diện cắt xuyên. Tên dùng được `{D}` (đường kính) và `{Z}` (độ sâu).
- Sửa **thông số cam Minifix** (Ø, độ sâu, khoảng cách) ngay trong cửa sổ này; bộ đã sửa không còn gắn nhãn DEMO.
- Tùy chọn “Cập nhật luôn mọi tủ trong model” khi lưu. Cài đặt được nhớ qua các lần mở SketchUp (`abf_ops.json`).
- Tên mới đi theo dấu trong model, bản gia công, bảng Gia công CNC trong Thuộc tính và file JSON/CSV.

## 1.2.0 — 10/11/2026 — Sửa theo kết quả ABF thật + len chân, xà
Căn cứ: file `bantest.skp` người dùng gửi có kết quả ABF Nesting thật (`docs/khao_sat/ABF_KET_QUA_THAT.md`).
- **Sửa: 12 tấm có rãnh hậu không được ABF nhận.** Rãnh hậu mặc định không khoét vào khối tấm nữa; thể hiện bằng nhóm `ABF_RANH_HAU`.
  (Thuộc tính › “Hiển thị rãnh hậu” cho chọn lại khoét thật.)
- **Sửa: ABF không nhận lỗ khoan.** Dấu gia công đổi sang kiểu file mẫu của xưởng: nhóm một cấp ngay trong tấm, tên = tag `ABF_…`,
  hình là mặt nằm đúng trên mặt/cạnh ván. Bỏ đường gióng (construction line) gây rối.
- Bản gia công: không khoét, dùng cùng kiểu dấu ABF.
- **Mới: len chân** (cao, lùi trước, có/không chân sau) và **xà trước/sau thay nóc** — trong ⚙ setting mẫu và Thuộc tính.
  Mặc định theo model nguồn: Khung tủ chân 50; Tủ bếp dưới và bếp L chân 100 + xà.
- Thuộc tính thêm: độ dày cánh/mặt, lùi vách/đợt so với mép trước.
- Thêm `tools/skp_attrs.py` đọc attribute trong file .skp ngoài SketchUp.

## 1.1.0 — 10/11/2026 — Logic ABF/CNC xuyên suốt
- **Quy ước tag ABF tập trung** (`core/abf_rules.rb`), rút từ chính bộ mẫu của xưởng: lỗ tròn → `ABF_D{Ø}` (vd `ABF_D35`),
  rãnh hậu → `ABF_RANH_HAU`, vùng khoét → `ABF_POCKET_Z{sâu}`, cắt xuyên → `ABF_CatTrong`.
- Dấu gia công trong model, bản gia công và file JSON/CSV đều mang tag ABF (cột `tag_abf`, trường `abf_tag`).
- **Thuộc tính tấm có bảng “Gia công CNC”**: từng thao tác với mặt, Ø, độ sâu, vị trí, tag ABF; tick để xóa.
  Xóa lỗ cam → xóa cả bộ cam/chốt của cạnh; xóa lỗ cốc → cánh chuyển sang đặt thủ công; rãnh → ẩn và khôi phục được.
  Thao tác đã xóa không tự hồi sinh khi đổi kích thước.
- Thuộc tính module có tổng hợp số thao tác theo tag ABF.

## 1.0.1 — 10/11/2026
- Sửa lỗi gắn observer làm hỏng lệnh đặt module trên SketchUp thật (`entityID` của `Entities`).
- Thư viện hiện ảnh thumbnail thật từ file SKP nguồn cho 6 mẫu tương ứng.
- Thêm lệnh **Khảo sát bộ mẫu SKP…** (đo cấu tạo từng file, ghi JSON, không đổi model đang mở).
- Khảo sát sơ bộ 111 file ZIP ngoài SketchUp: `docs/khao_sat/` (bảng tên chi tiết/số đo, 111 thumbnail, dấu vết tag ABF).

## 1.0.0 — 07/11/2026 — Tủ Module Hùng Loan (extension mới)
- Thêm extension `hl_tumodule` (namespace `HungLoan::TuModule`), độc lập với extension Tạo Ván có sẵn (không sửa Tạo Ván).
- Lõi thuần Ruby: tham số module, cây khoang vách/đợt, khung nóc/đáy lọt–phủ, hậu 3 kiểu, cánh, mặt ngăn kéo khe 25 mm,
  thùng ray bi, chữ L 2 kiểu, bo/đầu bo, bộ giải liên kết module, cam Minifix, lỗ cốc bản lề, tiết diện, kiểm tra sản xuất, xuất JSON/CSV.
- Lớp SketchUp: thư viện (cây thư mục, lọc toàn thư viện, ⚙ setting từng mẫu, sao lưu), Thuộc tính, công cụ đặt/vách/đợt/thùng/
  bản lề/cam/tiết diện, xử lý Move/Scale/Delete native, bản gia công bàn giao ABF/Nesting (chưa kiểm chứng), bộ ca kiểm thử ABF.
- Kiểm thử: lõi + luồng SketchUp trên API giả lập. Chưa chạy trong SketchUp thật.
- README gốc viết lại cho cả hai extension.
