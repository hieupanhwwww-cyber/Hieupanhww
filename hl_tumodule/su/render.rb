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
        # Hai lượt: (1) dựng mọi tấm, (2) vẽ dấu gia công — vì thuộc tính ABF của cam/rãnh cần ID tấm đối tác.
        def module!(mod, built, extra_features = {})
          ents = Store.entities_of(mod)
          mats = {}
          Store.panels_in(mod).each { |g| mats[g.get_attribute(Store::DICT, 'local_id')] = g.material if g.material }
          ents.clear!
          registry = {}
          groups = {}
          mid = built['params']['id']
          built['panels'].each do |pn|
            g = ents.add_group
            begin
              if pn['kind'] == 'bent'
                draw_bent(g, pn)
              else
                g.transformation = U.frame_tf(pn['frame'])
                draw_flat(g, pn)
              end
            rescue StandardError => e
              warn "[TuModule] Lỗi vẽ tấm #{pn['local_id']}: #{e.message}"
            end
            Store.tag_panel(g, pn, mid)
            g.material = mats[pn['local_id']] if mats[pn['local_id']]
            registry[g.entityID] = pn['local_id']
            groups[pn['local_id']] = g
          end
          world = begin
            Pick.world_tf(Actions.path_to(mod) + [mod])
          rescue StandardError
            nil
          end
          ctx = { 'resolve' => ->(lid) { (gg = groups[lid.to_s.split('/').last]) && abf_id(gg) }, 'world' => world, 'cam_groups' => {} }
          built['panels'].each do |pn|
            next if pn['kind'] == 'bent'
            feats = (pn['features'] || []) + (extra_features[pn['local_id']] || [])
            draw_marks(groups[pn['local_id']], pn, feats, ctx) if feats.any?
          end
          registry
        end

        # ID ABF dùng để nối các đối tượng (bền qua lưu/mở file).
        def abf_id(e)
          e.respond_to?(:persistent_id) ? e.persistent_id : e.entityID
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
        # ĐỐI TƯỢNG GIA CÔNG KIỂU ABF — dựng theo HÌNH HỌC THẬT đọc từ dự án ABF của xưởng (docs/khao_sat/ABF_HINH_HOC_THAT.md):
        #  • Cam/chốt/lỗ cạnh: nhóm con nằm ở Layer0, bên trong là các CẠNH (không cần mặt) và CHÍNH CÁC CẠNH nằm trên layer ABF
        #      _ABF_minifixBolts       : vòng tròn Ø15 trên mặt tấm mang cam           → cạnh trên ABF-D15
        #      _ABF_minifixPlasticBase : vòng tròn Ø5 trên mặt tấm đối diện            → cạnh trên ABF-D5
        #      _ABF_sideDrill          : vòng tròn Ø8 trên mặt cạnh, tâm giữa độ dày   → cạnh trên ABF-DSIDE-8
        #      _ABF_sideDrillDepth     : chữ nhật (sâu × Ø) TRÊN MẶT CÓ CỐC CAM, từ mép → cạnh trên ABF-DSIDE-8
        #  • Bản lề: nhóm ABF_D35 trên layer ABF_D35; viền cốc trên ABF_D35 + vòng tròn lỗ mồi Ø3 ở tâm trên ABF_D3.
        #  • Rãnh hậu: nhóm _ABF_Intersect, nhóm + mặt + cạnh đều trên ABF_SOI HAU; rộng đúng độ dày hậu, dài thêm intersect-x mỗi đầu.
        # Mỗi nhóm mang dictionary "ABF" (setting-name, id tấm đối tác…).
        # ctx: {'resolve' => ->(local_id) { id tấm }, 'world' => Transformation module→thế giới, 'cam_groups' => {}}
        def draw_marks(g, pn, feats, ctx = nil)
          ctx ||= { 'resolve' => ->(_x) {}, 'world' => nil, 'cam_groups' => {} }
          ctx['cam_groups'] ||= {}
          ctx['cam_normals'] ||= {}
          ctx['cam_face_w'] ||= {}
          rules = C::AbfRules
          model = g.model
          made = []
          mk = lambda do |f, key, group_on_layer|
            sub = g.entities.add_group
            sub.name = rules.instance_for(f, key)
            sub.layer = ensure_layer(model, rules.tag_for(f, key), f) if group_on_layer
            sub.set_attribute(Store::DICT, 'kind', 'marks')
            sub.set_attribute(Store::DICT, 'feature', f['id'])
            made << sub
            sub
          end
          put = lambda do |sub, f, key, ids|
            rules.attrs_for(f, key, ids).each { |k, v| sub.set_attribute(rules::DICT, k, v) }
          end
          on_layer = lambda do |ents_list, ly|
            Array(ents_list).each { |e| e.layer = ly if e.respond_to?(:layer=) }
          end
          loop_edges = lambda do |sub, pts_mm, ly|
            pts = pts_mm.map { |q| U.pt(q) }
            on_layer.call(sub.entities.add_edges(pts + [pts.first]), ly)
          end
          # cốc cam trước để lỗ cạnh tham chiếu được (face-drill-group-id, mặt đặt dấu độ sâu)
          order = feats.sort_by { |f| f['op'] == 'cam_housing' ? 0 : 1 }
          order.each do |f|
            begin
              key = rules.op_key(f)
              src = f['source'] || {}
              edge_id = face_id = nil
              if src['kind'] == 'cam'
                la, lb = src['joint'].to_s.split('>', 2) # la = tấm mang cam (cạnh tựa), lb = tấm nhận Ø5 trên mặt
                edge_id = ctx['resolve'].call(la); face_id = ctx['resolve'].call(lb)
              end
              case f['type']
              when 'drill'
                dir = U.vec(f['dir'])
                next if dir.length < 1e-9
                ids = { 'edge' => edge_id, 'face' => face_id }
                jk = "#{src['joint']}:#{src['index']}"
                if key == 'hinge_cup'
                  draw_hinge(g, f, mk, put, on_layer, loop_edges, model)
                  next
                end
                sub = mk.call(f, key, false)
                ly = ensure_layer(model, rules.tag_for(f, key), f)
                on_layer.call(sub.entities.add_circle(U.pt(f['pos']), dir, U.l(f['diameter'] / 2.0), 24), ly)
                up = lambda do |ff|
                  v = U.vec(C::Geom.dir_f2w(pn['frame'], ff['dir'].map { |x| -x }))
                  ctx['world'] ? v.transform(ctx['world']) : v
                end
                if key == 'cam_housing'
                  ctx['cam_groups'][jk] = abf_id(sub)
                  ctx['cam_normals'][jk] = up.call(f)
                  ctx['cam_face_w'][jk] = f['pos'][2]
                  sub.set_attribute(rules::DICT, 'minifix-up-face-normal', ctx['cam_normals'][jk])
                elsif key == 'cam_bolt'
                  sub.set_attribute(rules::DICT, 'minifix-up-face-normal', up.call(f))
                elsif key == 'cam_edge_hole'
                  ids['face_group'] = ctx['cam_groups'][jk]
                  nrm = ctx['cam_normals'][jk]
                  sub.set_attribute(rules::DICT, 'minifix-up-face-normal', nrm) if nrm
                  rect = rules.side_depth_rect(f, ctx['cam_face_w'][jk])
                  if rect
                    dsub = mk.call(f, 'cam_side_depth', false)
                    loop_edges.call(dsub, rect, ensure_layer(model, rules.tag_for(f, 'cam_side_depth'), f))
                    put.call(dsub, f, 'cam_side_depth', ids)
                    dsub.set_attribute(rules::DICT, 'minifix-up-face-normal', nrm) if nrm
                  end
                end
                put.call(sub, f, key, ids)
              when 'groove'
                next unless f['rect']
                sub = mk.call(f, key, true)
                ly = sub.layer
                w = f['face'] == 'A' ? pn['t'] : 0.0
                r = key == 'back_groove' ? rules.intersect_rect(f, rules.settings['intersect_x'].to_f) : f['rect']
                face = sub.entities.add_face([[r[0], r[1]], [r[2], r[1]], [r[2], r[3]], [r[0], r[3]]].map { |u, v| Geom::Point3d.new(U.l(u), U.l(v), U.l(w)) })
                if face
                  on_layer.call(face, ly)
                  on_layer.call(face.edges, ly) if face.respond_to?(:edges)
                end
                put.call(sub, f, key, 'other' => ctx['resolve'].call(src['other']))
              when 'pocket'
                sub = mk.call(f, key, true)
                ly = sub.layer
                w = f['face'] == 'A' ? pn['t'] : 0.0
                (f['outline'] || []).each do |poly|
                  next if poly.size < 3
                  face = sub.entities.add_face(poly.map { |q| Geom::Point3d.new(U.l(q[0]), U.l(q[1]), U.l(w)) })
                  next unless face
                  on_layer.call(face, ly)
                  on_layer.call(face.edges, ly) if face.respond_to?(:edges)
                end
                put.call(sub, f, key, 'other' => ctx['resolve'].call(src['other'])) if key == 'section'
              end
            rescue StandardError => e
              Safe.log("vẽ dấu #{f['id']}", e)
            end
          end
          made
        end

        # Bản lề như dự án ABF của xưởng: nhóm trên layer cốc, viền cốc (cắt phẳng hai phía) + vòng tròn lỗ mồi ở tâm.
        # Chế độ 'cup': vòng tròn đủ Ø cốc trên layer cốc (ABF khoan cả cốc nếu layer đó được khai báo).
        def draw_hinge(g, f, mk, put, on_layer, loop_edges, model)
          rules = C::AbfRules
          st = rules.settings
          sub = mk.call(f, 'hinge_cup', true)
          ly = sub.layer
          dir = U.vec(f['dir'])
          if st['hinge_mark'] == 'cup'
            on_layer.call(sub.entities.add_circle(U.pt(f['pos']), dir, U.l(f['diameter'] / 2.0), 24), ly)
          else
            loop_edges.call(sub, rules.cup_outline(f, st['cup_clip'].to_f), ly)
            pf = f.merge('diameter' => st['pilot_d'].to_f)
            ply = ensure_layer(model, rules.tag_for(pf, 'hinge_pilot'), pf)
            on_layer.call(sub.entities.add_circle(U.pt(f['pos']), dir, U.l(st['pilot_d'].to_f / 2.0), 12), ply)
          end
          put.call(sub, f, 'hinge_cup', {})
        end

        def ensure_layer(model, tag, f)
          ly = model.layers[tag]
          unless ly
            ly = model.layers.add(tag)
            begin
              ly.color = Sketchup::Color.new(*C::AbfRules.color_for(tag, f)) if ly.respond_to?(:color=)
            rescue StandardError
              nil
            end
          end
          ly
        end
      end
    end
  end
end
