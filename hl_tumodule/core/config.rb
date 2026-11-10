# encoding: UTF-8
# CẤU HÌNH TẬP TRUNG. Mọi giá trị có nhãn DEMO là giá trị thử nghiệm đề xuất,
# KHÔNG phải thông số xưởng đã chốt (xem ASSUMPTIONS.md). Giá trị CHỐT là yêu cầu đã xác nhận.
module HungLoan
  module TuModule
    module Core
      module Config
        DISPLAY_NAME = 'Tủ Module Hùng Loan'.freeze
        SCHEMA_VERSION = 1

        # --- CHỐT (đặc tả mục 8, 8A)
        HANDLE_GAP = 25.0          # khe luồn tay trên mỗi mặt ngăn kéo
        RAIL_SIDE_CLEARANCE = 13.0 # hở ray bi mỗi bên hông thùng (tổng 26)

        # --- DEMO (đặc tả mục 13)
        BOARD_T = 17.0
        BACK_T = 7.0
        DOOR_EDGE_GAP = 2.0
        DOOR_MID_GAP = 2.0
        DEMO_RADIUS = 100.0
        BACK_SETBACK = 15.0        # lùi hậu từ mép sau (kiểu lọt/soi rãnh)
        GROOVE_DEPTH = 9.0         # sâu rãnh soi hậu (setting ABF của xưởng: SOI ÂM 9MM)
        GROOVE_TOL = 2.0           # rãnh rộng hơn hậu (intersect-x = 2 trong dự án ABF của xưởng)
        GROOVE_CLEAR = 1.0         # hậu ngắn hơn đáy rãnh mỗi phía
        ARC_SEG_PER_QUARTER = 12   # số đoạn hiển thị mỗi cung 90°
        MIN_CELL = 50.0            # lọt lòng tối thiểu một khoang
        SNAPSHOT_CARVE = false     # true: khoét lỗ/rãnh thật vào bản gia công (ABF không nhận tấm đã khoét rãnh)
        PLINTH_SETBACK = 50.0      # lùi len chân trước (DEMO)
        STRETCHER_W = 100.0        # bản rộng xà thay nóc (DEMO)
        DRAWER_BOX_SIDE_T = 15.0
        DRAWER_BOX_BOTTOM_T = 7.0
        DRAWER_BOX_BOTTOM_OFFSET = 15.0 # chế độ cả cụm: đáy thùng cao hơn đáy mặt ngăn kéo
        RAIL_LENGTHS = [250, 300, 350, 400, 450, 500, 550].freeze # DEMO, chưa phải danh sách ray xưởng
        KITCHEN_UPPER_GAP = 600.0  # khoảng hở mặc định tủ bếp dưới → đáy tủ bếp trên
        AUTO_TWO_DOORS_OVER = 600.0 # khoang rộng hơn số này → mặc định 2 cánh

        # Cam Minifix + chốt cam — PRESET DEMO, chưa kiểm chứng xưởng.
        CAM_PRESET_DEMO = {
          'name' => 'Minifix 15 (DEMO)',
          'demo' => true,
          'cam_diameter' => 15.0, 'cam_depth' => 13.0,   # G-code xưởng khoan Z4 trên ván 17 = sâu 13
          'cam_offset' => 24.0,          # tâm cốc cam cách mặt tiếp xúc
          'edge_diameter' => 8.0, 'edge_depth' => 34.0, # lỗ cạnh tấm mang cam
          'bolt_diameter' => 5.0, 'bolt_depth' => 13.0, # lỗ chốt cam trên mặt tấm kia
          'end_setback' => 50.0,
          'count_rules' => [[150.0, 1], [600.0, 2], [1000.0, 3], [1.0e9, 4]],
          'min_thickness' => 15.0
        }.freeze
        CAM_ROLES = %w[side top bottom partition shelf l_end stretcher].freeze

        # Bản lề — bộ quy tắc DEMO (có thể lưu nhiều bộ).
        HINGE_PRESET_DEMO = {
          'name' => 'Mặc định (DEMO)',
          'demo' => true,
          'diameter' => 35.0, 'depth' => 12.5,
          'edge_offset' => 22.5,   # tâm cốc cách cạnh cánh phía bản lề
          'end_offset' => 100.0,   # bản lề đầu/cuối cách mép trên/dưới cánh
          'shelf_clearance' => 25.0, # nửa vùng cấm quanh đợt (đế bản lề)
          'min_spacing' => 60.0,
          'thresholds' => [[900.0, 2], [1600.0, 3], [2000.0, 4], [2400.0, 5]]
        }.freeze

        # Tiết diện giao nhau: ưu tiên vai trò làm tấm NHẬN dấu (lớn hơn nhận). DEMO.
        SECTION_RECEIVER_PRIORITY = {
          'side' => 50, 'l_end' => 50, 'partition' => 40, 'top' => 40, 'bottom' => 40, 'stretcher' => 35, 'plinth' => 25,
          'shelf' => 30, 'drawer_side' => 20, 'drawer_front' => 20, 'drawer_back' => 20,
          'drawer_bottom' => 10, 'back' => 5, 'door' => 1, 'drawer_face' => 1, 'bent_end' => 0
        }.freeze

        ROLE_LABELS = {
          'side' => 'Hồi', 'top' => 'Đình', 'bottom' => 'Đáy', 'back' => 'Hậu', 'partition' => 'Vách',
          'shelf' => 'Đợt', 'door' => 'Cánh', 'drawer_face' => 'Mặt Ngăn Kéo', 'drawer_side' => 'Thành NK',
          'drawer_front' => 'Thành Trước NK', 'drawer_back' => 'Thành Sau NK', 'drawer_bottom' => 'Tấm Đáy NK',
          'bent_end' => 'Tấm uốn đầu bo', 'l_end' => 'Hồi chữ L', 'plinth' => 'Chân', 'stretcher' => 'Xà'
        }.freeze
        # Tên riêng theo vị trí (ABF in nhãn theo tên nhóm) — theo cách gọi trong model của xưởng.
        PANEL_NAMES = {
          'side_L' => 'Hồi Trái', 'side_R' => 'Hồi Phải', 'plinth_F' => 'Chân Trước', 'plinth_B' => 'Chân Sau',
          'stretcher_F' => 'Xà Trước', 'stretcher_B' => 'Xà Sau', 'end_A' => 'Hồi nhánh A', 'end_B' => 'Hồi nhánh B',
          'back_A' => 'Hậu nhánh A', 'back_B' => 'Hậu nhánh B'
        }.freeze
        PANEL_SUFFIX = { 'side_L' => 'Thành Trái NK', 'side_R' => 'Thành Phải NK' }.freeze # cho thùng ngăn kéo "<id>:side_L"
      end
    end
  end
end
