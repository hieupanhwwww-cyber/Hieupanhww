# encoding: UTF-8
# Nhận diện quan hệ tấm + liên kết ngang Cam Minifix + chốt cam.
# Mọi tấm truyền vào phải cùng một hệ tọa độ (module hoặc assembly), mm.
require_relative 'geom'
require_relative 'config'
require_relative 'util'

module HungLoan
  module TuModule
    module Core
      module Joints
        G = Geom
        module_function

        def boxes(panels)
          panels.map { |p| [p, G.panel_aabb(p)] }
        end

        # Lọc sơ bộ bằng quét theo trục x (sort & sweep) rồi mới xét chi tiết.
        def candidate_pairs(panels, tol = TOL)
          bx = boxes(panels).sort_by { |_, b| b[0][0] }
          out = []
          bx.each_with_index do |(pa, ba), i|
            j = i + 1
            while j < bx.size && bx[j][1][0][0] <= ba[1][0] + tol
              pb, bb = bx[j]
              if (1..2).all? { |k| bb[0][k] <= ba[1][k] + tol && ba[0][k] <= bb[1][k] + tol }
                out << [pa, ba, pb, bb]
              end
              j += 1
            end
          end
          out
        end

        def overlaps(ba, bb)
          (0..2).map { |k| [ba[1][k], bb[1][k]].min - [ba[0][k], bb[0][k]].max }
        end

        # Phân loại: 'edge_face' (cạnh A tựa mặt B, vuông góc), 'face_face', 'penetration', 'none'.
        def classify(pa, ba, pb, bb, tol = TOL)
          ov = overlaps(ba, bb)
          return { 'kind' => 'none' } if ov.any? { |o| o < -tol }
          zero = (0..2).select { |k| ov[k].abs <= tol }
          pos = (0..2).select { |k| ov[k] > tol }
          if pos.size == 3
            return { 'kind' => 'penetration', 'ov' => ov }
          end
          return { 'kind' => 'none' } unless zero.size == 1 && pos.size == 2
          k = zero[0]
          na = G.axis_of(pa['frame']['n']); nb = G.axis_of(pb['frame']['n'])
          return { 'kind' => 'unsupported', 'reason' => 'Tấm xiên so với hệ trục' } if na.nil? || nb.nil?
          if na == k && nb == k
            return { 'kind' => 'face_face', 'axis' => k, 'ov' => ov }
          end
          if nb == k && na != k
            edge, eb, face, fb = pa, ba, pb, bb
          elsif na == k && nb != k
            edge, eb, face, fb = pb, bb, pa, ba
          else
            return { 'kind' => 'edge_edge', 'axis' => k, 'ov' => ov }
          end
          j = G.axis_of(edge['frame']['n'])
          line = ([0, 1, 2] - [k, j])[0]
          full = ov[j] >= edge['t'] - tol
          s = (eb[1][k] - fb[0][k]).abs <= tol ? 1 : -1 # hướng từ tấm cạnh sang tấm mặt
          {
            'kind' => 'edge_face', 'edge' => edge, 'face' => face, 'axis' => k, 'thick_axis' => j, 'line_axis' => line,
            'sign' => s, 'plane' => s > 0 ? eb[1][k] : eb[0][k], 'full' => full,
            'line' => [[eb[0][line], fb[0][line]].max, [eb[1][line], fb[1][line]].min],
            'thick' => [eb[0][j], eb[1][j]], 'ov' => ov, 'edge_box' => eb
          }
        end

        def count_for(len, preset)
          preset['count_rules'].each { |lim, n| return n.to_i if len <= lim }
          preset['count_rules'].last[1].to_i
        end

        def face_id(panel, local)
          w = local[2]
          return 'A' if (w - panel['t']).abs < 0.01
          return 'B' if w.abs < 0.01
          pts = G.tessellate(panel['outline'], 4)
          x0, y0, x1, y1 = G.bbox2(pts)
          return 'E:u0' if (local[0] - x0).abs < 0.01
          return 'E:u1' if (local[0] - x1).abs < 0.01
          return 'E:v0' if (local[1] - y0).abs < 0.01
          return 'E:v1' if (local[1] - y1).abs < 0.01
          'INSIDE'
        end

        def feature(panel, id, op, world_pt, world_dir, dia, depth, src)
          lp = G.w2f(panel['frame'], world_pt).map { |x| Util.r3(x) }
          ld = G.snap(G.dir_w2f(panel['frame'], world_dir))
          {
            'id' => id, 'type' => 'drill', 'op' => op, 'face' => face_id(panel, lp), 'pos' => lp, 'dir' => ld,
            'diameter' => dia.to_f, 'depth' => depth.to_f, 'through' => false, 'source' => src
          }
        end

        # Sinh toàn bộ liên kết cam cho tập tấm. overrides: {key=>{'flip','deleted','positions'=>[{'anchor','dist'}]}}
        # interior_center: điểm giữa lòng tủ để chọn mặt đặt cam mặc định (mặt hướng vào trong).
        def generate(panels, preset, overrides = {}, interior_center = nil, roles = Config::CAM_ROLES)
          joints = []
          issues = []
          eligible = panels.select { |p| roles.include?(p['role']) && p['kind'] != 'bent' }
          candidate_pairs(eligible).each do |pa, ba, pb, bb|
            rel = classify(pa, ba, pb, bb)
            next unless rel['kind'] == 'edge_face'
            a = rel['edge']; b = rel['face']
            key = "#{a['id']}>#{b['id']}"
            ov = overrides[key] || {}
            l0, l1 = rel['line']
            len = l1 - l0
            j = { 'id' => key, 'a' => a['id'], 'b' => b['id'], 'axis' => rel['axis'], 'sign' => rel['sign'],
                  'line' => [l0, l1], 'length' => len, 'deleted' => ov['deleted'] ? true : false,
                  'preset' => preset['name'], 'demo' => preset['demo'] ? true : false, 'features' => {}, 'issues' => [] }
            unless rel['full']
              j['issues'] << { 'code' => 'CAM_PARTIAL_EDGE', 'message' => 'Cạnh tấm chỉ tựa một phần lên mặt tấm kia' }
            end
            if a['t'] < preset['min_thickness'] || b['t'] < preset['min_thickness']
              j['issues'] << { 'code' => 'CAM_THIN', 'message' => "Tấm mỏng hơn #{preset['min_thickness']} mm, không dùng preset này" }
            end
            k = rel['axis']; th = rel['thick_axis']; ln = rel['line_axis']; s = rel['sign']
            mid = (rel['thick'][0] + rel['thick'][1]) / 2.0
            sj = if interior_center
                   interior_center[th] >= mid ? 1 : -1
                 else
                   -1
                 end
            sj = -sj if ov['flip']
            j['cam_face_sign'] = sj
            e = preset['end_setback'].to_f
            positions = if ov['positions'].is_a?(Array) && ov['positions'].any?
                          ov['positions'].map { |pp| pp['anchor'] == 'end' ? l1 - pp['dist'].to_f : l0 + pp['dist'].to_f }
                        else
                          n = count_for(len, preset)
                          if n <= 1 || len < 2 * e
                            [(l0 + l1) / 2.0]
                          else
                            (0...n).map { |i| l0 + e + (len - 2 * e) * i / (n - 1).to_f }
                          end
                        end
            j['manual'] = ov['positions'].is_a?(Array) && ov['positions'].any?
            j['positions'] = positions
            extent_k = rel['edge_box'][1][k] - rel['edge_box'][0][k]
            if preset['edge_depth'] > extent_k + TOL || preset['cam_offset'] + preset['cam_diameter'] / 2.0 > extent_k
              j['issues'] << { 'code' => 'CAM_EDGE_TOO_DEEP', 'message' => 'Tấm mang cam quá ngắn theo hướng khoan cạnh' }
            end
            if preset['cam_depth'] >= a['t'] || preset['bolt_depth'] >= b['t']
              j['issues'] << { 'code' => 'CAM_DEPTH_EXCEEDS', 'message' => 'Độ sâu cốc cam/chốt vượt độ dày tấm' }
            end
            fa = []; fb = []
            unless j['deleted']
              positions.each_with_index do |q, i|
                if q < l0 + preset['cam_diameter'] / 2.0 - TOL || q > l1 - preset['cam_diameter'] / 2.0 + TOL
                  j['issues'] << { 'code' => 'CAM_OUT_OF_RANGE', 'message' => format('Vị trí %d (%.1f mm) nằm ngoài cạnh tiếp xúc', i + 1, q - l0) }
                end
                pc = [0, 0, 0]; pc[k] = rel['plane']; pc[th] = mid; pc[ln] = q
                into_a = [0, 0, 0]; into_a[k] = -s.to_f
                into_b = [0, 0, 0]; into_b[k] = s.to_f
                cam = pc.dup; cam[k] = rel['plane'] - s * preset['cam_offset']; cam[th] = sj > 0 ? rel['thick'][1] : rel['thick'][0]
                cam_dir = [0, 0, 0]; cam_dir[th] = -sj.to_f
                src = { 'kind' => 'cam', 'joint' => key, 'index' => i, 'preset' => preset['name'], 'demo' => j['demo'] }
                fa << feature(a, "#{key}:#{i}:edge", 'cam_edge_hole', pc, into_a, preset['edge_diameter'], preset['edge_depth'], src.merge('role' => 'edge'))
                fa << feature(a, "#{key}:#{i}:cam", 'cam_housing', cam, cam_dir, preset['cam_diameter'], preset['cam_depth'], src.merge('role' => 'cam'))
                fb << feature(b, "#{key}:#{i}:bolt", 'cam_bolt', pc, into_b, preset['bolt_diameter'], preset['bolt_depth'], src.merge('role' => 'bolt'))
              end
            end
            j['features'][a['id']] = fa
            j['features'][b['id']] = fb
            j['issues'].each { |iss| issues << iss.merge('joint' => key, 'part' => a['id']) }
            joints << j
          end
          [joints, issues]
        end
      end
    end
  end
end
