# encoding: UTF-8
# QUY ƯỚC TAG ABF — rút từ chính bộ mẫu DC_17MM của xưởng (docs/khao_sat/ABF_TAGS.md):
#   ABF_D35          : lỗ Ø35 (cốc bản lề) → suy rộng ABF_D{đường kính} cho lỗ khoan tròn
#   ABF_RANH_HAU     : rãnh hậu (file 05B - Thùng ngăn kéo có ray)
#   ABF_POCKET_Z6_*/Z9_* : vùng khoét, Z{n} = độ sâu mm → suy rộng ABF_POCKET_Z{sâu}
#   ABF_CatTrong     : cắt lọt bên trong (xuyên hết độ dày)
#   ABF_Label        : nhãn chi tiết
# Đây là quy ước QUAN SÁT TỪ TÊN TAG trong file mẫu, CHƯA kiểm chứng bằng cách nạp vào ABF.
# Mọi chỗ gắn tag (dấu trong model, bản gia công, file xuất) đều đi qua module này.
module HungLoan
  module TuModule
    module Core
      module AbfRules
        # Màu tag: RANH_HAU và HemKinh lấy đúng material trong file mẫu; còn lại chọn để dễ phân biệt.
        COLORS = {
          'ABF_RANH_HAU' => [119, 0, 119],
          'ABF_CatTrong' => [204, 51, 51],
          'ABF_Label' => [60, 60, 60],
          'default_drill' => [0, 102, 204],
          'default_pocket' => [0, 153, 135]
        }.freeze

        # BẢNG TÊN GIA CÔNG (sửa trong "Cài đặt chung"): mỗi loại thao tác có tên LAYER (tag) và tên INSTANCE (nhóm).
        # Dùng được {D} = đường kính lỗ, {Z} = độ sâu (mm) trong tên.
        OP_KEYS = %w[cam_housing cam_edge_hole cam_bolt hinge_cup back_groove section section_through].freeze
        OP_TITLES = {
          'cam_housing' => 'Cốc cam Minifix', 'cam_edge_hole' => 'Lỗ cạnh (chốt cam)', 'cam_bolt' => 'Lỗ chốt cam trên mặt',
          'hinge_cup' => 'Lỗ cốc bản lề', 'back_groove' => 'Rãnh hậu', 'section' => 'Tiết diện (khoét sâu)',
          'section_through' => 'Tiết diện (cắt xuyên)'
        }.freeze
        DEFAULT_OPS = {
          'cam_housing' => { 'layer' => 'ABF_D{D}', 'instance' => 'ABF_Cam' },
          'cam_edge_hole' => { 'layer' => 'ABF_D{D}', 'instance' => 'ABF_ChotCam_Canh' },
          'cam_bolt' => { 'layer' => 'ABF_D{D}', 'instance' => 'ABF_ChotCam' },
          'hinge_cup' => { 'layer' => 'ABF_D{D}', 'instance' => 'ABF_BanLe' },
          'back_groove' => { 'layer' => 'ABF_RANH_HAU', 'instance' => 'ABF_RANH_HAU' },
          'section' => { 'layer' => 'ABF_POCKET_Z{Z}', 'instance' => 'ABF_TietDien' },
          'section_through' => { 'layer' => 'ABF_CatTrong', 'instance' => 'ABF_CatTrong' }
        }.freeze

        @ops = nil

        module_function

        def ops
          @ops || DEFAULT_OPS
        end

        def ops=(cfg)
          @ops = cfg
        end

        def fmt_num(x)
          x = x.to_f
          (x % 1).abs < 1e-6 ? x.round.to_s : x.round(1).to_s
        end

        # Kiểm tra bảng tên người dùng nhập. Trả [bảng sạch, {"op.field" => lỗi}].
        def clean_ops(raw)
          out = {}
          errs = {}
          OP_KEYS.each do |k|
            src = (raw || {})[k] || {}
            out[k] = {}
            %w[layer instance].each do |fld|
              v = src[fld].to_s.strip
              v = DEFAULT_OPS[k][fld] if v.empty? && !src.key?(fld)
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
        def tag_for(f)
          expand((ops[op_key(f)] || DEFAULT_OPS[op_key(f)])['layer'], f)
        end

        # Tên instance (nhóm dấu) cho một feature gia công.
        def instance_for(f)
          expand((ops[op_key(f)] || DEFAULT_OPS[op_key(f)])['instance'], f)
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
