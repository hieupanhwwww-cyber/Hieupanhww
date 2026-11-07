# encoding: UTF-8
# Điều phối cập nhật: một hành động người dùng = một operation (một lần Ctrl+Z), giải liên kết
# MỘT LẦN bằng Solver, chỉ dựng lại các module bị ảnh hưởng (ChangeSet theo module).
module HungLoan
  module TuModule
    module SU
      class OpError < StandardError; end

      module Manager
        C = Core
        U = Units
        @busy = 0
        @in_op = false
        @registries = {} # definition.entityID => {entityID => local_id}

        module_function

        def busy?; @busy > 0; end

        def guard
          @busy += 1
          yield
        ensure
          @busy -= 1
        end

        def registries; @registries; end

        # Bao một hành động thành operation. Không lồng start_operation.
        def operation(name, transparent: false)
          model = Sketchup.active_model
          return guard { yield model } if @in_op
          @in_op = true
          model.start_operation(name, true, false, transparent)
          begin
            r = guard { yield model }
            model.commit_operation
            r
          rescue C::ValidationError, OpError => e
            model.abort_operation
            UI.messagebox(e.message)
            nil
          rescue StandardError => e
            model.abort_operation
            warn "[TuModule] #{e.class}: #{e.message}\n#{e.backtrace.first(8).join("\n")}"
            UI.messagebox("Lỗi khi cập nhật: #{e.message}")
            nil
          ensure
            @in_op = false
          end
        end

        # ---------------------------------------------------------------- dữ liệu
        def record(g, p)
          a = U.axes_scale(g.transformation)
          r = { 'w' => p['w'].to_f, 'd' => p['d'].to_f, 'h' => p['h'].to_f, 'pos' => a['origin'],
                'rot' => U.rot_of(g.transformation), 'geometry' => p['geometry'] }
          if p['l']
            r['la'] = p['l']['la'].to_f; r['lb'] = p['l']['lb'].to_f
          end
          r
        end

        def depth_extent(p)
          p['l'] ? p['l']['lb'].to_f : p['d'].to_f
        end

        def ctx(p) Prefs.ctx_for(p) end

        def build(p) C::Builder.build(p, ctx(p)) end

        # Tấm của module đặt vào hệ assembly, ID toàn cục "module/local".
        def placed_panels(mid, built, rec, material_map = {})
          built['panels'].map do |pn|
            q = C::Util.deep_copy(pn)
            q['id'] = "#{mid}/#{pn['local_id']}"
            q['module_id'] = mid
            q['frame'] = pn['kind'] == 'bent' ? pn['frame'] : C::Geom.place_frame(rec['pos'], rec['rot'], pn['frame'])
            if pn['kind'] == 'bent'
              q['bent'] = pn['bent'].merge('placed' => [rec['pos'], rec['rot']])
            end
            q['material'] = material_map[pn['local_id']]
            q
          end
        end

        # ID độc lập cho bản copy (persistent_id khác bản ghi) và definition riêng trước khi sửa.
        def normalize!(asm, mods)
          if asm
            asm.make_unique if asm.definition.count_instances > 1
            if asm.respond_to?(:persistent_id) && asm.get_attribute(Store::DICT, 'pid') != asm.persistent_id
              Store.tag_assembly(asm, C::Util.new_id('asm'))
            end
          end
          map = {}
          mods.each do |m|
            m.make_unique if m.definition.count_instances > 1
            next unless m.respond_to?(:persistent_id)
            stored = m.get_attribute(Store::DICT, 'pid')
            next if stored == m.persistent_id
            p = Store.params(m)
            if stored && p
              old = p['id']
              p['id'] = C::Util.new_id('mod')
              map[old] = p['id']
              Store.set_params(m, p)
            end
            m.set_attribute(Store::DICT, 'pid', m.persistent_id)
          end
          map
        end

        def remap_asm_data(d, map)
          return d if map.empty?
          d['links'].each do |l|
            l['lower'] = map[l['lower']] || l['lower']
            l['upper'] = map[l['upper']] || l['upper']
          end
          sec = d['sections']
          sec['marked'] = sec['marked'].map { |k, v| [remap_key(k, map), v] }.to_h
          sec['receiver_override'] = sec['receiver_override'].map { |k, v| [remap_key(k, map), remap_key(v, map)] }.to_h
          d
        end

        def remap_key(k, map)
          k.to_s.split(/([~>])/).map { |part| m, l = part.split('/', 2); l && map[m] ? "#{map[m]}/#{l}" : part }.join
        end

        # ---------------------------------------------------------------- cập nhật chính
        # edits: {module_id => params mới}, moves: {module_id => {'pos','rot'}}, scale: [sx,sy,sz] cho cả bộ.
        def update!(asm, single: nil, edits: {}, moves: {}, scale: nil, regen: [], drop_links_for: [])
          groups = asm ? Store.modules_in(asm) : [single].compact
          idmap = normalize!(asm, groups)
          edits = edits.map { |k, v| [idmap[k] || k, v.merge('id' => idmap[k] || k)] }.to_h
          moves = moves.map { |k, v| [idmap[k] || k, v] }.to_h
          by_id = {}; params = {}; recs = {}
          groups.each do |g|
            p = Store.params(g) or next
            by_id[p['id']] = g; params[p['id']] = p; recs[p['id']] = record(g, p)
          end
          data = asm ? remap_asm_data(Store.asm_data(asm), idmap) : { 'links' => [], 'sections' => { 'marked' => {}, 'receiver_override' => {} } }
          data['links'].reject! { |l| drop_links_for.include?(l['lower']) || drop_links_for.include?(l['upper']) || !by_id[l['lower']] || !by_id[l['upper']] }
          moves.each { |id, mv| recs[id]['pos'] = mv['pos'] if mv['pos']; recs[id]['rot'] = mv['rot'] if mv['rot'] }
          dim_changes = {}
          edits.each do |id, np|
            next unless params[id]
            old = params[id]
            ch = {}
            %w[w d h].each { |k| ch[k] = np[k].to_f if (np[k].to_f - old[k].to_f).abs > 1e-9 }
            dim_changes[id] = ch if ch.any?
            params[id] = np
            recs[id].merge!('w' => np['w'].to_f, 'd' => np['d'].to_f, 'h' => np['h'].to_f)
            if np['l']
              recs[id]['la'] = np['l']['la'].to_f; recs[id]['lb'] = np['l']['lb'].to_f; recs[id]['w'] = np['l']['la'].to_f
            end
          end
          res = scale ? C::Solver.scale_assembly(recs, data['links'], *scale) : C::Solver.solve(recs, data['links'], dim_changes)
          raise OpError, res['errors'].map { |e| e['message'] }.join("\n") if res['errors'].any?
          nrec = res['mods']
          need = (edits.keys + regen).uniq
          params.each do |id, p|
            r = nrec[id]
            dims = false
            %w[w d h].each do |k|
              next if (p[k].to_f - r[k].to_f).abs < 1e-6
              p[k] = r[k]; dims = true
            end
            if p['l'] && r['la']
              if (p['l']['la'].to_f - r['la']).abs > 1e-6 || (p['l']['lb'].to_f - r['lb']).abs > 1e-6
                p['l']['la'] = r['la']; p['l']['lb'] = r['lb']; p['w'] = r['la']; dims = true
              end
            end
            need << id if dims
          end
          need.uniq!
          builts = {}
          params.each { |id, p| builts[id] = build(p) }
          errs = need.flat_map { |id| builts[id]['errors'].select { |e| e['level'] == 'error' }.map { |e| "• #{params[id]['template_name']}: #{e['message']}" } }
          raise OpError, "Không áp dụng được thay đổi:\n#{errs.first(8).join("\n")}" if errs.any?
          warnings = need.flat_map { |id| builts[id]['errors'].select { |e| e['level'] == 'warning' }.map { |e| e['message'] } }
          extras, sec_notes = asm ? sections_for(data, builts, nrec, by_id) : [{}, []]
          by_id.each do |id, g|
            sig = extras[id] ? JSON.generate(extras[id]).hash.to_s : ''
            regen_this = need.include?(id) || g.get_attribute(Store::DICT, 'sec_sig').to_s != sig
            if regen_this
              reg = Render.module!(g, builts[id], extras[id] || {})
              @registries[g.definition.entityID] = reg
              Store.tag_module(g, builts[id]['params'])
              g.set_attribute(Store::DICT, 'sec_sig', sig)
            end
            r = nrec[id]
            want = U.place_tf(r['pos'], r['rot'])
            unless same_tf?(g.transformation, want)
              g.transformation = want
            end
            g.set_attribute(Store::DICT, 'tf', g.transformation.to_a)
            g.set_attribute(Store::DICT, 'rot', r['rot'])
          end
          if asm
            data['gaps'] = res['gaps']
            Store.set_asm_data(asm, data)
            asm.set_attribute(Store::DICT, 'tf', asm.transformation.to_a)
          end
          Observers.attach_tree(asm || single) if defined?(Observers)
          { 'builts' => builts, 'warnings' => warnings + sec_notes, 'gaps' => res['gaps'], 'by_id' => by_id }
        end

        def same_tf?(a, b)
          a.to_a.zip(b.to_a).all? { |x, y| (x - y).abs < 1e-7 }
        end

        # Tiết diện đã đánh dấu: tính lại từ hình học stock hiện tại; cặp không còn giao → bỏ dấu và báo.
        def sections_for(data, builts, nrec, by_id)
          marked = data['sections']['marked']
          return [{}, []] if marked.empty?
          panels = builts.flat_map { |id, b| placed_panels(id, b, nrec[id]) }
          rows = C::Sections.scan(panels, 'receiver_override' => data['sections']['receiver_override'])
          extras = {}
          notes = []
          marked.keys.each do |key|
            row = rows.find { |r| r['key'] == key }
            if row.nil? || !%w[ok].include?(row['status'])
              marked.delete(key)
              notes << "Đã bỏ dấu tiết diện không còn hợp lệ (#{key})" unless row && row['status'] == 'covered'
              next
            end
            mid, lid = row['receiver'].split('/', 2)
            ((extras[mid] ||= {})[lid] ||= []) << C::Sections.feature_from(row)
          end
          [extras, notes]
        end

        # ---------------------------------------------------------------- truy vấn tiện ích
        def asm_of(mod) (pg = Store.parent_group(mod)) && Store.assembly?(pg) ? pg : nil end

        def module_by_id(asm, id)
          Store.modules_in(asm).find { |g| Store.id(g) == id }
        end

        def update_module_params(mod, name, transparent: false)
          operation(name, transparent: transparent) do
            p = Store.params(mod)
            np = yield(C::Util.deep_copy(p))
            asm = asm_of(mod)
            update!(asm, single: asm ? nil : mod, edits: { p['id'] => np })
          end
        end

        # Đặt module mới (từ công cụ đặt). place: {'asm'=>group|nil,'pos','rot','origin_tf'=>Transformation,'link'=>{...}}
        def place_new(tpl, settings, place)
          operation("Đặt #{tpl['name']}") do |model|
            asm = place['asm']
            unless asm
              asm = model.active_entities.add_group
              Store.tag_assembly(asm, C::Util.new_id('asm'))
              asm.transformation = place['origin_tf']
              Store.set_asm_data(asm, { 'links' => [], 'sections' => { 'marked' => {}, 'receiver_override' => {} } })
            end
            p = C::Params.build(tpl, settings, C::Util.new_id('mod'))
            (place['dims'] || {}).each { |k, v| p[k] = v.to_f }
            p['upper_gap'] = place['gap'] if place['gap']
            g = Store.entities_of(asm).add_group
            g.transformation = U.place_tf(place['pos'], place['rot'])
            Store.tag_module(g, p)
            if place['link']
              d = Store.asm_data(asm)
              d['links'] << place['link'].merge('id' => C::Util.new_id('lnk'), 'upper' => place['link']['upper'] || p['id'],
                                                 'lower' => place['link']['lower'] || p['id'])
              Store.set_asm_data(asm, d)
            end
            update!(asm, edits: { p['id'] => p }, regen: [p['id']])
            model.selection.clear
            model.selection.add(asm)
            g
          end
        end
      end
    end
  end
end
