# Dấu vết quy ước ABF trong bộ mẫu DC_17MM

Trích từ tên tag (layer) lưu trong 111 file SKP. Đây là **bằng chứng về cách đặt tên**, chưa phải đặc tả ABF đã kiểm chứng: ý nghĩa từng tag, hình học nằm trên tag và nội dung dictionary cần lệnh “Khảo sát bộ mẫu SKP” trong SketchUp để đọc.

| Tag | Số file | Ví dụ file | Suy đoán ý nghĩa (CHƯA KIỂM CHỨNG) |
|---|---|---|---|
| `ABF_Label` | 12 | 01F - Mộng xương chó.skp | Nhãn chi tiết |
| `ABF_REF_2_DASHEDLINE` | 7 | 3444f868c3dce2c0051166d8c211a14b526429bd.skp | Đường tham chiếu nét đứt |
| `ABF_POCKET_Z6_HEM_KINH` | 4 | 3444f868c3dce2c0051166d8c211a14b526429bd.skp | Tên chứa Z6 — có thể là độ sâu 6 mm |
| `ABF_PROFILE_IN_VBIT_Z9` | 4 | 3444f868c3dce2c0051166d8c211a14b526429bd.skp | Tên chứa Z9 — có thể là độ sâu 9 mm |
| `ABF_POCKET_Z9_NEN_HUYNH` | 4 | 3444f868c3dce2c0051166d8c211a14b526429bd.skp | Tên chứa Z9 — có thể là độ sâu 9 mm |
| `ABF_PROFILE_ON_HUYNH` | 4 | 3444f868c3dce2c0051166d8c211a14b526429bd.skp |  |
| `ABF_Ranh_BaoVe` | 2 | 05G - Bàn cong 2 đầu.skp | Rãnh bảo vệ |
| `ABF_RANH_UONCONG` | 2 | 05G - Bàn cong 2 đầu.skp | Rãnh uốn cong |
| `ABF_HemKinh` | 2 | 1C.  Cánh Kính Hèm .skp | Hèm kính |
| `ABF_RANH_HAU` | 1 | 05B - Thùng ngăn kéo có ray.skp | Rãnh hậu |
| `ABF_CatTrong` | 1 | 1C.  Cánh Kính Hèm .skp | Cắt lọt bên trong |
| `ABF_D35` | 1 | 1C.  Cánh Kính Hèm .skp | Lỗ Ø35 (cốc bản lề?) |
| `ABF_cat_nha` | 1 | 3L1 - TẤM CẮT NHẢ.skp | Cắt nhả |

## Attribute dictionary

- `abf_object_data`: xuất hiện trong 8 file (vd 111111111111111.skp, 3444f868c3dce2c0051166d8c211a14b526429bd.skp, 498c88a39d2d626c3719e022e6b3ba1a77296edc.skp, 54ccee0d517cf454f8e8395d649cc7ceb6e495b7.skp)

## Tag khác (không phải ABF) dùng nhiều

- `Layer0`: 111 file
- `rac`: 14 file
- `3dshouse_dash_lines`: 10 file
- `TAM_HAU`: 8 file
- `Del`: 7 file
- `NetD`: 5 file
- `Vien_Khung`: 3 file
- `Bß╗Å`: 3 file
- `ki_hieu`: 3 file
- `Ki_hieu_lat`: 3 file
- `layer rac`: 3 file
- `Vien_canh`: 2 file
- `TayCoAm14`: 2 file
- `Vien`: 2 file
- `LAYER_1`: 2 file
- `RAY`: 1 file
