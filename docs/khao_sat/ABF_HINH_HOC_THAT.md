# Hình học THẬT của đối tượng gia công ABF (đọc từ `CHAU_NAM_CNC/Untitled.skp`, 11/11/2026)

Đọc bằng `tools/skp_read.py` (giải mã cây thẻ của `model.dat`: đỉnh, cạnh, mặt, nhóm, layer). Đây là số đo trực tiếp từ
3701 định nghĩa / 4089 nhóm của dự án ABF thật — không còn là suy đoán từ tên.

| Nhóm | Hình bên trong | Layer của NHÓM | Layer của CẠNH | Mặt |
|---|---|---|---|---|
| `_ABF_minifixBolts` | vòng tròn Ø15, 24 cạnh, trên mặt tấm mang cam | Layer0 | `ABF-D15` | không (bản đã xếp ván mới có) |
| `_ABF_minifixPlasticBase` | vòng tròn Ø5, 24 cạnh, trên mặt tấm đối diện, tâm ở giữa độ dày tấm mang cam | Layer0 | `ABF-D5` | không |
| `_ABF_sideDrill` | vòng tròn Ø8, 24 cạnh, trên mặt cạnh, tâm ở giữa độ dày (8,5) | Layer0 | `ABF-DSIDE-8` | không |
| `_ABF_sideDrillDepth` | chữ nhật 34 × 8, 4 cạnh, **trên mặt có cốc cam**, từ mép tấm vào, tim trùng trục lỗ | Layer0 | `ABF-DSIDE-8` | không |
| `ABF_D35` (bản lề) | viền cốc Ø35 cắt phẳng còn 35 × 26 (26 đỉnh) + vòng tròn Ø3 ở tâm | `ABF_D35` | viền: `ABF_D35`; Ø3: `ABF_D3` | không |
| `_ABF_Intersect` (rãnh hậu) | chữ nhật rộng **đúng độ dày hậu** (7), dài hơn tấm 2 mm mỗi đầu | `ABF_SOI HAU` | `ABF_SOI HAU` | có, trên `ABF_SOI HAU` |

Số đo:
- Tâm cốc cam Ø15 cách mép tấm **33 mm** (294 bộ đo được). Lỗ cạnh sâu 34.
- Cam ngoài cùng cách đầu cạnh phổ biến **60 mm** (144 lần; ngoài ra 67, 100, 114…).
- Mặt phẳng dấu độ sâu trùng mặt phẳng cốc cam (151 bộ ở mặt 0, 84 bộ ở mặt 17).
- Bản lề: ABF chỉ xuất lỗ **Ø3** (72 lỗ trong `drills-desc`), không xuất lỗ Ø35 → xưởng dùng lỗ mồi tâm, viền cốc chỉ để nhìn.

## Plugin trước 1.6.0 sai ở đâu
1. Gán layer cho **nhóm** và vẽ **mặt**; ABF thật để nhóm ở Layer0 và đặt layer trên **cạnh**.
2. Dấu độ sâu lỗ cạnh vẽ ở giữa độ dày → ABF đọc lỗ cạnh nhưng độ sâu `-1` (thấy ở `test.skp`). Đúng: trên mặt có cốc cam.
3. Tâm cốc cam 24 mm, cam đầu 50 mm (số DEMO) → đúng của xưởng: 33 và 60.
4. Bản lề vẽ mặt tròn Ø35 → đúng: viền cốc + lỗ mồi Ø3 trên `ABF_D3`.
5. Rãnh hậu rộng hậu + 2 → đúng: rộng bằng độ dày hậu, dài thêm 2 mỗi đầu.

1.6.0 dựng lại cả 5 điểm. **Chưa có lần chạy ABF trên model 1.6.0** — cần `test.skp` mới để xác nhận độ sâu lỗ cạnh ra 34.
