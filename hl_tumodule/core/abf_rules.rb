# encoding: UTF-8
# QUY ƯỚC TAG ABF — rút từ chính bộ mẫu DC_17MM của xưởng (docs/khao_sat/ABF_TAGS.md):
#   ABF_D35          : lỗ Ø35 (cốc bản lề) → suy rộng ABF_D{đường kính} cho lỗ khoan tròn
#   ABF_RANH_HAU     : rãnh hậu (file 05B - Thùng ngăn kéo có ray)
#   ABF_POCKET_Z6_*/Z9_* : vùng khoét, Z{n} = độ sâu mm → suy rộng ABF_POCKET_Z{sâu}
#   ABF_CatTrong     : cắt lọt bên trong (xuyên hết độ dày)
#   ABF_Label        : nhãn chi tiết
# Đây là quy ước QUAN SÁT TỪ TÊN TAG trong file mẫu, CHƯA kiểm chứng bằng cách nạp vào ABF.
# Mọi chỗ gắn tag (dấu trong model, bản gia công, file xuất) đều đi qua module này.
require_relative 'util'

module HungLoan
  module TuModule
    module Core
      module AbfRules
        # Màu tag: RANH_HAU và HemKinh lấy đúng material trong file mẫu; còn lại chọn để dễ phân biệt.
        COLORS = {
          'ABF_RANH_HAU' => [119, 0, 119], 'ABF_SOI HAU' => [119, 0, 119],
          'ABF_CatTrong' => [204, 51, 51],
          'ABF_Label' => [60, 60, 60],
          'default_drill' => [0, 102, 204],
          'default_pocket' => [0, 153, 135]
        }.freeze

        # BẢNG TÊN GIA CÔNG (sửa trong "Cài đặt chung"): mỗi loại thao tác có tên LAYER (tag) và tên INSTANCE (nhóm).
        # Dùng được {D} = đường kính lỗ, {Z} = độ sâu (mm) trong tên.
        OP_KEYS = %w[cam_housing cam_edge_hole cam_side_depth cam_bolt hinge_cup back_groove section section_through].freeze
        OP_TITLES = {
          'cam_housing' => 'Cốc cam Ø15 (tấm mang cam)', 'cam_edge_hole' => 'Lỗ cạnh (khoan ngang)', 'cam_side_depth' => 'Dấu độ sâu lỗ cạnh',
          'cam_bolt' => 'Lỗ Ø5 trên mặt tấm đối diện', 'hinge_cup' => 'Lỗ cốc bản lề', 'back_groove' => 'Rãnh hậu (soi âm)',
          'section' => 'Tiết diện (khoét sâu)', 'section_through' => 'Tiết diện (cắt xuyên)'
        }.freeze
        # MẶC ĐỊNH = đúng tên nhóm/layer do công cụ ABF tạo, đọc từ dự án ABF thật của xưởng (CHAU_NAM_CNC/Untitled.skp).
        DEFAULT_OPS = {
          'cam_housing' => { 'layer' => 'ABF-D{D}', 'instance' => '_ABF_minifixBolts' },
          'cam_edge_hole' => { 'layer' => 'ABF-DSIDE-{D}', 'instance' => '_ABF_sideDrill' },
          'cam_side_depth' => { 'layer' => 'ABF-DSIDE-{D}', 'instance' => '_ABF_sideDrillDepth' },
          'cam_bolt' => { 'layer' => 'ABF-D{D}', 'instance' => '_ABF_minifixPlasticBase' },
          'hinge_cup' => { 'layer' => 'ABF_D{D}', 'instance' => 'ABF_D{D}' },
          'back_groove' => { 'layer' => 'ABF_SOI HAU', 'instance' => '_ABF_Intersect' },
          'section' => { 'layer' => 'ABF_SOI HAU', 'instance' => '_ABF_Intersect' },
          'section_through' => { 'layer' => 'ABF_CatTrong', 'instance' => 'ABF_CatTrong' }
        }.freeze
        # Tên mặc định của các bản 1.1–1.3 (để tự chuyển cấu hình đã lưu sang tên ABF thật).
        SWAPPED_140 = {
          'cam_housing' => { 'layer' => 'ABF-D{D}', 'instance' => '_ABF_minifixPlasticBase' },
          'cam_bolt' => { 'layer' => 'ABF-D{D}', 'instance' => '_ABF_minifixBolts' }
        }.freeze
        LEGACY_OPS = {
          'cam_housing' => { 'layer' => 'ABF_D{D}', 'instance' => 'ABF_Cam' },
          'cam_edge_hole' => { 'layer' => 'ABF_D{D}', 'instance' => 'ABF_ChotCam_Canh' },
          'cam_bolt' => { 'layer' => 'ABF_D{D}', 'instance' => 'ABF_ChotCam' },
          'hinge_cup' => { 'layer' => 'ABF_D{D}', 'instance' => 'ABF_BanLe' },
          'back_groove' => { 'layer' => 'ABF_RANH_HAU', 'instance' => 'ABF_RANH_HAU' },
          'section' => { 'layer' => 'ABF_POCKET_Z{Z}', 'instance' => 'ABF_TietDien' }
        }.freeze

        # TÊN SETTING ABF: ABF lấy độ sâu/dao theo "setting-name" gắn trên từng đối tượng → phải trùng tên setting trong ABF của xưởng.
        DEFAULT_SETTINGS = {
          'cam' => 'CAM_17MM', 'hinge' => 'BẢN LỀ A - Loại A', 'groove' => 'SOI ÂM 9MM - RÃNH HẬU', 'intersect_x' => 2.0
        }.freeze
        SETTING_TITLES = { 'cam' => 'Setting cam Minifix', 'hinge' => 'Setting bản lề', 'groove' => 'Setting rãnh hậu (Intersect)',
                           'intersect_x' => 'Nới rộng rãnh hậu — intersect-x (mm)' }.freeze
        DICT = 'ABF'.freeze

        @settings = nil
        @ops = nil

        module_function

        def ops
          @ops || DEFAULT_OPS
        end

        def ops=(cfg)
          @ops = cfg
        end

        def settings
          @settings || DEFAULT_SETTINGS
        end

        def settings=(cfg)
          @settings = cfg
        end

        def clean_settings(raw)
          out = {}
          errs = {}
          %w[cam hinge groove].each do |k|
            v = (raw || {}).key?(k) ? raw[k].to_s.strip : DEFAULT_SETTINGS[k]
            errs["set.#{k}"] = 'Không được để trống' if v.empty?
            out[k] = v
          end
          x = (raw || {}).key?('intersect_x') ? Util.num(raw['intersect_x']) : DEFAULT_SETTINGS['intersect_x']
          errs['set.intersect_x'] = 'Cần số từ 0 đến 10' if x.nil? || x < 0 || x > 10
          out['intersect_x'] = x.to_f
          [out, errs]
        end

        # Chuyển cấu hình lưu từ bản cũ: ô nào còn nguyên tên mặc định cũ thì đổi sang tên ABF thật.
        def migrate_ops(raw)
          out = {}
          OP_KEYS.each do |k|
            src = (raw || {})[k]
            out[k] = if src.nil? || (LEGACY_OPS[k] && src == LEGACY_OPS[k]) || (SWAPPED_140[k] && src == SWAPPED_140[k]) then DEFAULT_OPS[k].dup
                     else src
                     end
          end
          out
        end

        def fmt_num(x)
          x = x.to_f
          (x % 1).abs < 1e-6 ? x.round.to_s : x.round(1).to_s
        end

        # Thuộc tính dictionary "ABF" cho nhóm dấu của một feature (theo đối tượng do công cụ ABF tạo).
        # Quy ước ABF (kiểm trên 150/150 tấm có lỗ cạnh của dự án thật):
        #   "tấm A" của ABF = tấm NHẬN lỗ Ø5 trên mặt (_ABF_minifixPlasticBase, is-minifix-part-a, trỏ b-id)
        #   "tấm B" của ABF = tấm MANG cốc cam Ø15 + lỗ cạnh (_ABF_minifixBolts, is-minifix-part-b, trỏ a-id)
        # ids: {'face' => id tấm nhận Ø5, 'edge' => id tấm mang cam, 'face_group' => id nhóm cốc cam Ø15, 'other' => id tấm đối tác rãnh}
        def attrs_for(f, key, ids = {})
          st = settings
          case key
          when 'cam_housing'
            { 'is-minifix-part-b' => true, 'minifix-group-a-id' => ids['face'], 'setting-name' => st['cam'] }
          when 'cam_bolt'
            { 'is-minifix-part-a' => true, 'minifix-group-b-id' => ids['edge'], 'setting-name' => st['cam'] }
          when 'cam_edge_hole'
            { 'face-drill-group-id' => ids['face_group'], 'is-side-drill' => true, 'minifix-group-a-id' => ids['face'], 'setting-name' => st['cam'] }
          when 'cam_side_depth'
            { 'is-side-drill-depth' => true, 'minifix-group-a-id' => ids['face'], 'setting-name' => st['cam'] }
          when 'hinge_cup'
            { 'is-hinge-part-b' => true, 'is-user-nesting-obj' => true, 'setting-name' => st['hinge'] }
          when 'back_groove', 'section'
            { 'intersect-group-b-id' => ids['other'], 'intersect-offset' => 0.0, 'intersect-x' => st['intersect_x'].to_f,
              'is-intersect' => true, 'setting-name' => st['groove'] }
          else {}
          end.reject { |_, v| v.nil? }
        end

        # Kiểm tra bảng tên người dùng nhập. Trả [bảng sạch, {"op.field" => lỗi}].
        def clean_ops(raw)
          out = {}
          errs = {}
          OP_KEYS.each do |k|
            src = (raw || {})[k] || {}
            out[k] = {}
            %w[layer instance].each do |fld|
              v = src[fld].to_s
              v = v.strip unless v == ''
              v = DEFAULT_OPS[k][fld] if v.empty? && !src.key?(fld)
              v = v.strip
              if v.empty? then errs["#{k}.#{fld}"] = 'Không được để trống'
              elsif v.length > 60 then errs["#{k}.#{fld}"] = 'Tối đa 60 ký tự'
              elsif v =~ /[<>"\\\/|?*\x00-\x1f]/ then errs["#{k}.#{fld}"] = 'Có ký tự không dùng được'
              elsif v.gsub(/\{[DZ]\}/, '') =~ /[{}]/ then errs["#{k}.#{fld}"] = 'Chỉ dùng được {D} và {Z}'
              end
              out[k][fld] = v
            end
          end
          [out, errs]
        end

        def op_key(f)
          return 'section_through' if f['op'] == 'section' && f['through']
          return f['op'] if OP_KEYS.include?(f['op'])
          f['type'] == 'drill' ? 'cam_bolt' : 'section'
        end

        def expand(tpl, f)
          tpl.gsub('{D}', fmt_num(f['diameter'])).gsub('{Z}', fmt_num(f['depth']))
        end

        # Tên layer (tag) cho một feature gia công.
        def tag_for(f, key = nil)
          key ||= op_key(f)
          expand((ops[key] || DEFAULT_OPS[key])['layer'], f)
        end

        # Tên instance (nhóm dấu) cho một feature gia công.
        def instance_for(f, key = nil)
          key ||= op_key(f)
          expand((ops[key] || DEFAULT_OPS[key])['instance'], f)
        end

        # Chữ nhật dấu độ sâu lỗ cạnh (dài = độ sâu, rộng = đường kính) nằm ở mặt phẳng giữa độ dày tấm.
        def side_depth_rect(f)
          p = f['pos']; d = f['dir']
          l = Math.hypot(d[0], d[1])
          return nil if l < 1e-9
          ux = d[0] / l; uy = d[1] / l
          px = -uy * f['diameter'] / 2.0; py = ux * f['diameter'] / 2.0
          dep = f['depth'].to_f
          [[p[0] + px, p[1] + py, p[2]], [p[0] + ux * dep + px, p[1] + uy * dep + py, p[2]],
           [p[0] + ux * dep - px, p[1] + uy * dep - py, p[2]], [p[0] - px, p[1] - py, p[2]]]
        end

        def color_for(tag, f)
          COLORS[tag] || (f['type'] == 'drill' ? COLORS['default_drill'] : COLORS['default_pocket'])
        end

        # Nhãn tiếng Việt ngắn cho bảng Thuộc tính.
        OP_LABELS = {
          'cam_housing' => 'Cốc cam Minifix', 'cam_edge_hole' => 'Lỗ cạnh (chốt cam)', 'cam_bolt' => 'Lỗ chốt cam',
          'hinge_cup' => 'Lỗ cốc bản lề', 'back_groove' => 'Rãnh hậu', 'section' => 'Tiết diện giao nhau'
        }.freeze

        def op_label(f)
          OP_LABELS[f['op']] || f['op'].to_s
        end

        FACE_LABELS = {
          'A' => 'mặt A (trên/ngoài)', 'B' => 'mặt B (dưới/trong)',
          'E:u0' => 'cạnh trái', 'E:u1' => 'cạnh phải', 'E:v0' => 'cạnh dưới', 'E:v1' => 'cạnh trên'
        }.freeze

        def face_label(face)
          FACE_LABELS[face] || face.to_s
        end

        # Một dòng mô tả đầy đủ cho bảng gia công.
        def describe(f)
          s = +"#{op_label(f)} · #{face_label(f['face'])}"
          if f['type'] == 'drill'
            s << format(' · Ø%s sâu %s mm', fmt_num(f['diameter']), fmt_num(f['depth']))
            s << format(' · tại (%s, %s)', fmt_num(f['pos'][0]), fmt_num(f['pos'][1])) if f['pos']
          elsif f['rect']
            s << format(' · %s × %s mm', fmt_num(f['rect'][2] - f['rect'][0]), fmt_num(f['rect'][3] - f['rect'][1]))
            s << (f['through'] ? ' · cắt xuyên' : format(' · sâu %s mm', fmt_num(f['depth'])))
          elsif f['depth']
            s << (f['through'] ? ' · cắt xuyên' : format(' · sâu %s mm', fmt_num(f['depth'])))
          end
          s << " · [#{tag_for(f)}]"
          s
        end
      end
    end
  end
end
