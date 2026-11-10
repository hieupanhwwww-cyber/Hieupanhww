# encoding: UTF-8
# Bàn giao sản xuất: thu thập chi tiết + feature từ tham số (một nguồn), kiểm tra, xuất dữ liệu trung lập
# và tạo "bản gia công" (snapshot) phẳng một cấp cho ABF/Nesting. Tương thích ABF: CHƯA KIỂM CHỨNG.
module HungLoan
  module TuModule
    module SU
      module Export
        C = Core
        U = Units
        M = Manager
        DICT = 'HungLoan_MFG'.freeze
        module_function

        def scope_assemblies(model)
          sel = Actions.selected_assemblies
          return sel if sel.any?
          scope_all(model)
        end

        def scope_all(model)
          found = []
          walk = lambda do |ents, depth|
            ents.grep(Sketchup::Group).each do |g|
              if Store.assembly?(g) then found << g
              elsif depth < 6 then walk.call(g.entities, depth + 1)
              end
            end
          end
          walk.call(model.entities, 0)
          found
        end

        def tf_frame(tf, f)
          o = U.pt(f['o']).transform(tf)
          vec = ->(v) { x = U.vec(v).transform(tf); x.normalize! if x.length > 0; x.to_a }
          { 'o' => U.pt_mm(o), 'u' => vec.call(f['u']), 'v' => vec.call(f['v']), 'n' => vec.call(f['n']) }
        end

        # Trả [parts, joints(global ids)] trong hệ tọa độ THẾ GIỚI (mm).
        def collect(model)
          panels = []
          joints = []
          scope_assemblies(model).each do |asm|
            atf = Pick.world_tf(Actions.path_to(asm) + [asm])
            data = Store.asm_data(asm)
            groups = Store.modules_in(asm)
            builts = {}; recs = {}; mats = {}
            groups.each do |g|
              p = Store.params(g) or next
              builts[p['id']] = M.build(p)
              recs[p['id']] = M.record(g, p)
              mats[p['id']] = Store.panels_in(g).map { |pg| [pg.get_attribute(Store::DICT, 'local_id'), pg.material && pg.material.display_name] }.to_h
            end
            extras, = M.sections_for(C::Util.deep_copy(data), builts, recs, {})
            builts.each do |mid, b|
              M.placed_panels(mid, b, recs[mid], mats[mid]).each do |pn|
                pn['features'] = pn['features'] + ((extras[mid] || {})[pn['local_id']] || [])
                pn['assembly_id'] = Store.id(asm)
                pn['frame'] = tf_frame(atf, pn['frame']) unless pn['kind'] == 'bent'
                panels << pn
              end
              b['joints'].each do |j|
                joints << j.merge('id' => "#{mid}/#{j['id']}", 'a' => "#{mid}/#{j['a']}", 'b' => "#{mid}/#{j['b']}")
              end
            end
          end
          # Gắn lại nguồn joint vào ID toàn cục để kiểm tra khớp cam/chốt.
          panels.each do |pn|
            mid = pn['module_id']
            pn['features'] = pn['features'].map do |f|
              next f unless f.dig('source', 'joint')
              f.merge('source' => f['source'].merge('joint' => "#{mid}/#{f['source']['joint']}"))
            end
          end
          [C::Mfg.parts(panels), joints]
        end

        def check(model = Sketchup.active_model)
          parts, joints = collect(model)
          issues = C::Mfg.validate(parts, joints)
          [parts, joints, issues]
        end

        def report_text(parts, issues)
          s = C::Mfg.summary(parts, issues)
          st = C::Mfg.status(issues)
          lines = []
          lines << "Chi tiết: #{s['parts']} · Thao tác gia công: #{s['operations']}"
          lines << "Theo loại: #{s['by_op'].map { |k, v| "#{k}=#{v}" }.join(', ')}" if s['by_op'].any?
          lines << "Lỗi: #{s['errors']} · Cảnh báo: #{s['warnings']}"
          lines << "Hình học hợp lệ: #{st['geometry_valid'] ? 'CÓ' : 'KHÔNG'}"
          lines << 'Thông số xưởng: CHƯA KIỂM CHỨNG (đang dùng preset DEMO)' if st['shop_params_unverified']
          lines << 'Có loại chi tiết chưa hỗ trợ gia công (tấm uốn)' if st['has_unsupported']
          lines << 'Tương thích ABF/Nesting: CHƯA KIỂM CHỨNG'
          errs = issues.select { |i| i['level'] == 'error' }
          if errs.any?
            lines << ''
            lines << 'Lỗi đầu tiên:'
            errs.first(12).each { |i| lines << "• [#{i['code']}] #{i['part']}#{i['feature'] ? " / #{i['feature']}" : ''}: #{i['message']}" }
          end
          lines.join("\n")
        end

        def cmd_check
          parts, _, issues = check
          return Safe.msgbox('Không có bộ tủ nào do plugin tạo.') if parts.empty?
          Safe.msgbox(report_text(parts, issues), MB_MULTILINE, 'Kiểm tra dữ liệu sản xuất')
        end

        def cmd_export_files
          model = Sketchup.active_model
          parts, _, issues = check(model)
          return Safe.msgbox('Không có bộ tủ nào do plugin tạo.') if parts.empty?
          base = File.basename(model.path.to_s, '.skp')
          base = 'bo_tu' if base.empty?
          path = Safe.save_panel('Lưu dữ liệu gia công (JSON)', "#{base}_gia_cong.json")
          return unless path
          path += '.json' unless path.downcase.end_with?('.json')
          meta = { 'model' => File.basename(model.path.to_s), 'plugin' => Core::Config::DISPLAY_NAME, 'version' => TuModule::VERSION,
                   'exported_at' => Time.now.strftime('%Y-%m-%d %H:%M:%S') }
          File.write(path, C::Mfg.to_json(parts, issues, meta), encoding: 'UTF-8')
          File.write(path.sub(/\.json\z/i, '_chi_tiet.csv'), "\uFEFF" + C::Mfg.to_csv_parts(parts), encoding: 'UTF-8')
          File.write(path.sub(/\.json\z/i, '_thao_tac.csv'), "\uFEFF" + C::Mfg.to_csv_ops(parts), encoding: 'UTF-8')
          Safe.msgbox("Đã lưu:\n#{path}\n+ 2 file CSV (chi tiết, thao tác).\n\n#{report_text(parts, issues)}", MB_MULTILINE)
        end

        # ---- Bản gia công (snapshot) cho ABF/Nesting — dựng lại mỗi lần, không cộng dồn lỗ cũ.
        def cmd_snapshot
          model = Sketchup.active_model
          parts, _, issues = check(model)
          return Safe.msgbox('Không có bộ tủ nào do plugin tạo.') if parts.empty?
          plan = C::AbfAdapter.plan(parts, issues)
          errs = issues.count { |i| i['level'] == 'error' && i['code'] != 'UNSUPPORTED_BENT' }
          if errs > 0
            r = Safe.msgbox("Có #{errs} lỗi dữ liệu sản xuất.\n\n#{report_text(parts, issues)}\n\nVẫn tạo bản gia công để xem?", MB_YESNO)
            return unless r == IDYES
          end
          failed = []
          Manager.operation('Tạo bản gia công') do
            old = model.entities.grep(Sketchup::Group).select { |g| g.get_attribute(DICT, 'kind') == 'snapshot' }
            model.entities.erase_entities(old) if old.any?
            bb = model.bounds
            offset = Geom::Transformation.new([bb.max.x + U.l(1000), 0, 0])
            root = model.entities.add_group
            root.name = "Bản gia công #{Time.now.strftime('%d/%m %H:%M')} (ABF: chưa kiểm chứng)"
            root.set_attribute(DICT, 'kind', 'snapshot')
            root.set_attribute(DICT, 'status', plan['status'])
            made = {}
            plan['items'].each do |it|
              g = root.entities.add_group
              made[it['part']] = g
              g.transformation = offset * U.frame_tf(it['frame'])
              g.name = "#{it['label']} #{it['part']}"
              draw_part(g, it, failed)
              g.set_attribute(DICT, 'part_id', it['part'])
              g.set_attribute(DICT, 'role', it['role'])
              g.set_attribute(DICT, 'thickness_mm', it['thickness'])
              g.set_attribute(DICT, 'ops', JSON.generate(it['ops']))
              g.set_attribute(DICT, 'units', 'mm')
              if it['material'] && (mat = model.materials[it['material']])
                g.material = mat
              end
            end
            # Lượt 2: đối tượng gia công kiểu ABF (cần ID tấm đối tác nên vẽ sau khi đủ tấm)
            cam_groups = {}
            plan['items'].each do |it|
              next if it['ops'].empty?
              mid = it['part'].split('/').first
              resolve = lambda do |k|
                gg = made[k.to_s] || made["#{mid}/#{k}"]
                gg && Render.abf_id(gg)
              end
              Render.draw_marks(made[it['part']], { 't' => it['thickness'].to_f, 'frame' => it['frame'] }, it['ops'],
                                'resolve' => resolve, 'world' => nil, 'cam_groups' => cam_groups)
            end
            true
          end
          msg = "Đã tạo bản gia công: #{plan['items'].size} chi tiết phẳng một cấp, cam/chốt, bản lề, rãnh hậu là đối tượng kiểu ABF (_ABF_minifix…, _ABF_Intersect) nằm ngay trong tấm.\n" \
                "Bỏ qua (chưa hỗ trợ): #{plan['skipped'].size}\nTương thích ABF/Nesting: CHƯA KIỂM CHỨNG — xem docs/ABF_HANDOFF.md."
          msg += "\n\nKhông khoét được #{failed.size} thao tác (đã ghi trong thuộc tính):\n" + failed.first(8).join("\n") if failed.any?
          Safe.msgbox(msg, MB_MULTILINE)
        end

        def draw_part(g, it, failed)
          ents = g.entities
          t = it['thickness'].to_f
          pts = it['outline'].map { |p| Geom::Point3d.new(U.l(p[0]), U.l(p[1]), 0) }
          face = ents.add_face(pts)
          return unless face
          face.reverse! if face.normal.z < 0
          face.pushpull(U.l(t))
          # ABF nhận tấm là lăng trụ nguyên + dấu trên tag ABF_… → mặc định KHÔNG khoét mesh.
          if C::Config::SNAPSHOT_CARVE
            it['ops'].each do |op|
              ok = begin
                case op['type']
                when 'drill' then carve_hole(ents, op, t)
                when 'groove' then Render.carve_rect(ents, op['rect'], op['face'] == 'A' ? t : 0.0, op['depth'], t)
                when 'pocket' then carve_poly(ents, op, t)
                end
              rescue StandardError => e
                warn "[TuModule] snapshot #{op['feature']}: #{e.message}"
                false
              end
              failed << "• #{it['part']} / #{op['feature']}" unless ok
            end
          end
        end

        def carve_hole(ents, op, _t)
          c = U.pt(op['pos'])
          dir = U.vec(op['dir'])
          edges = ents.add_circle(c, dir, U.l(op['diameter'] / 2.0), 24)
          f = edges.first && edges.first.faces.min_by { |x| x.area }
          f ||= ents.add_face(edges)
          return false unless f
          d = U.l(op['depth'])
          f.pushpull(f.normal.dot(dir) > 0 ? d : -d)
          true
        end

        def carve_poly(ents, op, t)
          ok = true
          w = op['face'] == 'A' ? t : 0.0
          (op['outline'] || []).each do |poly|
            next if poly.size < 3
            f = ents.add_face(poly.map { |p| Geom::Point3d.new(U.l(p[0]), U.l(p[1]), U.l(w)) })
            (ok = false; next) unless f
            into = w > t / 2 ? -1.0 : 1.0
            d = U.l(op['through'] ? t : op['depth'])
            f.pushpull(f.normal.z * into > 0 ? d : -d)
          end
          ok
        end
      end
    end
  end
end
