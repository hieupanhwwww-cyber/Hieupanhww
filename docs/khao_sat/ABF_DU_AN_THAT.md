# Hợp đồng dữ liệu ABF — giải mã từ dự án ABF THẬT của xưởng (`CHAU_NAM_CNC/Untitled.skp`, 10/11/2026)

Nguồn: dự án đã chạy ABF hoàn chỉnh (43 tấm ván, ~300 chi tiết, có G-code `.nc`). Đọc ngoài SketchUp bằng `tools/skp_attrs.py`.
Đây là căn cứ cho cách plugin 1.4.0 sinh đối tượng gia công.

## 1. Đối tượng gia công do công cụ ABF tạo
Mỗi thao tác là **một nhóm con** trong tấm; thuộc tính nằm trong attribute dictionary tên **`ABF`**.

| Tên nhóm | Layer trong dự án | Thuộc tính (dictionary `ABF`) |
|---|---|---|
| `_ABF_minifixBolts` (**cốc cam Ø15**, trên tấm mang cam) | `ABF-D15` | `is-minifix-part-b: true`, `minifix-group-a-id: <id tấm nhận Ø5>`, `minifix-up-face-normal: <vector>`, `setting-name: "CAM_17MM"` |
| `_ABF_minifixPlasticBase` (**lỗ Ø5**, trên mặt tấm đối diện) | `ABF-D5` | `is-minifix-part-a: true`, `minifix-group-b-id: <id tấm mang cam>`, `minifix-up-face-normal`, `setting-name` |
| `_ABF_sideDrill` (lỗ cạnh, cùng tấm với cốc cam) | `ABF-DSIDE-8` | `face-drill-group-id: <id nhóm cốc cam>`, `is-side-drill: true`, `minifix-group-a-id`, `minifix-up-face-normal`, `setting-name` |
| `_ABF_sideDrillDepth` (cùng tấm với cốc cam) | `ABF-DSIDE-8` | `is-side-drill-depth: true`, `minifix-group-a-id`, `minifix-up-face-normal`, `setting-name` |
| `ABF_D35` (lỗ cốc bản lề) | `ABF_D35` | `is-hinge-part-b: true`, `is-user-nesting-obj: true`, `setting-name: "BẢN LỀ A - Loại A"` (+ `ban_le`, `ban_le_id` của thư viện DC) |
| `_ABF_Intersect` (rãnh hậu) | `ABF_SOI HAU` | `intersect-group-b-id: <id tấm hậu>`, `intersect-offset: 0.0`, `intersect-x: 2.0`, `is-intersect: true`, `setting-name: "SOI ÂM 9MM - RÃNH HẬU"` |

**Kiểm chứng ghép nhóm:** tách dữ liệu theo từng tấm (mỗi tấm một nhãn `_ABF_Label`): trên **150/150** tấm có lỗ cạnh, số `_ABF_minifixBolts` = số `_ABF_sideDrillDepth`;
tấm chỉ có `_ABF_minifixPlasticBase` thì không có lỗ cạnh nào. Vậy `Bolts` là cốc cam Ø15 (luôn đi với lỗ cạnh), `PlasticBase` là lỗ Ø5 ở tấm đối diện.
(Bản 1.4.0 ghép ngược hai nhóm này — đã sửa ở 1.4.1.)

Gán layer ↔ nhóm là **suy luận** từ tên layer có trong file và đường kính (không đọc được liên kết layer trong nhị phân).
Layer khác có trong dự án: `ABF_HM`, `ABF_D3`, `TAM_HAU`.

## 2. ABF ghi gì sau khi xếp ván (`drills-desc`)
`[[cạnh0, cạnh1, cạnh2, cạnh3], [thao tác…]]`
- Chuỗi cạnh, vd `"60_440"`: vị trí các lỗ khoan ngang dọc cạnh đó (mm).
- Khoan mặt: `[đường kính, -1, [x, y, z]]` — độ sâu `-1` = ABF lấy theo **setting-name**. Tọa độ inch, z = 0 hoặc bề dày.
- Khoan cạnh: `[8, 34, p1, p2, p3, p4]` — Ø8 sâu 34, bốn điểm là **chữ nhật 34 × 8 mm nằm ở giữa độ dày** (z = 8,5 mm với ván 17).

## 3. Số đo rút ra
- G-code ván 17: khoan xuống Z4 → **sâu 13 mm**; Z7.5 → sâu 9,5 mm (rãnh hậu “soi âm 9”); Z1.5 rồi Z0 → cắt đứt 2 lượt.
- Lỗ cạnh: Ø8 sâu 34. Cốc cam Ø15, chốt Ø5.

## 4. Plugin 1.4.0 làm theo như thế nào
- Tên nhóm, layer, thuộc tính sinh đúng bảng mục 1 (`core/abf_rules.rb`, `su/render.rb`). ID đối tác dùng `persistent_id`.
- Lỗ cạnh có thêm nhóm `_ABF_sideDrillDepth` là chữ nhật (sâu × Ø) ở giữa độ dày, đúng dạng ABF ghi trong `drills-desc`.
- Mặc định: cốc cam sâu 13, chốt sâu 13, rãnh hậu sâu 9, nới rộng 2 (intersect-x).
- Ba tên setting (`CAM_17MM`, `BẢN LỀ A - Loại A`, `SOI ÂM 9MM - RÃNH HẬU`) sửa được trong **Cài đặt chung**.

## 5. Chưa chắc chắn
- ID trong `minifix-group-a/b-id` là `persistent_id` hay loại ID khác của ABF (giá trị quan sát 244942–301377) — plugin dùng `persistent_id`.
- `minifix-up-face-normal` tính trong hệ tọa độ nào — plugin dùng pháp tuyến mặt đặt cốc cam trong hệ thế giới.
- Hình học chính xác bên trong từng nhóm ABF (mặt tròn hay khối trụ) — plugin dùng mặt phẳng.
- Bộ thuộc tính `intersect-type: 1`, `x: 2.0`, `disable-bounds` (93 lần) nằm trên đối tượng nào — chưa dùng.
- Chưa có lần chạy ABF nào trên model của plugin 1.4.0.
