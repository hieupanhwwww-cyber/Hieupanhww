# encoding: UTF-8
# Hình học thuần (mm): vector, khung tọa độ tấm, đường bao có cung, cắt đa giác.
module HungLoan
  module TuModule
    module Core
      module Geom
        module_function

        def add(a, b) [a[0] + b[0], a[1] + b[1], a[2] + b[2]] end
        def sub(a, b) [a[0] - b[0], a[1] - b[1], a[2] - b[2]] end
        def mul(a, s) [a[0] * s, a[1] * s, a[2] * s] end
        def dot(a, b) a[0] * b[0] + a[1] * b[1] + a[2] * b[2] end
        def len(a) Math.sqrt(dot(a, a)) end
        def neg(a) [-a[0], -a[1], -a[2]] end

        def cross(a, b)
          [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]
        end

        def unit(a)
          l = len(a)
          l < 1e-12 ? a.dup : mul(a, 1.0 / l)
        end

        def snap(a)
          a.map { |x| (x.abs < 1e-9 ? 0.0 : x) }
        end

        # ---- Khung tọa độ tấm: {'o','u','v','n'} trực chuẩn, thuận tay phải.
        def frame(o, u, v, n)
          { 'o' => o.map(&:to_f), 'u' => u.map(&:to_f), 'v' => v.map(&:to_f), 'n' => n.map(&:to_f) }
        end

        def f2w(f, p)
          add(add(add(f['o'], mul(f['u'], p[0])), mul(f['v'], p[1])), mul(f['n'], p[2] || 0.0))
        end

        def w2f(f, p)
          d = sub(p, f['o'])
          [dot(d, f['u']), dot(d, f['v']), dot(d, f['n'])]
        end

        def dir_w2f(f, d)
          [dot(d, f['u']), dot(d, f['v']), dot(d, f['n'])]
        end

        def dir_f2w(f, d)
          add(add(mul(f['u'], d[0]), mul(f['v'], d[1])), mul(f['n'], d[2]))
        end

        # Đặt module: quay quanh Z bội 90° rồi tịnh tiến.
        def rot_z(p, deg)
          case (deg.to_i % 360)
          when 0 then [p[0], p[1], p[2]]
          when 90 then [-p[1], p[0], p[2]]
          when 180 then [-p[0], -p[1], p[2]]
          when 270 then [p[1], -p[0], p[2]]
          else
            r = deg * Math::PI / 180.0
            [p[0] * Math.cos(r) - p[1] * Math.sin(r), p[0] * Math.sin(r) + p[1] * Math.cos(r), p[2]]
          end
        end

        def place_point(pos, rot, p)
          add(rot_z(p, rot), pos)
        end

        def place_frame(pos, rot, f)
          frame(place_point(pos, rot, f['o']), rot_z(f['u'], rot), rot_z(f['v'], rot), rot_z(f['n'], rot))
        end

        # Phản chiếu qua mặt phẳng x = xm, giữ khung thuận tay phải: u' = -R(u), tọa độ u đổi dấu.
        def mirror_frame_x(f, xm)
          r = lambda { |p| [2 * xm - p[0], p[1], p[2]] }
          rd = lambda { |d| [-d[0], d[1], d[2]] }
          frame(r.call(f['o']), neg(rd.call(f['u'])), rd.call(f['v']), rd.call(f['n']))
        end

        # ---- Đường bao 2D: danh sách đoạn {'t'=>'L','p'=>[u,v]} và
        # {'t'=>'A','c'=>[cu,cv],'r'=>r,'a0'=>độ,'a1'=>độ} (cung tính từ điểm hiện tại).
        def rect_outline(w, h)
          [{ 't' => 'L', 'p' => [0.0, 0.0] }, { 't' => 'L', 'p' => [w, 0.0] },
           { 't' => 'L', 'p' => [w, h] }, { 't' => 'L', 'p' => [0.0, h] }]
        end

        def poly_outline(pts)
          pts.map { |p| { 't' => 'L', 'p' => [p[0].to_f, p[1].to_f] } }
        end

        # Bo góc: r = {'bl','br','tr','tl'} (mm). Đi ngược chiều kim đồng hồ.
        def rounded_rect_outline(w, h, r)
          bl = r['bl'].to_f; br = r['br'].to_f; tr = r['tr'].to_f; tl = r['tl'].to_f
          return rect_outline(w, h) if [bl, br, tr, tl].all? { |x| x <= 0 }
          o = [{ 't' => 'L', 'p' => [bl, 0.0] }]
          if br > 0
            o << { 't' => 'L', 'p' => [w - br, 0.0] }
            o << { 't' => 'A', 'c' => [w - br, br], 'r' => br, 'a0' => -90.0, 'a1' => 0.0 }
          else
            o << { 't' => 'L', 'p' => [w, 0.0] }
          end
          if tr > 0
            o << { 't' => 'L', 'p' => [w, h - tr] }
            o << { 't' => 'A', 'c' => [w - tr, h - tr], 'r' => tr, 'a0' => 0.0, 'a1' => 90.0 }
          else
            o << { 't' => 'L', 'p' => [w, h] }
          end
          if tl > 0
            o << { 't' => 'L', 'p' => [tl, h] }
            o << { 't' => 'A', 'c' => [tl, h - tl], 'r' => tl, 'a0' => 90.0, 'a1' => 180.0 }
          else
            o << { 't' => 'L', 'p' => [0.0, h] }
          end
          if bl > 0
            o << { 't' => 'L', 'p' => [0.0, bl] }
            o << { 't' => 'A', 'c' => [bl, bl], 'r' => bl, 'a0' => 180.0, 'a1' => 270.0 }
          end
          clean = []
          o.each do |s|
            next if s['t'] == 'L' && clean.any? && clean.last['t'] == 'L' && clean.last['p'] == s['p']
            clean << s
          end
          clean
        end

        def mirror_outline_u(outline)
          # u -> -u, đảo thứ tự để giữ ngược chiều kim đồng hồ.
          pts = tessellate(outline, 64)
          poly_outline(pts.map { |p| [-p[0], p[1]] }.reverse)
        end

        def arc_count(outline)
          outline.count { |s| s['t'] == 'A' }
        end

        # Chia cung thành đoạn: tối đa seg_per_quarter đoạn mỗi 90°.
        def tessellate(outline, seg_per_quarter = 12)
          pts = []
          cur = nil
          outline.each do |s|
            if s['t'] == 'L'
              cur = s['p'].map(&:to_f)
              pts << cur
            else
              c = s['c']; r = s['r'].to_f; a0 = s['a0'].to_f; a1 = s['a1'].to_f
              sweep = a1 - a0
              n = [[(sweep.abs / 90.0 * seg_per_quarter).ceil, 1].max, 360].min
              (0..n).each do |i|
                a = (a0 + sweep * i / n) * Math::PI / 180.0
                p = [c[0] + r * Math.cos(a), c[1] + r * Math.sin(a)]
                next if i.zero? && cur && (p[0] - cur[0]).abs < 1e-6 && (p[1] - cur[1]).abs < 1e-6
                pts << p
              end
              cur = pts.last
            end
          end
          pts.pop if pts.size > 2 && (pts.first[0] - pts.last[0]).abs < 1e-6 && (pts.first[1] - pts.last[1]).abs < 1e-6
          pts
        end

        def polygon_area(pts)
          a = 0.0
          pts.each_with_index do |p, i|
            q = pts[(i + 1) % pts.size]
            a += p[0] * q[1] - q[0] * p[1]
          end
          a / 2.0
        end

        def bbox2(pts)
          xs = pts.map { |p| p[0] }; ys = pts.map { |p| p[1] }
          [xs.min, ys.min, xs.max, ys.max]
        end

        def point_in_polygon?(pt, pts)
          inside = false
          j = pts.size - 1
          pts.each_with_index do |pi, i|
            pj = pts[j]
            if ((pi[1] > pt[1]) != (pj[1] > pt[1])) &&
               (pt[0] < (pj[0] - pi[0]) * (pt[1] - pi[1]) / ((pj[1] - pi[1]).nonzero? || 1e-12) + pi[0])
              inside = !inside
            end
            j = i
          end
          inside
        end

        # Khoảng cách nhỏ nhất từ điểm tới biên đa giác.
        def dist_to_boundary(pt, pts)
          best = Float::INFINITY
          pts.each_with_index do |a, i|
            b = pts[(i + 1) % pts.size]
            dx = b[0] - a[0]; dy = b[1] - a[1]
            l2 = dx * dx + dy * dy
            t = l2 < 1e-12 ? 0.0 : [[((pt[0] - a[0]) * dx + (pt[1] - a[1]) * dy) / l2, 0.0].max, 1.0].min
            px = a[0] + t * dx; py = a[1] + t * dy
            d = Math.hypot(pt[0] - px, pt[1] - py)
            best = d if d < best
          end
          best
        end

        def segments_intersect?(p1, p2, p3, p4)
          d = lambda { |a, b, c| (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]) }
          d1 = d.call(p3, p4, p1); d2 = d.call(p3, p4, p2)
          d3 = d.call(p1, p2, p3); d4 = d.call(p1, p2, p4)
          ((d1 > 1e-9 && d2 < -1e-9) || (d1 < -1e-9 && d2 > 1e-9)) &&
            ((d3 > 1e-9 && d4 < -1e-9) || (d3 < -1e-9 && d4 > 1e-9))
        end

        def self_intersecting?(pts)
          n = pts.size
          (0...n).each do |i|
            a1 = pts[i]; a2 = pts[(i + 1) % n]
            ((i + 2)...n).each do |j|
              next if i.zero? && j == n - 1
              return true if segments_intersect?(a1, a2, pts[j], pts[(j + 1) % n])
            end
          end
          false
        end

        # Sutherland–Hodgman: cắt đa giác bất kỳ bởi hình chữ nhật (lồi).
        def clip_rect(pts, x0, y0, x1, y1)
          edges = [
            [->(p) { p[0] >= x0 }, ->(a, b) { ix(a, b, 0, x0) }],
            [->(p) { p[0] <= x1 }, ->(a, b) { ix(a, b, 0, x1) }],
            [->(p) { p[1] >= y0 }, ->(a, b) { ix(a, b, 1, y0) }],
            [->(p) { p[1] <= y1 }, ->(a, b) { ix(a, b, 1, y1) }]
          ]
          out = pts
          edges.each do |inside, inter|
            inp = out
            out = []
            next if inp.empty?
            s = inp.last
            inp.each do |e|
              if inside.call(e)
                out << inter.call(s, e) unless inside.call(s)
                out << e
              elsif inside.call(s)
                out << inter.call(s, e)
              end
              s = e
            end
          end
          out
        end

        # Sutherland–Hodgman với đa giác cắt LỒI bất kỳ (ngược chiều kim đồng hồ).
        def clip_convex(subject, clip)
          out = subject
          clip.each_with_index do |c1, i|
            c2 = clip[(i + 1) % clip.size]
            inside = ->(p) { (c2[0] - c1[0]) * (p[1] - c1[1]) - (c2[1] - c1[1]) * (p[0] - c1[0]) >= -1e-9 }
            inter = lambda do |s, e|
              dc = [c1[0] - c2[0], c1[1] - c2[1]]
              dp = [s[0] - e[0], s[1] - e[1]]
              n1 = c1[0] * c2[1] - c1[1] * c2[0]
              n2 = s[0] * e[1] - s[1] * e[0]
              den = dc[0] * dp[1] - dc[1] * dp[0]
              den = 1e-12 if den.abs < 1e-12
              [(n1 * dp[0] - n2 * dc[0]) / den, (n1 * dp[1] - n2 * dc[1]) / den]
            end
            inp = out
            out = []
            break if inp.empty?
            s = inp.last
            inp.each do |e|
              if inside.call(e)
                out << inter.call(s, e) unless inside.call(s)
                out << e
              elsif inside.call(s)
                out << inter.call(s, e)
              end
              s = e
            end
          end
          out
        end

        # Tam giác hóa đa giác đơn (ear clipping). Trả danh sách tam giác CCW.
        def triangulate(pts)
          poly = pts.dup
          poly.reverse! if polygon_area(poly) < 0
          tris = []
          guard = 0
          while poly.size > 3 && guard < 10_000
            guard += 1
            ear = false
            poly.size.times do |i|
              a = poly[i - 1]; b = poly[i]; c = poly[(i + 1) % poly.size]
              cr = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0])
              next if cr <= 1e-12
              tri = [a, b, c]
              next if poly.any? { |p| !tri.include?(p) && point_in_polygon?(p, tri) }
              tris << tri
              poly.delete_at(i)
              ear = true
              break
            end
            break unless ear
          end
          tris << poly if poly.size == 3
          tris
        end

        def ix(a, b, axis, val)
          d = b[axis] - a[axis]
          t = d.abs < 1e-12 ? 0.0 : (val - a[axis]) / d
          [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]
        end

        # Hộp bao theo trục (trong hệ assembly) của khối stock một tấm phẳng.
        def panel_aabb(panel)
          f = panel['frame']
          pts2 = tessellate(panel['outline'], 4)
          corners = []
          pts2.each do |p|
            corners << f2w(f, [p[0], p[1], 0.0])
            corners << f2w(f, [p[0], p[1], panel['t']])
          end
          mn = [0, 1, 2].map { |k| corners.map { |c| c[k] }.min }
          mx = [0, 1, 2].map { |k| corners.map { |c| c[k] }.max }
          [mn, mx]
        end

        # Trục thế giới (0,1,2) song song với vector đơn vị, hoặc nil nếu xiên.
        def axis_of(v)
          [0, 1, 2].each { |k| return k if (v[k].abs - 1.0).abs < 1e-6 }
          nil
        end
      end
    end
  end
end
