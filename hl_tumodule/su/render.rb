# encoding: UTF-8
# Vẽ tấm từ dữ liệu lõi vào SketchUp. Hình hiển thị luôn sinh từ dữ liệu tham số/feature
# (một nguồn). Rãnh soi hậu được KHOÉT thật vào khối tấm; lỗ khoan và tiết diện hiển thị dạng
# dấu kỹ thuật (đường bao) trong nhóm con "Dấu gia công" — dữ liệu gia công tách khỏi việc cắt mesh.
module HungLoan
  module TuModule
    module SU
      module Render
        U = Units
        C = Core
        MARK_TAG = 'HL Dấu gia công'.freeze
        module_function

        def mark_layer(model)
          model.layers[MARK_TAG] || model.layers.add(MARK_TAG)
        end

        # Dựng lại toàn bộ tấm của module (giữ material theo ID tấm). Trả map entityID → local_id.
        def module!(mod, built, extra_features = {})
          ents = Store.entities_of(mod)
          mats = {}
          Store.panels_in(mod).each { |g| mats[g.get_attribute(Store::DICT, 'local_id')] = g.material if g.material }
          ents.clear!
          registry = {}
          mid = built['params']['id']
          layer = mark_layer(mod.model)
          built['panels'].each do |pn|
            g = ents.add_group
            begin
              if pn['kind'] == 'bent'
                draw_bent(g, pn)
              else
                g.transformation = U.frame_tf(pn['frame'])
                draw_flat(g, pn)
                feats = (pn['features'] || []) + (extra_features[pn['local_id']] || [])
                draw_marks(g, pn, feats, layer) if feats.any?
              end
            rescue StandardError => e
              warn "[TuModule] Lỗi vẽ tấm #{pn['local_id']}: #{e.message}"
            end
            Store.tag_panel(g, pn, mid)
            g.material = mats[pn['local_id']] if mats[pn['local_id']]
            registry[g.entityID] = pn['local_id']
          end
          registry
        end

        def draw_flat(g, pn)
          ents = g.entities
          t = U.l(pn['t'])
          pts = C::Geom.tessellate(pn['outline'], C::Config::ARC_SEG_PER_QUARTER).map { |p| Geom::Point3d.new(U.l(p[0]), U.l(p[1]), 0) }
          face = ents.add_face(pts)
          return unless face
          face.reverse! if face.normal.z < 0
          face.pushpull(t)
          soften_arcs(ents) if C::Geom.arc_count(pn['outline']) > 0
          (pn['features'] || []).each do |f|
            next unless f['type'] == 'groove' && f['carve'] && f['rect']
            carve_rect(ents, f['rect'], f['face'] == 'A' ? pn['t'] : 0.0, f['depth'], pn['t'])
          end
        end

        # Làm mềm cạnh của mặt cong (các đoạn cung) để hiển thị mượt mà vẫn giới hạn số đoạn.
        def soften_arcs(ents)
          ents.grep(Sketchup::Edge).each do |e|
            next unless e.faces.size == 2
            n1, n2 = e.faces.map(&:normal)
            ang = n1.angle_between(n2)
            if ang > 0.001 && ang < 0.3 && n1.z.abs < 0.01 && n2.z.abs < 0.01
              e.soft = true
              e.smooth = true
            end
          end
        end

        def carve_rect(ents, r, w_mm, depth, t)
          w = U.l(w_mm)
          pts = [[r[0], r[1]], [r[2], r[1]], [r[2], r[3]], [r[0], r[3]]].map { |u, v| Geom::Point3d.new(U.l(u), U.l(v), w) }
          f = ents.add_face(pts)
          return false unless f
          into = w_mm > t / 2.0 ? -1.0 : 1.0
          d = U.l(depth)
          f.pushpull(f.normal.z * into > 0 ? d : -d)
          true
        rescue StandardError => e
          warn "[TuModule] Không khoét được rãnh: #{e.message}"
          false
        end

        def draw_bent(g, pn)
          b = pn['bent']
          seg = C::Config::ARC_SEG_PER_QUARTER
          n = [((b['a1'] - b['a0']).abs / 90.0 * seg).ceil, 2].max
          arc = lambda do |r|
            (0..n).map do |i|
              a = (b['a0'] + (b['a1'] - b['a0']) * i / n.to_f) * Math::PI / 180.0
              [b['c'][0] + r * Math.cos(a), b['c'][1] + r * Math.sin(a)]
            end
          end
          ring = arc.call(b['r_out']) + arc.call(b['r_in']).reverse
          pts = ring.map { |p| Geom::Point3d.new(U.l(p[0]), U.l(p[1]), U.l(b['z0'])) }
          face = g.entities.add_face(pts)
          return unless face
          face.reverse! if face.normal.z < 0
          face.pushpull(U.l(b['z1'] - b['z0']))
          soften_bent(g.entities)
        end

        def soften_bent(ents)
          ents.grep(Sketchup::Edge).each do |e|
            next unless e.faces.size == 2
            n1, n2 = e.faces.map(&:normal)
            if n1.z.abs < 0.01 && n2.z.abs < 0.01 && n1.angle_between(n2) < 0.3
              e.soft = true; e.smooth = true
            end
          end
        end

        # Dấu kỹ thuật cho lỗ khoan/tiết diện, vẽ trong nhóm con (không cắt khối tấm).
        def draw_marks(g, pn, feats, layer)
          mg = g.entities.add_group
          mg.name = 'Dấu gia công'
          mg.layer = layer
          mg.set_attribute(Store::DICT, 'kind', 'marks')
          ents = mg.entities
          eps = 0.1 # mm, nổi khỏi mặt để không chồng mặt
          feats.each do |f|
            case f['type']
            when 'drill'
              dir = U.vec(f['dir'])
              next if dir.length < 1e-9
              c = U.pt(f['pos'].each_with_index.map { |x, i| x - f['dir'][i] * eps })
              r = U.l(f['diameter'] / 2.0)
              ents.add_circle(c, dir, r, 16)
              tip = U.pt(f['pos'].each_with_index.map { |x, i| x + f['dir'][i] * f['depth'] })
              ents.add_cline(c, tip) rescue nil
            when 'pocket'
              w = f['face'] == 'A' ? pn['t'] + eps : -eps
              (f['outline'] || []).each do |poly|
                next if poly.size < 3
                pts = poly.map { |p| Geom::Point3d.new(U.l(p[0]), U.l(p[1]), U.l(w)) }
                ents.add_edges(pts + [pts.first])
              end
            end
          end
          mg
        end
      end
    end
  end
end
