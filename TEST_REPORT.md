# TEST_REPORT — Tủ Module Hùng Loan 1.4.1 (10/11/2026)

## 1. Môi trường thực tế
| Hạng mục | Trạng thái |
|---|---|
| SketchUp | **KHÔNG CÓ** (Linux, không có host). Plugin **chưa chạy trong SketchUp thật**. |
| ABF / ABF Nesting | **KHÔNG CÓ**. Trang `getabf.net` bị chặn (DNS ENOTFOUND). **Chưa kiểm chứng tương thích.** |
| Ruby | 3.3.6 (cú pháp giữ tương thích Ruby 2.7 của SketchUp 2021–2023) |
| Bộ SKP `DC_17MM_Model_Thuong.zip` | Có (111 file). Khảo sát sơ bộ ngoài SketchUp xong (`docs/khao_sat/`); hình học thật chưa đọc được — cần lệnh “Khảo sát bộ mẫu SKP” trên máy có SketchUp |

Ba mức kiểm thử, phân biệt rõ:
- **Thuần Ruby (lõi)** — kiểm thử thật công thức, ràng buộc, thuật toán.
- **Lớp SketchUp trên API giả lập** (`tests/mock_sketchup.rb`) — chỉ chứng minh luồng gọi, dữ liệu và operation không lồng; **không** chứng minh hình học pushpull, Undo, observer, HtmlDialog thật.
- **Trong SketchUp thật** — **chưa thực hiện**.

## 2. Kết quả chạy
| Bộ kiểm thử | Lệnh | Kết quả |
|---|---|---|
| Lõi | `ruby -Itests tests/test_core.rb` | **53 phép thử, 388 kiểm tra, 0 lỗi** |
| Luồng SketchUp (giả lập) | `ruby tests/test_su_flow.rb` | **15 phép thử, 218 kiểm tra, 0 lỗi** |
| Công cụ tương tác (view giả lập) | `ruby tests/test_su_tools.rb` | **4 phép thử, 12 kiểm tra, 0 lỗi** |
| Cú pháp mọi file `.rb` | `tools/build_rbz.sh` | Đạt |
| Gói RBZ | giải nén + nạp loader `hl_tumodule.rb` → `hl_tumodule/main` | Nạp được (trên giả lập); không chứa đường dẫn máy phát triển |

## 3. Bao phủ theo tiêu chí nghiệm thu (mục 15)
Ký hiệu: **R** = kiểm thử thuần Ruby đạt · **M** = chạy đạt trên giả lập · **—** = chưa kiểm thử (cần SketchUp/ABF)

| Tiêu chí | Mức |
|---|---|
| Cài RBZ, mở thư viện mẫu thật, nhớ thư mục/cửa sổ | M (nạp gói, mở dialog); nhớ vị trí cửa sổ dùng `preferences_key` — — |
| Bánh răng mở đúng hộp, đúng mẫu, không kích hoạt đặt | M (luồng `gear`); chặn lưu nhầm mẫu khác: M |
| Lưu setting A → đặt mới A dùng giá trị; B không đổi; lưu lần 2 thay bộ trước; nhớ qua phiên | R + M (file cấu hình còn sau khi nạp lại) |
| Module đã đặt không đổi khi đổi setting mẫu | R (tham số lưu theo instance), M |
| Đóng/Hủy không ghi; giá trị sai không lưu | R + M |
| Khôi phục setting gốc: chưa lưu cho tới khi bấm Lưu | R + M |
| Xuất/nhập sao lưu: thay toàn bộ, không gộp; file lỗi giữ nguyên | R + M |
| Mẫu từ ZIP | Khảo sát sơ bộ (tên chi tiết, số đo, thumbnail): xong ngoài SketchUp. Hình học/quy tắc đổi kích thước theo model gốc: — (cần JSON từ lệnh Khảo sát) |
| Cây thư mục/thư mục con, một mẫu nhiều thư mục, lọc toàn thư viện một kết quả/ID | R + M |
| Menu chuột phải thêm/bỏ khỏi thư mục | R (lõi), giao diện JS — — |
| Xoay 90° khi rê, điểm bám khớp preview/kết quả, đặt xong kết thúc lệnh | M (Tab xoay, đặt xong `select_tool(nil)`) |
| Cục trên khớp rộng/sâu, liên kết hai chiều, không vòng lặp | R + M |
| Đổi cao cục trên giữ cao cục dưới; Scale cả bộ theo tỷ lệ | R + M |
| Move cục dưới kéo cục trên | R + M |
| 4 tổ hợp nóc/đáy, giữ tổng cao, không chồng tấm | R |
| Tủ bếp: chỉ liên kết rộng, sâu độc lập, thẳng mặt sau, giữ cao độ, khoảng hở tính lại, báo khi giao | R + M (cả tủ xoay 90°: R) |
| Tủ hông snap trước/sau | M (luồng snap); hình học thật — — |
| Vách: 3 neo Tab, mốc trái/phải, gõ số + Enter, chuột không ghi đè | M |
| Đợt dừng trước hậu; sao chép 17 + 400 → bước 417 | R |
| Tạo mặt trước, chạy lại không nhân đôi | R + M |
| Move/thêm/xóa vách → đổi rộng/chia/gộp cánh | R + M |
| N mặt ngăn kéo, N khe 25 mm kể cả mặt trên, mặt phẳng | R + M |
| Thùng: 2 chế độ, hở 13/bên (600 → 574), sâu = ray, cao theo mẫu, báo khi không vừa | R + M |
| Hậu 3 kiểu, hậu khoang đứng không chia theo đợt | R |
| Chữ L hai kiểu không chồng tấm, chiều dài từ góc ngoài phía sau, sâu chung | R |
| Bo giữ R và độ dày sau resize, báo khi không vừa | R |
| Xoay/lồng Group rồi Move/Scale đúng local/world | R (đặt module xoay, phản chiếu chữ L), M (scale/move) — host — |
| Draft Thuộc tính không áp nhầm, Apply một lần | M |
| Undo/Redo, lưu/mở SKP, copy đối tượng | Copy → ID mới: M. Undo/lưu SKP — — |
| Hiệu năng model vừa | — (không đo được; không có số liệu) |
| Cam/chốt: dữ liệu trên đúng 2 tấm, tọa độ/hướng khớp, preset giữ khi resize, giữ điểm chỉnh riêng | R |
| Tiết diện: phân biệt hộp bao chồng giả (L), tấm nhận chưa xác định, rãnh đã bao phủ | R + M |
| Bản lề: tự động/thủ công, tránh đợt, không có vị trí → báo, chỉ trên cánh, 2 chính sách chia cánh | R + M |
| Khoan mặt và khoan cạnh sâu > độ dày nhưng hợp lệ | R |
| Sai mặt, ngoài vùng, cam lệch, tấm uốn chưa hỗ trợ, feature mồ côi → mã lỗi + ID | R |
| Bảng gia công trong Thuộc tính, xóa/khôi phục thao tác, tag ABF trên dấu và file xuất | R + M |
| Cài đặt chung: đổi tên layer/instance, thông số cam, cập nhật tủ đã đặt, nhớ qua phiên, chặn tên sai | R + M |
| Đối tượng ABF: tên nhóm, layer, thuộc tính `ABF`, ID đối tác, dấu độ sâu lỗ cạnh (đối chiếu dự án ABF thật) | R + M |
| **Bàn giao ABF/Nesting nạp trên phần mềm đích** | **— CHƯA KIỂM CHỨNG** |

## 4. Bảng bao phủ dữ liệu/feature gia công
| Feature | Dữ liệu (mặt, vị trí, hướng, Ø, sâu) | Kiểm tra tự động | Hiển thị SketchUp | Bản gia công (khoét) | ABF |
|---|---|---|---|---|---|
| Tấm phẳng chữ nhật | Có | R | M | M | — |
| Tấm chữ L / bo (giữ cung) | Có | R | M | M | — |
| Tấm uốn đầu bo | Có (`kind=bent`) | Báo `UNSUPPORTED_BENT` | M | Bỏ qua, liệt kê | — |
| Cam housing / lỗ cạnh / chốt | Có | R (khớp trục, chạm cốc) | M (vòng tròn) | M | — |
| Lỗ cốc bản lề | Có | R | M | M | — |
| Rãnh hậu | Có | R | Khoét thật (M) | M | — |
| Tiết diện | Có (đường bao + sâu) | R | M (đường bao) | M | — |

## 5. Đích ABF/Nesting
| Phần mềm | Phiên bản | File thử | Kết quả |
|---|---|---|---|
| ABF Nesting (máy người dùng, phiên bản chưa rõ) | — | `bantest.skp` dựng bằng plugin 1.1.0 | **Không đạt**: 18/27 tấm, 0 lỗ khoan (xem `docs/khao_sat/ABF_KET_QUA_THAT.md`). 1.2.0 đã sửa theo kết quả này, **chưa chạy lại** |

Bảng so sánh mong đợi/thực tế: `docs/ABF_HANDOFF.md` mục 5 (cột thực tế để trống).

## 6. Lỗi đã sửa sau khi chạy trên SketchUp thật (báo cáo của người dùng)
| Ngày | Lỗi | Nguyên nhân | Sửa |
|---|---|---|---|
| 08/11 | `undefined method 'entityID' for Sketchup::Entities` khi đặt module | Dùng `entityID` làm khóa gắn observer cho `Entities`/`Selection` — API thật không có; bản giả lập có nên không bắt được | Khóa theo loại đối tượng (`Observers.ident`); bỏ `entityID` khỏi giả lập để không che lỗi |
| 10/11 | ABF bỏ 12 tấm, không nhận lỗ | Rãnh hậu khoét vào khối; dấu lỗ là nét rời lồng 2 cấp | Rãnh thành dấu `ABF_RANH_HAU`, dấu lỗ thành nhóm mặt 1 cấp trong tấm (1.2.0) — chờ thử lại trên ABF |
