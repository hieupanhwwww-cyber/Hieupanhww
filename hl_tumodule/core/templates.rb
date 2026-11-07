# encoding: UTF-8
# Catalog mẫu đi kèm plugin. Bộ SKP nguồn (DC_17MM_Model_Thuong.zip) KHÔNG có trong môi trường
# xây dựng, nên các mẫu dưới đây là template sinh bằng Ruby (phương án bổ sung theo mục 3 đặc tả).
# 'source_candidate' ghi tên file SKP tương ứng để đối chiếu khi có bộ ZIP.
require_relative 'config'

module HungLoan
  module TuModule
    module Core
      module Templates
        C = Config

        MODULE_TYPES = [
          ['khung_tu', 'Khung tủ'], ['cuc_tren', 'Cục tủ trên'], ['tu_hong', 'Tủ hông'],
          ['tu_bep_duoi', 'Tủ bếp dưới'], ['tu_bep_tren', 'Tủ bếp trên'], ['tu_bep_L', 'Tủ bếp chữ L'],
          ['tu_L', 'Tủ chữ L'], ['tu_ngan_keo', 'Tủ ngăn kéo'], ['thung_ngan_keo', 'Thùng ngăn kéo'],
          ['tu_bo', 'Tủ đầu bo']
        ].freeze

        JOINT_OPTS = [['inset', 'Lọt giữa hai hồi'], ['overlay', 'Phủ lên hai hồi']].freeze
        BACK_OPTS = [['overlay', 'Đóng phủ phía sau'], ['inset', 'Lọt trong lòng'], ['groove', 'Soi rãnh']].freeze
        MOUNT_OPTS = [['overlay', 'Phủ ngoài'], ['inset', 'Lọt lòng']].freeze

        def self.f(key, label, type, extra = {})
          { 'key' => key, 'label' => label, 'type' => type }.merge(extra)
        end

        BOX_FIELDS = [
          f('w', 'Rộng (mm)', 'mm', 'min' => 150, 'max' => 3000),
          f('d', 'Sâu (mm)', 'mm', 'min' => 150, 'max' => 1200),
          f('h', 'Cao (mm)', 'mm', 'min' => 100, 'max' => 3000),
          f('t', 'Độ dày ván (mm)', 'mm', 'min' => 5, 'max' => 50),
          f('tb', 'Độ dày hậu (mm)', 'mm', 'min' => 3, 'max' => 25),
          f('top_joint', 'Nóc', 'enum', 'options' => JOINT_OPTS),
          f('bottom_joint', 'Đáy', 'enum', 'options' => JOINT_OPTS),
          f('back_mode', 'Kiểu hậu', 'enum', 'options' => BACK_OPTS),
          f('back_scope', 'Phạm vi hậu', 'enum', 'options' => [['whole', 'Hậu chung toàn thùng'], ['per_column', 'Hậu riêng từng khoang đứng']]),
          f('back_setback', 'Lùi hậu (mm)', 'mm', 'min' => 0, 'max' => 100),
          f('groove_depth', 'Sâu rãnh hậu (mm)', 'mm', 'min' => 2, 'max' => 15),
          f('front_mount', 'Cánh/mặt', 'enum', 'options' => MOUNT_OPTS),
          f('edge_gap', 'Khe biên cánh (mm)', 'mm', 'min' => 0, 'max' => 10),
          f('mid_gap', 'Khe giữa cánh (mm)', 'mm', 'min' => 0, 'max' => 10)
        ].freeze

        BASE_DEFAULTS = {
          'w' => 800.0, 'd' => 550.0, 'h' => 900.0, 't' => C::BOARD_T, 'tb' => C::BACK_T,
          'top_joint' => 'overlay', 'bottom_joint' => 'inset', 'back_mode' => 'groove', 'back_scope' => 'whole',
          'back_setback' => C::BACK_SETBACK, 'groove_depth' => C::GROOVE_DEPTH,
          'front_mount' => 'overlay', 'edge_gap' => C::DOOR_EDGE_GAP, 'mid_gap' => C::DOOR_MID_GAP,
          'corner_radius' => 0.0, 'end_round' => 0.0, 'side_radius' => 0.0,
          'drawer_count' => 3, 'drawer_ratios' => '1,1,1'
        }.freeze

        def self.tpl(h)
          {
            'supported' => true, 'source' => 'ruby_generated', 'front_rule' => 'doors',
            'link_role' => 'base', 'anchor' => { 'fx' => 0.0, 'fy' => 0.0, 'fz' => 0.0, 'label' => 'Góc trái-trước-dưới' },
            'fields' => BOX_FIELDS
          }.merge(h)
        end

        CATALOG = [
          tpl('id' => 'hl.khung_tu.v1', 'name' => 'Khung tủ', 'module_type' => 'khung_tu', 'geometry' => 'carcass',
              'category' => 'Khung tủ', 'link_role' => 'stack_lower', 'source_candidate' => '1. KHUNG TỦ.skp',
              'defaults' => BASE_DEFAULTS.merge('w' => 900.0, 'd' => 580.0, 'h' => 2000.0)),
          tpl('id' => 'hl.cuc_tren.v1', 'name' => 'Cục tủ trên', 'module_type' => 'cuc_tren', 'geometry' => 'carcass',
              'category' => 'Khung tủ', 'link_role' => 'stack_upper', 'source_candidate' => '1.CucTuTren.skp',
              'defaults' => BASE_DEFAULTS.merge('w' => 900.0, 'd' => 580.0, 'h' => 500.0, 'bottom_joint' => 'overlay')),
          tpl('id' => 'hl.tu_hong.v1', 'name' => 'Tủ hông', 'module_type' => 'tu_hong', 'geometry' => 'carcass',
              'category' => 'Khung tủ', 'link_role' => 'side', 'source_candidate' => nil,
              'defaults' => BASE_DEFAULTS.merge('w' => 400.0, 'd' => 350.0, 'h' => 1200.0)),
          tpl('id' => 'hl.tu_bep_duoi.v1', 'name' => 'Tủ bếp dưới (thẳng)', 'module_type' => 'tu_bep_duoi', 'geometry' => 'carcass',
              'category' => 'Tủ bếp', 'link_role' => 'kitchen_lower', 'source_candidate' => '3. TỦ BẾP DƯỚI (THẲNG).skp',
              'defaults' => BASE_DEFAULTS.merge('w' => 800.0, 'd' => 560.0, 'h' => 810.0, 'top_joint' => 'inset')),
          tpl('id' => 'hl.tu_bep_tren.v1', 'name' => 'Tủ bếp trên', 'module_type' => 'tu_bep_tren', 'geometry' => 'carcass',
              'category' => 'Tủ bếp', 'link_role' => 'kitchen_upper', 'source_candidate' => '3.TỦ BẾP TRÊN.skp',
              'anchor' => { 'fx' => 0.0, 'fy' => 1.0, 'fz' => 0.0, 'label' => 'Góc trái-sau-dưới' },
              'fields' => BOX_FIELDS + [f('upper_gap', 'Khoảng hở tủ dưới → tủ trên (mm)', 'mm', 'min' => 0, 'max' => 2000)],
              'defaults' => BASE_DEFAULTS.merge('w' => 800.0, 'd' => 350.0, 'h' => 700.0, 'bottom_joint' => 'overlay',
                                                'upper_gap' => C::KITCHEN_UPPER_GAP)),
          tpl('id' => 'hl.tu_bep_L.v1', 'name' => 'Tủ bếp dưới chữ L', 'module_type' => 'tu_bep_L', 'geometry' => 'l_two_box',
              'category' => 'Tủ bếp', 'link_role' => 'base', 'source_candidate' => '3. Tủ Bếp Dưới L.skp',
              'anchor' => { 'fx' => 0.0, 'fy' => 1.0, 'fz' => 0.0, 'label' => 'Góc ngoài phía sau' },
              'fields' => [
                f('la', 'Chiều dài nhánh A (mm, từ góc ngoài phía sau)', 'mm', 'min' => 600, 'max' => 5000),
                f('lb', 'Chiều dài nhánh B (mm, từ góc ngoài phía sau)', 'mm', 'min' => 600, 'max' => 5000),
                f('d', 'Chiều sâu chung (mm)', 'mm', 'min' => 300, 'max' => 800),
                f('h', 'Cao (mm)', 'mm', 'min' => 300, 'max' => 1200),
                f('t', 'Độ dày ván (mm)', 'mm', 'min' => 5, 'max' => 50),
                f('tb', 'Độ dày hậu (mm)', 'mm', 'min' => 3, 'max' => 25),
                f('l_orient', 'Hướng', 'enum', 'options' => [['right', 'Nhánh B bên trái (góc trái)'], ['left', 'Nhánh B bên phải (góc phải)']]),
                f('edge_gap', 'Khe biên cánh (mm)', 'mm', 'min' => 0, 'max' => 10),
                f('mid_gap', 'Khe giữa cánh (mm)', 'mm', 'min' => 0, 'max' => 10)
              ],
              'defaults' => BASE_DEFAULTS.merge('la' => 2400.0, 'lb' => 1800.0, 'd' => 560.0, 'h' => 810.0,
                                                'l_orient' => 'right', 'top_joint' => 'inset', 'back_mode' => 'groove')),
          tpl('id' => 'hl.tu_L_mot_thung.v1', 'name' => 'Tủ chữ L một thùng', 'module_type' => 'tu_L', 'geometry' => 'l_single',
              'category' => 'Tủ chữ L', 'link_role' => 'base', 'source_candidate' => nil,
              'anchor' => { 'fx' => 0.0, 'fy' => 1.0, 'fz' => 0.0, 'label' => 'Góc ngoài phía sau' },
              'fields' => [
                f('la', 'Chiều dài nhánh A (mm, từ góc ngoài phía sau)', 'mm', 'min' => 400, 'max' => 5000),
                f('lb', 'Chiều dài nhánh B (mm, từ góc ngoài phía sau)', 'mm', 'min' => 400, 'max' => 5000),
                f('d', 'Chiều sâu chung (mm)', 'mm', 'min' => 200, 'max' => 800),
                f('h', 'Cao (mm)', 'mm', 'min' => 200, 'max' => 2600),
                f('t', 'Độ dày ván (mm)', 'mm', 'min' => 5, 'max' => 50),
                f('tb', 'Độ dày hậu (mm)', 'mm', 'min' => 3, 'max' => 25),
                f('l_orient', 'Hướng', 'enum', 'options' => [['right', 'Nhánh B bên trái'], ['left', 'Nhánh B bên phải']]),
                f('edge_gap', 'Khe biên cánh (mm)', 'mm', 'min' => 0, 'max' => 10),
                f('mid_gap', 'Khe giữa cánh (mm)', 'mm', 'min' => 0, 'max' => 10)
              ],
              'defaults' => BASE_DEFAULTS.merge('la' => 1600.0, 'lb' => 1200.0, 'd' => 400.0, 'h' => 800.0, 'l_orient' => 'right')),
          tpl('id' => 'hl.tu_ngan_keo3.v1', 'name' => 'Tủ 3 ngăn kéo', 'module_type' => 'tu_ngan_keo', 'geometry' => 'carcass',
              'category' => 'Ngăn kéo', 'link_role' => 'stack_lower', 'front_rule' => 'drawers', 'source_candidate' => nil,
              'fields' => BOX_FIELDS + [
                f('drawer_count', 'Số mặt ngăn kéo', 'int', 'min' => 1, 'max' => 8),
                f('drawer_ratios', 'Tỷ lệ chiều cao từ dưới lên (vd 2,1,1)', 'ratios')
              ],
              'defaults' => BASE_DEFAULTS.merge('w' => 600.0, 'd' => 500.0, 'h' => 720.0, 'drawer_count' => 3,
                                                'drawer_ratios' => '1,1,1')),
          tpl('id' => 'hl.thung_ngan_keo.v1', 'name' => 'Thùng ngăn kéo ray bi', 'module_type' => 'thung_ngan_keo',
              'geometry' => 'drawer_box', 'category' => 'Ngăn kéo', 'link_role' => 'insert', 'front_rule' => 'open',
              'source_candidate' => '05B - Thùng ngăn kéo có ray.skp',
              'anchor' => { 'fx' => 0.0, 'fy' => 0.0, 'fz' => 0.0, 'label' => 'Theo khoang (Tab: đáy/tim/đỉnh)' },
              'fields' => [
                f('box_height', 'Chiều cao thùng (mm)', 'mm', 'min' => 60, 'max' => 400),
                f('rail_length', 'Chiều dài ray bi (mm)', 'enum', 'options' => C::RAIL_LENGTHS.map { |x| [x.to_f, "#{x} mm"] }),
                f('box_side_t', 'Độ dày hông thùng (mm)', 'mm', 'min' => 8, 'max' => 25),
                f('box_bottom_t', 'Độ dày đáy thùng (mm)', 'mm', 'min' => 3, 'max' => 20),
                f('place_mode', 'Chế độ đặt', 'enum', 'options' => [['single', 'Đặt từng thùng'], ['cluster', 'Tạo cả cụm']]),
                f('cluster_count', 'Số thùng khi tạo cụm (khoang không có mặt ngăn kéo)', 'int', 'min' => 1, 'max' => 8)
              ],
              'defaults' => { 'box_height' => 150.0, 'rail_length' => 450.0, 'box_side_t' => C::DRAWER_BOX_SIDE_T,
                              'box_bottom_t' => C::DRAWER_BOX_BOTTOM_T, 'place_mode' => 'single', 'cluster_count' => 3 }),
          tpl('id' => 'hl.tu_dau_bo.v1', 'name' => 'Tủ đầu bo', 'module_type' => 'tu_bo', 'geometry' => 'carcass',
              'category' => 'Bo cong', 'link_role' => 'side', 'front_rule' => 'open', 'source_candidate' => nil,
              'fields' => BOX_FIELDS + [
                f('end_round', 'Bán kính đầu bo phải (mm, 0 = không)', 'mm', 'min' => 0, 'max' => 1000),
                f('corner_radius', 'Bo góc trước nóc/đáy/đợt (mm)', 'mm', 'min' => 0, 'max' => 1000),
                f('side_radius', 'Bo góc trên-trước hồi (mm)', 'mm', 'min' => 0, 'max' => 1000)
              ],
              'defaults' => BASE_DEFAULTS.merge('w' => 400.0, 'd' => 350.0, 'h' => 1200.0, 'end_round' => C::DEMO_RADIUS,
                                                'corner_radius' => 0.0, 'top_joint' => 'overlay',
                                                'bottom_joint' => 'overlay', 'back_mode' => 'inset'))
        ].freeze

        def self.all
          CATALOG
        end

        def self.supported
          CATALOG.select { |t| t['supported'] }
        end

        def self.find(id)
          CATALOG.find { |t| t['id'] == id }
        end

        def self.type_label(type)
          (MODULE_TYPES.find { |k, _| k == type } || [type, type])[1]
        end
      end
    end
  end
end
