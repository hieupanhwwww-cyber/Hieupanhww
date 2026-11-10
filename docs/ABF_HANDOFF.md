# Bàn giao ABF/Nesting — quy trình kiểm chứng

**Trạng thái: CHƯA KIỂM CHỨNG TƯƠNG THÍCH.** Tiêu chí 10D (ABF nhận đúng tấm, cam/chốt, lỗ cốc, tiết diện/rãnh) **chưa đạt**
cho tới khi có kết quả nạp thật trên ABF/Nesting ghi vào bảng dưới.

## 0. Kết quả thật đầu tiên (10/11/2026)
Người dùng đã chạy ABF Nesting trên model của plugin 1.1.0: ABF nhận 18/27 tấm, **0 lỗ khoan**, 12 tấm có rãnh khoét bị bỏ.
Chi tiết và cách sửa ở 1.2.0: `docs/khao_sat/ABF_KET_QUA_THAT.md`. Cần chạy lại trên 1.2.0 để biết đã nhận đủ tấm và lỗ chưa.

## 1. Vì sao chưa kiểm chứng
- Môi trường xây dựng không có SketchUp, không có ABF/Nesting.
- Tài liệu công khai ABF (`getabf.net`) không truy cập được từ môi trường (lỗi DNS ENOTFOUND, 07/11/2026).
- Chưa có file đối chiếu nào “ABF đọc đúng” từ người dùng.
- Vì vậy plugin **không** tự đặt tên dictionary/tag/layer “giống ABF”.

## 2. Đầu ra hiện có
| Đầu ra | Lệnh | Nội dung |
|---|---|---|
| Bản gia công trong SketchUp | *Tạo bản gia công* | Mỗi chi tiết = 1 Group đặc **một cấp**, trục local: z = pháp tuyến, mặt A ở z = độ dày. Lỗ khoan mặt/cạnh, rãnh hậu, tiết diện được **khoét vào hình học** đúng đường kính/độ sâu. Thuộc tính `HungLoan_MFG`: `part_id`, `role`, `thickness_mm`, `ops` (JSON đầy đủ mặt, tọa độ, hướng, Ø, sâu). Material giữ theo tấm. Model gốc không bị explode. |
| Dữ liệu trung lập | *Xuất dữ liệu gia công* | `*.json` (format `HLTM-MFG` v1, mm) + `*_chi_tiet.csv` + `*_thao_tac.csv` |
| Dữ liệu mong đợi mẫu | `docs/abf_samples/` | Kết quả lõi cho bộ ca kiểm thử (47 chi tiết, 79 thao tác) |

## 2b. Quy ước tag ABF đang áp dụng (từ 1.1.0)
Nguồn: tên tag có sẵn trong bộ mẫu `DC_17MM` của xưởng (`docs/khao_sat/ABF_TAGS.md`). Mức bằng chứng: **quan sát tên tag trong file mẫu**,
chưa nạp thử trên ABF. Quy tắc nằm một chỗ: `hl_tumodule/core/abf_rules.rb`.

| Thao tác plugin | Tag gắn | Căn cứ trong bộ mẫu |
|---|---|---|
| Lỗ cốc bản lề Ø35 | `ABF_D35` | Tag `ABF_D35` trong “1C. Cánh Kính Hèm” |
| Cốc cam Ø15, lỗ cạnh Ø8, chốt Ø5 | `ABF_D15`, `ABF_D8`, `ABF_D5` | Suy rộng mẫu tên `ABF_D{Ø}` — **giả định** |
| Rãnh hậu | `ABF_RANH_HAU` | Tag `ABF_RANH_HAU` trong “05B - Thùng ngăn kéo có ray” |
| Tiết diện (khoét sâu n mm) | `ABF_POCKET_Z{n}` | Mẫu tên `ABF_POCKET_Z6_…`, `ABF_POCKET_Z9_…` — **giả định** phần đuôi |
| Tiết diện xuyên hết | `ABF_CatTrong` | Tag `ABF_CatTrong` trong “1C. Cánh Kính Hèm” |

Mỗi tấm trong bản gia công có nhóm con “Dấu gia công”, bên trong chia nhóm theo tag; hình khoét thật vẫn giữ.
Chưa dùng: dictionary `abf_object_data` (chưa đọc được nội dung — cần file `khao_sat_mau.json` từ lệnh Khảo sát).

## 3. Bảng ánh xạ (cần điền khi kiểm chứng)
| Schema nội bộ | Bản gia công | Khóa/định dạng ABF | Nguồn kiểm chứng | Phiên bản ABF |
|---|---|---|---|---|
| Chi tiết tấm | Group đặc một cấp | CHƯA XÁC ĐỊNH | — | — |
| Mặt A/B, hướng | Trục local z | CHƯA XÁC ĐỊNH | — | — |
| Cốc cam / chốt (khoan mặt) | Lỗ khoét sâu | CHƯA XÁC ĐỊNH | — | — |
| Lỗ cạnh cam | Lỗ khoét từ mặt cạnh | CHƯA XÁC ĐỊNH | — | — |
| Lỗ cốc bản lề | Lỗ khoét mặt B cánh | CHƯA XÁC ĐỊNH | — | — |
| Rãnh hậu | Rãnh khoét | CHƯA XÁC ĐỊNH | — | — |
| Tiết diện | Vùng khoét theo đường bao | CHƯA XÁC ĐỊNH | — | — |
| Vật liệu/độ dày | Material + `thickness_mm` | CHƯA XÁC ĐỊNH | — | — |

## 4. Thực hiện phép thử trên máy có ABF
1. Cài `dist/hl_tumodule.rbz`, mở model trống.
2. *Extensions › Tủ Module Hùng Loan › Dựng bộ ca kiểm thử ABF* — tạo 4 ca:
   - Ca 1: khung tủ, nóc/đáy lọt, **hậu soi rãnh**, 1 đợt, 2 **cánh có lỗ cốc**, **cam/chốt**.
   - Ca 2: **tủ chữ L** một thùng (nóc/đáy chữ L thật) + cam.
   - Ca 3: bộ tủ **xoay 90°** + tủ hông ép xuyên 7 mm → **1 tiết diện**.
   - Ca 4: 3 mặt ngăn kéo khe 25 mm + cụm 3 thùng ray 450.
3. *Kiểm tra dữ liệu sản xuất* (phải 0 lỗi; cảnh báo DEMO là bình thường).
4. *Tạo bản gia công* → chuẩn bị/nạp bản gia công theo quy trình ABF/Nesting bạn đang dùng.
5. *Xuất dữ liệu gia công* để có JSON/CSV đối chiếu.
6. So từng mục, ghi vào bảng mục 5: số tấm, số thao tác, mặt/cạnh, tọa độ, hướng, Ø, sâu, đường bao tiết diện/rãnh.
7. Thử thêm: đổi kích thước/Move/Scale/xóa/copy tấm rồi tạo lại bản gia công — số thao tác phải cập nhật, không trùng.
8. Gửi lại: phiên bản ABF/Nesting, ảnh/xuất từ ABF, bảng so sánh. Nếu ABF cần cấu trúc khác (tên, layer, thuộc tính, dạng lỗ), gửi **một file SKP mẫu ABF đã đọc đúng** — tôi sẽ viết bộ chuyển đổi theo đúng mẫu đó.

## 5. Bảng so sánh mong đợi / thực tế
| Hạng mục | Mong đợi (plugin) | Thực tế ABF | Đạt? |
|---|---|---|---|
| Số chi tiết (4 ca) | 47 | | |
| Tổng thao tác | 79 | | |
| Cạnh cam / bộ cam-chốt | 10 cạnh / 20 bộ (mỗi bộ: cốc cam + lỗ cạnh + chốt) | | |
| Lỗ cốc bản lề | 6 (2 cánh × 3) | | |
| Rãnh hậu | 12 (ca 1: 4, tủ hông ca 3: 4, ca 4: 4) | | |
| Tiết diện | 1 (ca 3, sâu 7 mm trên hồi phải) | | |
| Nóc/đáy chữ L nhận đúng biên dạng | 2 tấm, mỗi tấm 6 đỉnh | | |
| Tủ xoay: vị trí lỗ không lật | đúng | | |

Chi tiết từng tấm: `docs/abf_samples/BANG_MONG_DOI.md`.
