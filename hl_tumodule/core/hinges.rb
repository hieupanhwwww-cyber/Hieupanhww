# encoding: UTF-8
# Lỗ cốc bản lề trên CÁNH (không tạo dấu đế trên hồi/vách).
require_relative 'util'
require_relative 'config'

module HungLoan
  module TuModule
    module Core
      module Hinges
        module_function

        def count_for(h, preset)
          preset['thresholds'].each { |lim, n| return n.to_i if h <= lim }
          preset['thresholds'].last[1].to_i + 1
        end

        # Miền hợp lệ [lo,hi] trừ các khoảng cấm (mở). Trả vị trí hợp lệ gần p nhất hoặc nil.
        def nearest_valid(p, forbidden, lo, hi, taken = [], min_spacing = 0)
          blocked = forbidden + taken.map { |q| [q - min_spacing, q + min_spacing] }
          ok = lambda do |x|
            x >= lo - 1e-9 && x <= hi + 1e-9 && blocked.none? { |a, b| x > a + 1e-9 && x < b - 1e-9 }
          end
          return p if ok.call(p)
          cands = [lo, hi]
          blocked.each { |a, b| cands << a << b }
          cands.select! { |x| ok.call(x) }
          return nil if cands.empty?
          cands.min_by { |x| [(x - p).abs, x] }
        end

        def auto_positions(h, preset, forbidden)
          n = count_for(h, preset)
          e = preset['end_offset'].to_f
          lo = preset['diameter'] / 2.0 + 5.0
          hi = h - lo
          ideal = n == 1 ? [h / 2.0] : (0...n).map { |i| e + (h - 2 * e) * i / (n - 1).to_f }
          place(ideal, preset, forbidden, lo, hi)
        end

        def place(ideal, preset, forbidden, lo, hi)
          out = []
          errs = []
          ideal.each_with_index do |p, i|
            q = nearest_valid(p, forbidden, lo, hi, out.map { |o| o['v'] }, preset['min_spacing'].to_f)
            if q.nil?
              errs << { 'code' => 'HINGE_NO_POSITION', 'index' => i,
                        'message' => format('Bản lề %d: không còn vị trí hợp lệ quanh %.0f mm (vướng đợt hoặc ngoài cánh)', i + 1, p) }
            else
              out << { 'v' => q, 'ideal' => p, 'shifted' => (q - p).abs > 0.01 }
            end
          end
          [out, errs]
        end

        # Ghi bản lề thủ công: neo theo mép gần nhất lúc đặt.
        def manual_entry(v, h)
          anchor = v <= h / 2.0 ? 'bottom' : 'top'
          { 'anchor' => anchor, 'dist' => anchor == 'bottom' ? v : h - v, 'ratio' => v / h, 'h_at_place' => h }
        end

        def manual_positions(entries, h, mode, preset, forbidden)
          return auto_positions(h, preset, forbidden) if mode == 'recompute'
          ideal = entries.map do |en|
            if mode == 'proportional'
              en['ratio'].to_f * h
            else
              en['anchor'] == 'top' ? h - en['dist'].to_f : en['dist'].to_f
            end
          end
          lo = preset['diameter'] / 2.0 + 5.0
          place(ideal, preset, forbidden, lo, h - lo)
        end

        # door: hash cánh do builder sinh ('w','h','local_id', 'zone_x0','zone_x1' ...)
        # data: {'side','mode'=>'auto'|'manual','manual'=>[...],'on_resize'}
        def features_for(door, data, preset, forbidden)
          side = data['side'] || 'left'
          if data['mode'] == 'manual' && (data['manual'] || []).any?
            pos, errs = manual_positions(data['manual'], door['h'], data['on_resize'] || 'keep_edge', preset, forbidden)
          else
            pos, errs = auto_positions(door['h'], preset, forbidden)
          end
          u = side == 'left' ? preset['edge_offset'].to_f : door['w'] - preset['edge_offset'].to_f
          feats = pos.each_with_index.map do |pp, i|
            {
              'id' => "#{door['local_id']}:hinge:#{i}", 'type' => 'drill', 'op' => 'hinge_cup', 'face' => 'B',
              'pos' => [u, pp['v'], 0.0], 'dir' => [0.0, 0.0, 1.0], 'diameter' => preset['diameter'].to_f,
              'depth' => preset['depth'].to_f, 'through' => false, 'shifted' => pp['shifted'], 'ideal_v' => pp['ideal'],
              'source' => { 'kind' => 'hinge', 'door' => door['local_id'], 'index' => i, 'preset' => preset['name'],
                            'demo' => preset['demo'] ? true : false }
            }
          end
          [feats, errs]
        end

        # Đối chiếu dữ liệu bản lề khi danh sách cánh thay đổi (chia/gộp cánh do thêm/xóa vách).
        # policy: 'recompute_all' | 'keep_and_add'
        def reconcile(old_map, doors, policy)
          old_map ||= {}
          new_map = {}
          ids = doors.map { |d| d['local_id'] }
          stale = old_map.reject { |k, _| ids.include?(k) }
          doors.each_with_index do |d, i|
            if old_map[d['local_id']]
              new_map[d['local_id']] = Util.deep_copy(old_map[d['local_id']]).merge('x0' => d['x0'], 'x1' => d['x1'])
              next
            end
            default_side = default_side_for(doors, i)
            entry = { 'side' => default_side, 'mode' => 'auto', 'manual' => [], 'on_resize' => 'keep_edge',
                      'x0' => d['x0'], 'x1' => d['x1'] }
            if policy == 'keep_and_add'
              parent = stale.values.find do |o|
                edge = o['side'] == 'right' ? o['x1'] : o['x0']
                edge && (d[o['side'] == 'right' ? 'x1' : 'x0'] - edge).abs < 5.0 && o['x0'] <= d['x0'] + 5 && o['x1'] >= d['x1'] - 5
              end
              if parent
                entry = Util.deep_copy(parent).merge('x0' => d['x0'], 'x1' => d['x1'], 'inherited' => true)
              end
            end
            new_map[d['local_id']] = entry
          end
          new_map
        end

        def default_side_for(doors, i)
          zone = doors[i]['zone']
          same = doors.select { |d| d['zone'] == zone }
          idx = same.index(doors[i])
          same.size >= 2 && idx == same.size - 1 ? 'right' : 'left'
        end
      end
    end
  end
end
