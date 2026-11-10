# Nhật ký thay đổi

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
