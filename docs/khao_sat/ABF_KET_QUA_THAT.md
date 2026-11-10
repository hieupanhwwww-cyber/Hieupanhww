# Kết quả ABF Nesting THẬT trên tủ do plugin tạo (file `bantest.skp`, 10/11/2026)

Nguồn: file người dùng gửi sau khi chạy ABF Nesting trên model dựng bằng plugin 1.1.0. Đọc ngoài SketchUp bằng
`tools/skp_attrs.py` (giải mã attribute dictionary trong `model.dat`). Đây là **bằng chứng thật đầu tiên** về cách ABF đọc model.

## Model thử
5 module: Khung tủ (có cam), Tủ bếp trên, Tủ đầu bo, Tủ chữ L một thùng (có cam), Tủ 3 ngăn kéo — tổng 27 tấm.

## ABF đã làm gì
| Hạng mục | Kết quả | Nhận xét |
|---|---|---|
| Số tấm ABF nhận | **18 / 27** | 5 tấm ván: 3 tấm 7 mm + 2 tấm 17 mm |
| Tấm được nhận | 6 hậu; hồi/nóc/đáy của **Tủ đầu bo**; nóc/đáy/hồi chữ L | Đều là tấm **không khoét rãnh** |
| Tấm KHÔNG được nhận | Hồi, nóc, đáy của Khung tủ, Tủ bếp trên, Tủ ngăn kéo (12 tấm) | Đều là tấm có **rãnh hậu khoét thật** vào khối → ABF không coi là tấm |
| Lỗ khoan | `drills-desc = [["","","",""],[]]` ở **mọi** tấm | ABF **không nhận lỗ nào** (dấu của 1.1.0: nét rời, nổi 0,1 mm, lồng 2 cấp nhóm) |
| Dán cạnh | `edge-band-desc = []` | Plugin chưa có dữ liệu dán cạnh |
| Tên tấm trên nhãn | Lấy theo **tên nhóm** (“Hậu”, “Hồi”, “Nóc chữ L”…) | 4 tấm 15–18 không tên: chưa rõ nguồn |
| Độ dày | Tự nhận 7 / 17 mm theo hình học | Đúng |

## Khóa attribute ABF ghi vào model (quan sát)
Trên tấm đã xếp: `is-board`, `board-index`, `drills-desc`, `edge-band-desc`, `is-label`, `label-width/height/scale/rotation`,
`is-labeled-face`, `is-cutting-lines`, `is-outer-loop`. Trên tấm ván: `sheet-id`, `sheet-thickness`, `sheet-dimension`,
`is-sheet-border`, `is-sheet-id`, `is-sheet-material`. Gốc: `is-nesting-root`, `is-user-nesting-obj`, `shift-origin`.
Tag ABF tự tạo: `_ABF_Label`, `_ABF_cuttingLines`, `ABF_edgeBanding`, `__ABF_sheetBorder`, `ABF_sheetId`, `ABF_sheetMaterial`,
`ABF_RANH_UONCONG`, `ABF_RANH_BAOVE`. (ABF **không** tự tạo `ABF_D…` → tag lỗ khoan là tag do người dùng khai báo trong cấu hình ABF.)

`drills-desc` có dạng `[[4 chuỗi], [danh sách]]` — suy đoán: 4 chuỗi = khoan 4 cạnh, danh sách = khoan mặt. Chưa có mẫu khác rỗng để xác nhận.

## File mẫu của xưởng (DC_17MM)
Không có attribute ABF nào trên chi tiết → quy ước gia công của xưởng là **nhóm con đặt tên `ABF_…` nằm trong tấm + tên tag**
(vd cánh kính: nhóm `ABF_BanLe` trên tag `ABF_D35`, `ABF_CutInSide`, `ABF_PoketOut`…).

## Thay đổi ở 1.2.0 dựa trên kết quả này
1. Rãnh hậu **không khoét** vào khối tấm nữa (mặc định) → tấm giữ nguyên lăng trụ để ABF nhận; rãnh là nhóm `ABF_RANH_HAU`.
2. Dấu gia công: **một cấp** ngay trong tấm, tên nhóm = tên tag, hình là **mặt** nằm đúng trên mặt/cạnh ván.
3. Bản gia công cũng theo kiểu này (không khoét).

## Còn chưa biết (cần thử lại trên ABF)
- ABF có đọc lỗ từ nhóm mặt tròn trên tag `ABF_D{Ø}` không, và tag `ABF_D5/D8/D15` có cần khai báo trong cấu hình ABF của xưởng.
- Độ sâu lỗ ABF lấy từ đâu (cấu hình tag hay hình học).
- Nguồn 4 tấm không tên 15–18.
