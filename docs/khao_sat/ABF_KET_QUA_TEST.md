# Kết quả ABF trên model của plugin (`test.skp`, 10/11/2026)

Nguồn: file người dùng gửi sau khi chạy ABF Nesting trên tủ dựng bằng plugin (bản 1.4.x). Đọc bằng `tools/skp_attrs.py`.

| Hạng mục | Bantest (1.1.0) | test.skp (1.4.x) |
|---|---|---|
| Tấm ABF nhận | 18/27 | **19/19** (Vách 1–9, Đợt 1–3, Hậu, Chân Sau/Trước, Đáy, Đình, Hồi Phải/Trái) |
| Tên nhãn tấm | tên thô | đúng tên plugin đặt (“Hồi Phải”, “Đợt 1”…) |
| Lỗ Ø5 trên mặt | 0 | **56** |
| Cốc cam Ø15 | 0 | **56** |
| Lỗ cạnh Ø8 | 0 | **56** (đủ cặp với cốc cam) |
| Độ sâu lỗ cạnh | — | **-1** (ABF chưa đọc được dấu độ sâu) |
| Tấm ván xếp | — | 5 tấm 1220 × 2440 × 17 |
| Vật liệu ván | — | rỗng (chưa gán vật liệu) |
| Dán cạnh | — | rỗng (plugin chưa có dữ liệu dán cạnh) |

Trong dự án ABF thật, lỗ cạnh có dạng `[8, 34, 4 điểm]` (sâu 34 + hình chữ nhật). Ở test.skp là `[8, -1, 1 điểm]`.
Nghĩa là ABF đọc được vị trí lỗ cạnh nhưng không nhận nhóm `_ABF_sideDrillDepth` do plugin vẽ. Chưa rõ nguyên nhân (hình dạng nhóm,
layer hay thuộc tính); kích thước chữ nhật trong dự án thật cũng không cố định (34×8,9 và 39,3×11,4) nên cần đọc hình học thật của
nhóm này: lệnh **Khảo sát model đang mở…** (bản 1.5.0 ghi đầy đủ đỉnh của nhóm ABF vào mục `shape`).
