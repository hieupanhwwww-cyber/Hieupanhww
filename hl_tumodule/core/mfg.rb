# encoding: UTF-8
# Lõi dữ liệu sản xuất: chi tiết tấm + feature gia công + kiểm tra + xuất dữ liệu trung lập (mm).
# Độc lập SketchUp và độc lập định dạng nhà cung cấp. Bộ chuyển đổi ABF ở abf_adapter.rb.
require 'json'
require_relative 'geom'
require_relative 'config'
require_relative 'util'

module HungLoan
  module TuModule
    module Core
      module Mfg
        G = Geom
        FORMAT = 'HLTM-MFG'.freeze
        VERSION = 1
        module_function

        # panels: tấm trong hệ assembly/world (mm) — từ Builder (+ đặt module), kèm 'module_id','material'.
        def parts(panels)
          panels.map do |pn|
            pts = pn['kind'] == 'bent' ? [] : G.tessellate(pn['outline'], Config::ARC_SEG_PER_QUARTER)
            bb = pts.empty? ? [0, 0, 0, 0] : G.bbox2(pts)
            {
              'id' => pn['id'], 'role' => pn['role'], 'label' => pn['label'], 'module_id' => pn['module_id'],
              'assembly_id' => pn['assembly_id'], 'material' => pn['material'], 'grain' => pn['grain'] || 'u',
              'kind' => pn['kind'] || 'flat', 'thickness' => pn['t'], 'frame' => pn['frame'],
              'outline' => pn['outline'], 'outline_mesh' => pts,
              'stock' => { 'w' => bb[2] - bb[0], 'h' => bb[3] - bb[1], 't' => pn['t'] },
              'features' => pn['features'] || [], 'bent' => pn['bent']
            }
          end
        end

        def issue(code, level, msg, part = nil, feat = nil)
          { 'code' => code, 'level' => level, 'message' => msg, 'part' => part, 'feature' => feat }
        end

        # Kiểm tra dữ liệu sản xuất. joints: danh sách liên kết cam (từ Builder, đã chuyển hệ assembly).
        def validate(parts, joints = [])
          out = []
          ids = {}
          parts.each do |pt|
            pid = pt['id']
            out << issue('DUP_PART_ID', 'error', "Trùng ID chi tiết #{pid}", pid) if ids[pid]
            ids[pid] = true
            if pt['kind'] == 'bent'
              out << issue('UNSUPPORTED_BENT', 'error', 'Tấm uốn/không phẳng: chưa có quy tắc trải phẳng — chưa hỗ trợ gia công', pid)
              next
            end
            pts = pt['outline_mesh']
            t = pt['thickness'].to_f
            out << issue('BAD_THICKNESS', 'error', 'Độ dày không hợp lệ', pid) if t <= 0
            if pts.size < 3 || G.polygon_area(pts).abs < 1.0
              out << issue('DEGENERATE_OUTLINE', 'error', 'Đường bao suy biến (diện tích ≈ 0)', pid)
              next
            end
            out << issue('OUTLINE_CW', 'warning', 'Đường bao đi cùng chiều kim đồng hồ', pid) if G.polygon_area(pts) < 0
            out << issue('SELF_INTERSECT', 'error', 'Đường bao tự cắt', pid) if G.self_intersecting?(pts)
            seen = {}
            pt['features'].each do |f|
              fid = f['id']
              key = [f['type'], f['face'], (f['pos'] || []).map { |x| x.round(1) }, f['diameter']].inspect
              out << issue('DUP_FEATURE', 'error', 'Feature trùng vị trí', pid, fid) if f['type'] == 'drill' && seen[key]
              seen[key] = true
              case f['type']
              when 'drill' then out.concat(check_drill(pt, f, pts, t))
              when 'groove', 'pocket' then out.concat(check_pocket(pt, f, pts, t))
              else out << issue('UNSUPPORTED_FEATURE', 'error', "Loại feature #{f['type']} chưa hỗ trợ", pid, fid)
              end
              if f.dig('source', 'demo')
                out << issue('DEMO_PRESET', 'warning', "Thông số từ preset DEMO (#{f.dig('source', 'preset')}) — chưa kiểm chứng xưởng", pid, fid)
              end
            end
          end
          joints.each do |j|
            next if j['deleted']
            [j['a'], j['b']].each do |pid|
              out << issue('ORPHAN_JOINT', 'error', "Liên kết #{j['id']} tham chiếu tấm không tồn tại", pid) unless ids[pid]
            end
            out.concat(check_joint(j, parts))
          end
          dedupe_demo(out)
        end

        def dedupe_demo(list)
          seen = {}
          list.select do |i|
            next true unless i['code'] == 'DEMO_PRESET'
            k = [i['part'], i['message']]
            r = !seen[k]
            seen[k] = true
            r
          end
        end

        def check_drill(pt, f, pts, t)
          out = []
          pid = pt['id']; fid = f['id']
          d = f['diameter'].to_f; dep = f['depth'].to_f
          out << issue('BAD_DIAMETER', 'error', 'Đường kính phải > 0', pid, fid) if d <= 0
          out << issue('BAD_DEPTH', 'error', 'Độ sâu phải > 0', pid, fid) if dep <= 0 && !f['through']
          p = f['pos']; dir = f['dir']
          if f['face'] == 'A' || f['face'] == 'B'
            expected = f['face'] == 'A' ? -1.0 : 1.0
            if (dir[2] - expected).abs > 1e-6
              out << issue('WRONG_FACE_DIR', 'error', 'Hướng khoan không đi vào vật liệu từ mặt đã khai báo', pid, fid)
            end
            if !f['through'] && dep >= t - 1e-6
              out << issue('DEPTH_EXCEEDS_STOCK', 'error', format('Khoan mặt sâu %.1f ≥ độ dày %.1f mm', dep, t), pid, fid)
            end
            if !G.point_in_polygon?([p[0], p[1]], pts) || G.dist_to_boundary([p[0], p[1]], pts) < d / 2.0 - TOL
              out << issue('OUT_OF_AREA', 'error', 'Lỗ khoan mặt nằm ngoài hoặc chạm mép chi tiết', pid, fid)
            end
          elsif f['face'].to_s.start_with?('E:')
            # Khoan cạnh: giới hạn độ sâu theo hướng đi vào vật liệu (không so với độ dày tấm).
            if p[2] < d / 2.0 - TOL || p[2] > t - d / 2.0 + TOL
              out << issue('EDGE_HOLE_OFF_THICKNESS', 'error', 'Lỗ cạnh vượt ra ngoài chiều dày tấm', pid, fid)
            end
            room = ray_room(pts, [p[0], p[1]], [dir[0], dir[1]])
            if dep > room + TOL
              out << issue('DEPTH_EXCEEDS_STOCK', 'error', format('Khoan cạnh sâu %.1f > %.1f mm vật liệu theo hướng khoan', dep, room), pid, fid)
            end
          else
            out << issue('WRONG_FACE', 'error', 'Điểm vào khoan không nằm trên mặt/cạnh chi tiết', pid, fid)
          end
          out
        end

        # Khoảng vật liệu từ điểm theo hướng 2D tới biên (bước nhỏ, đủ cho chi tiết phẳng).
        def ray_room(pts, p, dir)
          l = Math.hypot(dir[0], dir[1])
          return 0.0 if l < 1e-9
          ux = dir[0] / l; uy = dir[1] / l
          s = 0.0
          step = 0.5
          s += step while s < 1.0e5 && G.point_in_polygon?([p[0] + ux * (s + step), p[1] + uy * (s + step)], pts)
          s
        end

        def check_pocket(pt, f, pts, t)
          out = []
          pid = pt['id']; fid = f['id']
          dep = f['depth'].to_f
          out << issue('BAD_DEPTH', 'error', 'Độ sâu rãnh/tiết diện phải > 0', pid, fid) if dep <= 0
          if !f['through'] && dep >= t - 1e-6
            out << issue('DEPTH_EXCEEDS_STOCK', 'error', format('Rãnh sâu %.1f ≥ độ dày %.1f mm', dep, t), pid, fid)
          end
          out << issue('WRONG_FACE', 'error', 'Mặt nhận phải là A hoặc B', pid, fid) unless %w[A B].include?(f['face'])
          if f['rect']
            x0, y0, x1, y1 = G.bbox2(pts)
            r = f['rect']
            if r[0] < x0 - TOL || r[1] < y0 - TOL || r[2] > x1 + TOL || r[3] > y1 + TOL
              out << issue('OUT_OF_AREA', 'error', 'Rãnh/tiết diện vượt ngoài chi tiết', pid, fid)
            end
          end
          out << issue('SECTION_APPROX', 'warning', 'Tiết diện tính gần đúng (tấm đối tác cong/không chữ nhật)', pid, fid) if f['approx']
          out
        end

        def world_point(pt, f)
          G.f2w(pt['frame'], f['pos'])
        end

        def world_dir(pt, f)
          G.dir_f2w(pt['frame'], f['dir'])
        end

        # Kiểm tra một bộ cam/chốt: lỗ cạnh, cốc cam, chốt cùng trục/vị trí theo preset.
        def check_joint(j, parts)
          out = []
          a = parts.find { |p| p['id'] == j['a'] }; b = parts.find { |p| p['id'] == j['b'] }
          return out unless a && b
          fa = a['features'].select { |f| f.dig('source', 'joint') == j['id'] }
          fb = b['features'].select { |f| f.dig('source', 'joint') == j['id'] }
          (j['positions'] || []).each_index do |i|
            edge = fa.find { |f| f.dig('source', 'index') == i && f.dig('source', 'role') == 'edge' }
            cam = fa.find { |f| f.dig('source', 'index') == i && f.dig('source', 'role') == 'cam' }
            bolt = fb.find { |f| f.dig('source', 'index') == i && f.dig('source', 'role') == 'bolt' }
            unless edge && cam && bolt
              out << issue('CAM_INCOMPLETE', 'error', "Bộ cam #{i + 1} thiếu lỗ trên một trong hai tấm", j['a'])
              next
            end
            pe = world_point(a, edge); pb = world_point(b, bolt); pc = world_point(a, cam)
            de = world_dir(a, edge); db = world_dir(b, bolt)
            out << issue('CAM_MISALIGNED', 'error', 'Lỗ chốt và lỗ cạnh không trùng tâm', j['b'], bolt['id']) if G.len(G.sub(pe, pb)) > 0.1
            out << issue('CAM_AXIS', 'error', 'Lỗ chốt và lỗ cạnh không cùng trục', j['b'], bolt['id']) if G.dot(de, db) > -0.999
            along = G.dot(G.sub(pc, pe), de)
            lateral = G.sub(G.sub(pc, pe), G.mul(de, along))
            if along < cam['diameter'] / 2.0 || along > edge['depth'] + cam['diameter'] / 2.0
              out << issue('CAM_EDGE_NOT_REACH', 'error', 'Lỗ cạnh không chạm cốc cam', j['a'], cam['id'])
            end
            if (G.len(lateral) - a['thickness'] / 2.0).abs > 0.1
              out << issue('CAM_LATERAL', 'error', 'Cốc cam lệch khỏi trục lỗ cạnh', j['a'], cam['id'])
            end
          end
          out
        end

        def summary(parts, issues)
          ops = parts.sum { |p| p['features'].size }
          {
            'parts' => parts.size, 'operations' => ops,
            'errors' => issues.count { |i| i['level'] == 'error' }, 'warnings' => issues.count { |i| i['level'] == 'warning' },
            'by_op' => parts.flat_map { |p| p['features'] }.group_by { |f| f['op'] }.map { |k, v| [k, v.size] }.to_h
          }
        end

        # Trạng thái tách bạch: hình học hợp lệ / thiếu thông số xưởng / chưa hỗ trợ / tương thích đích.
        def status(issues)
          err = issues.select { |i| i['level'] == 'error' }
          {
            'geometry_valid' => err.none? { |i| i['code'] != 'UNSUPPORTED_BENT' },
            'has_unsupported' => err.any? { |i| i['code'].start_with?('UNSUPPORTED') },
            'shop_params_unverified' => issues.any? { |i| i['code'] == 'DEMO_PRESET' },
            'target_compat_verified' => false
          }
        end

        def to_json(parts, issues, meta = {})
          doc = {
            'format' => FORMAT, 'version' => VERSION, 'units' => 'mm', 'meta' => meta,
            'status' => status(issues), 'summary' => summary(parts, issues),
            'parts' => parts.map { |p| p.reject { |k, _| k == 'outline_mesh' }.merge('outline_points' => p['outline_mesh'].map { |q| q.map { |x| Util.r3(x) } }) },
            'issues' => issues
          }
          JSON.pretty_generate(doc)
        end

        def csv_line(arr)
          arr.map { |x| s = x.to_s; s =~ /[",;\n]/ ? "\"#{s.gsub('"', '""')}\"" : s }.join(',')
        end

        def to_csv_parts(parts)
          lines = [csv_line(%w[id ten vai_tro module vat_lieu dai_mm rong_mm day_mm so_thao_tac])]
          parts.each do |p|
            lines << csv_line([p['id'], p['label'], p['role'], p['module_id'], p['material'], Util.r3(p['stock']['w']),
                               Util.r3(p['stock']['h']), p['thickness'], p['features'].size])
          end
          lines.join("\n") + "\n"
        end

        def to_csv_ops(parts)
          lines = [csv_line(%w[part_id feature_id loai thao_tac mat u v w huong_u huong_v huong_w duong_kinh sau xuyen nguon])]
          parts.each do |p|
            p['features'].each do |f|
              pos = f['pos'] || (f['rect'] ? [f['rect'][0], f['rect'][1], 0] : [nil, nil, nil])
              dir = f['dir'] || [nil, nil, nil]
              lines << csv_line([p['id'], f['id'], f['type'], f['op'], f['face']] + pos.map { |x| x && Util.r3(x) } +
                                dir.map { |x| x && Util.r3(x) } + [f['diameter'], Util.r3(f['depth'].to_f), f['through'] ? 1 : 0,
                                                                   f.dig('source', 'kind')])
            end
          end
          lines.join("\n") + "\n"
        end
      end
    end
  end
end
