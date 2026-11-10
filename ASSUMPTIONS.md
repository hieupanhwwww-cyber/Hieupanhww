# ASSUMPTIONS — Giả định triển khai (Tủ Module Hùng Loan 1.0.0)

Các điểm dưới đây là **lựa chọn tạm để có bản chạy được**, không phải xác nhận của người dùng. Mọi số liệu tập trung ở
`hl_tumodule/core/config.rb` (nhãn DEMO/CHỐT) và `hl_tumodule/core/templates.rb`.

## A. Thay đổi so với đặc tả do ràng buộc thực tế

| # | Đặc tả | Thực tế triển khai | Lý do |
|---|---|---|---|
| A1 | Làm thông minh mẫu từ bộ `DC_17MM_Model_Thuong.zip` | 10 template **sinh bằng Ruby**; 6 mẫu gắn thumbnail thật; khảo sát sơ bộ 111 file ở `docs/khao_sat/` | ZIP nhận ngày 08/11 nhưng môi trường không có SketchUp để đọc hình học SKP (định dạng nhị phân riêng). Đã thêm lệnh “Khảo sát bộ mẫu SKP” chạy trong SketchUp để lấy số đo thật ở bước sau. |
| A2 | Phím xoay tạm R | **Tab** hoặc **← / →** | Trong SketchUp, R là phím tắt mặc định của Rectangle — dễ bị SketchUp bắt trước công cụ. Tab và phím mũi tên không xung đột trong công cụ đặt. |
| A3 | Bộ chuyển đổi ABF/Nesting đã kiểm chứng | “Bản gia công” trung lập (tấm phẳng một cấp, lỗ/rãnh khoét thật, metadata `HungLoan_MFG`) + JSON/CSV. **Chưa kiểm chứng ABF** | Không có ABF/Nesting; `getabf.net` bị chặn mạng. Bộ mẫu ZIP có dấu vết quy ước ABF (tag `ABF_RANH_HAU`, `ABF_D35`, `ABF_POCKET_Z6_*`, dictionary `abf_object_data` — xem `docs/khao_sat/ABF_TAGS.md`) nhưng mới là tên, chưa đọc được hình học/nội dung; chưa đủ để viết bộ chuyển đổi chắc chắn. |
| A4 | Bo đầu hồi theo chiều cao | Đầu tủ bo bán kính R chạy suốt chiều cao: nóc/đáy/đợt bo, hồi phải rút ngắn, thêm **tấm uốn** | Tấm uốn được đánh dấu **chưa hỗ trợ gia công** (chưa có quy tắc trải phẳng), theo mục 10C-A. |
| A5 | Vách/đợt trong tủ chữ L | Chưa hỗ trợ công cụ vách/đợt/thùng cho module chữ L | Khoang chữ L không phải hình chữ nhật; để đợt sau. |

## B. Giả định theo mục 13 đặc tả

- **Tên/namespace**: hiển thị “Tủ Module Hùng Loan”; Ruby `HungLoan::TuModule`; attribute dictionary `HungLoan_TuModule`.
- **Phiên bản**: nhắm SketchUp 2021+ (Ruby 2.7+, `UI::HtmlDialog`, `Model#active_path=` từ 2020). **Chưa kiểm thử trong host.**
- **Bỏ mẫu khỏi thư mục cuối cùng**: mẫu vẫn hiện ở “Tất cả mẫu” và bộ lọc loại, giữ setting.
- **Giá trị DEMO**: ván 17, hậu 7, khe cánh/khe biên 2, R mẫu 100, lùi hậu 15, rãnh hậu sâu 8 (rộng = hậu + 0,5), hậu ngắn hơn đáy rãnh 1 mm mỗi phía, cung 12 đoạn/90°. **CHỐT**: khe luồn tay 25 mm, hở ray bi 13 mm/bên, sâu thùng = chiều dài ray.
- **Rãnh hậu** chạy suốt chiều dài tấm (rãnh thông), không rãnh dừng.
- **Vách trong ô đã bị đợt chia**: fit ô đang trỏ, không xuyên đợt (chính sách ở `Interior.insert_divider`).
- **Đợt**: cùng luồng gõ số → Enter như vách, mốc dưới/trên theo phía gần chuột.
- **Sao chép vách**: dùng khoảng lọt lòng như đợt.
- **Cánh**: mỗi khoang đứng (giữa hai vách cấp gốc) một vùng cánh; đợt không chia cánh; vách lồng trong ô đã bị đợt chia **không** chia cánh. Khoang rộng > 600 mm mặc định 2 cánh. “Số cánh khoang N” là override chia đều **trong** khoang đó — không xung đột biên vách.
- **Mặt ngăn kéo**: phủ ngoài toàn module; phân bổ (cao − khe biên dưới) theo tỷ lệ, mỗi phần trừ 25 mm khe tay ở trên. Lọt lòng: trong lòng thùng tương tự.
- **Thùng ngăn kéo**:
  - Mốc đo chiều cao: **mặt trong đáy khoang**.
  - Mặt trước thùng bắt đầu tại mặt trước lòng khoang (sau cánh lọt nếu có).
  - Cấu tạo: 2 hông suốt sâu, đầu/hậu thùng lọt giữa hai hông, đáy lọt đặt dưới cùng (hông dày 15, đáy 7 — DEMO).
  - Cả cụm: đáy thùng = đáy mặt ngăn kéo + 15 mm (DEMO); khoang không có mặt ngăn kéo: chia đều số thùng ở setting.
  - Thùng và mặt ngăn kéo **di chuyển độc lập** (chưa liên kết Move). Khi đổi kích thước tủ: rộng tính lại = lọt lòng − 26, giữ cao và ray, báo nếu không vừa.
  - Danh sách ray 250–550 mm là DEMO, chưa phải danh sách ray xưởng.
- **Tủ bếp**: khoảng hở mặc định 600 mm (DEMO). Move tủ bếp dưới kéo tủ trên theo x/y, giữ cao độ (giả định). Tủ trên luôn được căn lại mặt sau theo tủ dưới mỗi lần giải.
- **Move kéo ngược cục trên / tủ hông**: cục trên Move độc lập rồi được giải lại về nóc cục dưới; tủ hông Move tự do. Chế độ “cả bộ” Move toàn bộ.
- **Draft Thuộc tính**: nháp giữ theo ID; chỉ Apply nháp của đối tượng đang hiện.
- **Cam/chốt (DEMO, chưa kiểm chứng)**: cốc cam Ø15 sâu 12,5, tâm cách mặt tiếp xúc 24; lỗ cạnh Ø8 sâu 34; chốt Ø5 sâu 11; lùi đầu cạnh 50; số lượng theo dài tiếp xúc ≤150:1, ≤600:2, ≤1000:3, >1000:4; tấm ≥ 15 mm. Mặt đặt cam mặc định: mặt hướng vào lòng tủ. Đợt được coi là đợt cố định (có cam). Hậu, cánh, thùng không đặt cam.
- **Bản lề (DEMO)**: Ø35 sâu 12,5, tâm cách cạnh 22,5, bản lề đầu/cuối cách mép 100, vùng tránh quanh đợt ±25, cách nhau ≥ 60; ngưỡng ≤900:2, ≤1600:3, ≤2000:4, ≤2400:5. Cánh 1 cánh: bản lề trái; 2 cánh: trái/phải.
- **Tiết diện**: chỉ cặp **xuyên thật** (thể tích giao > 0 và hình chiếu thật trên cả hai tấm > 0). Tấm nhận theo bảng ưu tiên vai trò (hồi 50 > vách/nóc/đáy 40 > đợt 30 > thùng 20 > hậu 5 > cánh 1); cùng mức → “chưa xác định”, người dùng chọn. Kiểu dấu: khoét sâu (pocket) theo độ xuyên; xuyên hết độ dày → khoét suốt. Cặp đã có rãnh soi bao phủ → bỏ qua.
- **Tủ vát theo tường/mái**: **hoãn**, ngoài bản đầu.

- **Tag ABF (từ 1.1.0)**: tên tag theo quy ước quan sát trong bộ mẫu của xưởng; `ABF_D35`, `ABF_RANH_HAU`, `ABF_CatTrong` có nguyên văn trong mẫu,
  còn `ABF_D{Ø}` cho đường kính khác và `ABF_POCKET_Z{n}` là suy rộng mẫu tên. Chưa nạp thử trên ABF. Sửa tại `core/abf_rules.rb`.
- **Xóa thao tác gia công trong Thuộc tính**: xóa theo nguồn — lỗ cam xóa cả bộ của cạnh; lỗ cốc chuyển cánh sang thủ công; rãnh/khác ghi vào danh sách đã xóa.

- **Rãnh hậu (đổi ở 1.2.0)**: mặc định KHÔNG khoét vào khối tấm vì ABF thật không nhận tấm đã khoét rãnh; rãnh là nhóm dấu `ABF_RANH_HAU`.
  Hệ quả: trong 3D, hậu “ăn” vào hồi/nóc/đáy 7 mm (đúng thực tế lắp, nhưng không thấy rãnh). Chọn “Khoét thật” trong Thuộc tính nếu cần.
- **Dấu gia công kiểu ABF (1.2.0)**: nhóm một cấp trong tấm, mặt phẳng trên mặt ván — theo cách file mẫu xưởng làm. Việc ABF đọc được lỗ từ dạng này là **giả thuyết chưa thử**.
- **Len chân**: cao 50 (khung tủ) / 100 (bếp) là số đọc từ model nguồn (50) và DEMO (100); lùi trước 50 DEMO; len chân dày bằng ván thân; có chân thì đáy buộc lọt.
- **Xà thay nóc**: hai xà nằm ngang, bản rộng 100 DEMO, lọt giữa hai hồi; xà sau nhận rãnh hậu.

## C. Giới hạn đã biết của bản 1.0.0

- Chưa chạy trong SketchUp thật: hình học `pushpull` khoét rãnh/lỗ, observer, HtmlDialog, Undo cần kiểm tra trên host.
- Không hỗ trợ lật (scale âm) module/bộ tủ — plugin hoàn lại và báo.
- Vật liệu chỉ giữ khi gán lên **nhóm tấm** (Paint Bucket lên tấm); gán vào mặt bên trong nhóm sẽ mất khi tấm tái sinh.
- Sao chép (Ctrl+C/V) một module/bộ tủ: ID mới được cấp ở lần chỉnh sửa/xuất đầu tiên.
- Công cụ vách/đợt/thùng chỉ cho thùng chữ nhật (không cho chữ L).
- Tiết diện với tấm đối tác cong/không chữ nhật vuông góc: tính gần đúng, có cảnh báo `SECTION_APPROX`.
- Không có ray âm/ray hộp, không G-code/postprocessor, không nesting nội bộ (đúng phạm vi).
