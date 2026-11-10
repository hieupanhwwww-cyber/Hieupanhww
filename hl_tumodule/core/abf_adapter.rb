# encoding: UTF-8
# Bộ chuyển đổi bàn giao ABF/Nesting — TRẠNG THÁI: CHƯA KIỂM CHỨNG TƯƠNG THÍCH.
#
# Môi trường xây dựng không truy cập được tài liệu ABF (getabf.net bị chặn mạng) và không có
# ABF/Nesting để nạp thử. Vì vậy lớp này KHÔNG tự đặt tên dictionary/tag/layer "giống ABF".
# Thay vào đó nó sinh "kế hoạch bản gia công": mỗi chi tiết thành một khối đặc phẳng một cấp
# (Solid Group) trong hệ tọa độ thế giới, lỗ/rãnh/tiết diện được KHOÉT THẬT vào hình học, kèm
# metadata trung lập truy về ID tấm/feature nguồn. Đây là dạng đầu vào phổ biến của các plugin
# nesting chạy trong SketchUp, nhưng việc ABF đọc đúng phải được kiểm chứng trên máy có ABF
# (xem docs/ABF_HANDOFF.md). Bảng ánh xạ để trống các khóa đích chưa xác minh.
require_relative 'geom'
require_relative 'mfg'

module HungLoan
  module TuModule
    module Core
      module AbfAdapter
        G = Geom
        STATUS = 'chua_kiem_chung'.freeze
        TARGET = { 'software' => 'ABF / ABF Nesting', 'version' => 'CHƯA XÁC ĐỊNH', 'verified' => false }.freeze

        # Bảng ánh xạ schema nội bộ → dữ liệu đích. 'target' = nil nghĩa là chưa có nguồn kiểm chứng.
        MAPPING = [
          { 'internal' => 'part (tấm phẳng)', 'snapshot' => 'Group đặc một cấp, đường bao thật, dày = thickness', 'target' => nil },
          { 'internal' => 'part.frame / mặt A,B', 'snapshot' => 'Trục local của Group: z = pháp tuyến, mặt A ở z = t', 'target' => nil },
          { 'internal' => 'drill (mặt) — cam_housing, cam_bolt, hinge_cup', 'snapshot' => 'Lỗ tròn khoét sâu đúng depth từ mặt vào', 'target' => nil },
          { 'internal' => 'drill (cạnh) — cam_edge_hole', 'snapshot' => 'Lỗ tròn khoét từ mặt cạnh theo hướng khoan', 'target' => nil },
          { 'internal' => 'groove — back_groove', 'snapshot' => 'Rãnh chữ nhật khoét sâu đúng depth', 'target' => nil },
          { 'internal' => 'pocket — section', 'snapshot' => 'Vùng tiết diện khoét theo đường bao, sâu đúng depth', 'target' => nil },
          { 'internal' => 'material / grain', 'snapshot' => 'Material SketchUp của tấm (Paint Bucket) + thuộc tính', 'target' => nil }
        ].freeze

        module_function

        # Trả kế hoạch dựng bản gia công: list chi tiết có đủ dữ liệu để lớp SketchUp vẽ/khoét.
        # Chi tiết không hỗ trợ (tấm uốn) hoặc có lỗi được liệt kê, KHÔNG âm thầm bỏ qua.
        def plan(parts, issues)
          bad = issues.select { |i| i['level'] == 'error' }.group_by { |i| i['part'] }
          items = []
          skipped = []
          parts.each do |pt|
            if pt['kind'] == 'bent'
              skipped << { 'part' => pt['id'], 'reason' => 'Tấm uốn chưa hỗ trợ gia công' }
              next
            end
            ops = pt['features'].map do |f|
              { 'id' => f['id'], 'source' => f['source'], 'feature' => f['id'], 'type' => f['type'], 'op' => f['op'], 'face' => f['face'], 'pos' => f['pos'],
                'dir' => f['dir'], 'diameter' => f['diameter'], 'depth' => f['depth'], 'through' => f['through'],
                'rect' => f['rect'], 'outline' => f['outline'], 'abf_tag' => f['abf_tag'] }
            end
            items << { 'part' => pt['id'], 'label' => pt['label'], 'role' => pt['role'], 'frame' => pt['frame'],
                       'thickness' => pt['thickness'], 'outline' => pt['outline_mesh'], 'material' => pt['material'],
                       'ops' => ops, 'errors' => (bad[pt['id']] || []).map { |i| i['code'] } }
          end
          { 'status' => STATUS, 'target' => TARGET, 'mapping' => MAPPING, 'items' => items, 'skipped' => skipped,
            'summary' => Mfg.summary(parts, issues) }
        end
      end
    end
  end
end
