# encoding: UTF-8
# Bắt module/tấm dưới chuột với ĐẦY ĐỦ transformation lồng (không dùng world bounding box).
module HungLoan
  module TuModule
    module SU
      module Pick
        U = Units
        module_function

        def world_tf(path)
          model = Sketchup.active_model
          tf = path.first && path.first.parent == model ? Geom::Transformation.new : model.edit_transform
          path.each { |e| tf *= e.transformation if e.respond_to?(:transformation) }
          tf
        end

        # Trả {'mod','tf'(module→world),'path','panel','panel_tf'} hoặc nil.
        def module_at(view, x, y)
          ph = view.pick_helper
          ph.do_pick(x, y)
          ph.count.times do |i|
            path = ph.path_at(i)
            next unless path
            idx = path.rindex { |e| Store.module?(e) }
            next unless idx
            mp = path[0..idx]
            nxt = path[idx + 1]
            panel = nxt && Store.panel?(nxt) ? nxt : nil
            tf = world_tf(mp)
            return { 'mod' => path[idx], 'tf' => tf, 'path' => mp, 'panel' => panel,
                     'panel_tf' => panel ? tf * panel.transformation : nil }
          end
          nil
        end

        # Tia chuột trong hệ local (mm) của transformation tf.
        def local_ray(view, x, y, tf)
          o, d = view.pickray(x, y)
          inv = tf.inverse
          [U.pt_mm(o.transform(inv)), d.transform(inv).normalize.to_a]
        end

        # Giao tia với mặt phẳng trục k = value (local, mm).
        def hit_plane(ray, k, value)
          o, d = ray
          return nil if d[k].abs < 1e-9
          s = (value - o[k]) / d[k]
          return nil if s < 0
          [o[0] + d[0] * s, o[1] + d[1] * s, o[2] + d[2] * s]
        end

        # Cạnh hộp của các tấm (mm, hệ module) để vẽ xem trước nhẹ.
        def panel_lines(panels, seg = 4)
          lines = []
          panels.each do |pn|
            if pn['kind'] == 'bent'
              b = pn['bent']
              [b['r_out'], b['r_in']].each do |r|
                pts = (0..seg).map { |i| a = (b['a0'] + (b['a1'] - b['a0']) * i / seg.to_f) * Math::PI / 180; [b['c'][0] + r * Math.cos(a), b['c'][1] + r * Math.sin(a)] }
                [b['z0'], b['z1']].each { |z| pts.each_cons(2) { |p, q| lines << [p + [z], q + [z]] } }
              end
              next
            end
            pts = Core::Geom.tessellate(pn['outline'], seg)
            f = pn['frame']
            bot = pts.map { |p| Core::Geom.f2w(f, [p[0], p[1], 0.0]) }
            top = pts.map { |p| Core::Geom.f2w(f, [p[0], p[1], pn['t']]) }
            bot.each_with_index do |p, i|
              lines << [p, bot[(i + 1) % bot.size]]
              lines << [top[i], top[(i + 1) % top.size]]
            end
            if pts.size <= 8
              bot.each_with_index { |p, i| lines << [p, top[i]] }
            end
          end
          lines
        end

        def draw_lines(view, lines, tf, color, width = 1)
          return if lines.empty?
          view.drawing_color = color
          view.line_width = width
          pts = []
          lines.each { |a, b| pts << U.pt(a).transform(tf) << U.pt(b).transform(tf) }
          view.draw(GL_LINES, pts)
        end

        def draw_box(view, box, tf, color, width = 2)
          x0, x1, y0, y1, z0, z1 = box
          c = [[x0, y0, z0], [x1, y0, z0], [x1, y1, z0], [x0, y1, z0], [x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]]
          e = [[0, 1], [1, 2], [2, 3], [3, 0], [4, 5], [5, 6], [6, 7], [7, 4], [0, 4], [1, 5], [2, 6], [3, 7]]
          draw_lines(view, e.map { |a, b| [c[a], c[b]] }, tf, color, width)
        end

        def text(view, x, y, msg, color = 'black')
          view.drawing_color = color
          view.draw_text(Geom::Point3d.new(x + 18, y + 18, 0), msg)
        end

        DIGIT_KEYS = ((48..57).to_a + (96..105).to_a + [190, 110, 188]).freeze
      end
    end
  end
end
