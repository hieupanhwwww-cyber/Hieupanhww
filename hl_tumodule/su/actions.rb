# encoding: UTF-8
# Thao tác người dùng trên module/bộ tủ và phản ứng với Move/Scale/Delete native.
module HungLoan
  module TuModule
    module SU
      module Actions
        C = Core
        U = Units
        M = Manager
        module_function

        def model; Sketchup.active_model; end

        # ---- Chọn đối tượng plugin trong selection
        def selected_modules
          out = []
          model.selection.each do |e|
            if Store.module?(e) then out << e
            elsif Store.assembly?(e) then out.concat(Store.modules_in(e))
            elsif Store.panel?(e) && (pg = Store.parent_group(e)) && Store.module?(pg) then out << pg
            end
          end
          out.uniq
        end

        def selected_assemblies
          selected_modules.map { |m| M.asm_of(m) }.compact.uniq
        end

        # ---- Vách / đợt
        def insert_divider(mod, cell_id, axis, center)
          label = axis == 'x' ? 'Thêm vách' : 'Thêm đợt'
          M.update_module_params(mod, label) do |p|
            built = M.build(p)
            t = p['t'].to_f
            p['interior'] = C::Interior.insert_divider(p['interior'], built['nodes'], cell_id, axis, center, t, C::Util.new_id(axis == 'x' ? 'vach' : 'dot'))
            chk = M.build(p)
            bad = chk['errors'].select { |e| e['level'] == 'error' }
            raise OpError, "Không đặt được: #{bad.first['message']}" if bad.any?
            p
          end
        end

        def copy_divider(mod, div_id, count, clear, direction)
          M.update_module_params(mod, 'Sao chép vách/đợt') do |p|
            built = M.build(p)
            tree, = C::Interior.copy_divider(p['interior'], built['nodes'], div_id, count, clear, direction)
            p['interior'] = tree
            p
          end
        end

        def set_divider_distance(p, div_id, dist, ref)
          built = M.build(p)
          dv = built['dividers'].find { |d| d['id'] == div_id } or raise OpError, 'Không tìm thấy tấm chia'
          node = built['nodes'][dv['node']]
          a, b = dv['axis'] == 'x' ? [node['x0'], node['x1']] : [node['z0'], node['z1']]
          # Khoảng cách tới mặt gần của tấm, đo từ mặt trong khoang trái/dưới (hoặc phải/trên).
          center = ref == 'end' ? b - dist - dv['t'] / 2.0 : a + dist + dv['t'] / 2.0
          p['interior'] = C::Interior.move_divider(p['interior'], built['nodes'], div_id, center)
          p
        end

        # ---- Thùng ngăn kéo
        def add_drawers(mod, cell_id, list, box_tpl)
          M.update_module_params(mod, list.size > 1 ? 'Tạo cụm thùng ngăn kéo' : 'Đặt thùng ngăn kéo') do |p|
            list.each do |bottom|
              p['drawers'] << {
                'id' => C::Util.new_id('dr'), 'template_id' => 'hl.thung_ngan_keo.v1', 'cell' => cell_id,
                'bottom' => bottom, 'height' => box_tpl['height'].to_f, 'rail_length' => box_tpl['rail_length'].to_f,
                'rail_type' => 'ball_side', 'clearance' => C::Config::RAIL_SIDE_CLEARANCE,
                'side_t' => box_tpl['side_t'].to_f, 'bottom_t' => box_tpl['bottom_t'].to_f,
                'mode' => list.size > 1 ? 'cluster' : 'single'
              }
            end
            p
          end
        end

        # ---- Mặt trước
        def create_fronts
          mods = selected_modules
          return UI.messagebox('Chọn bộ tủ hoặc module do plugin tạo rồi bấm "Tạo mặt trước".') if mods.empty?
          M.operation('Tạo mặt trước') do
            mods.group_by { |m| M.asm_of(m) }.each do |asm, list|
              edits = {}
              list.each do |m|
                p = Store.params(m)
                next if p['front']['type'] == 'open'
                p['front']['enabled'] = true
                edits[p['id']] = p
              end
              M.update!(asm, single: asm ? nil : list.first, edits: edits) if edits.any?
            end
          end
        end

        # ---- Bản lề tự động
        def auto_hinges
          mods = selected_modules
          return UI.messagebox('Chọn module có cánh.') if mods.empty?
          M.operation('Đánh dấu bản lề tự động') do
            mods.group_by { |m| M.asm_of(m) }.each do |asm, list|
              edits = {}
              list.each do |m|
                p = Store.params(m)
                next unless p['front']['enabled'] && p['front']['type'] == 'doors'
                p['hinges']['enabled'] = true
                edits[p['id']] = p
              end
              raise OpError, 'Module chưa có cánh. Bấm "Tạo mặt trước" trước.' if edits.empty?
              M.update!(asm, single: asm ? nil : list.first, edits: edits)
            end
          end
        end

        # ---- Cam: áp dụng overrides từ công cụ xem trước
        def apply_joints(mod_overrides)
          M.operation('Liên kết Cam Minifix') do
            mod_overrides.group_by { |m, _| M.asm_of(m) }.each do |asm, list|
              edits = {}
              list.each do |m, ov|
                p = Store.params(m)
                p['joints']['enabled'] = true
                p['joints']['overrides'] = ov
                edits[p['id']] = p
              end
              M.update!(asm, single: asm ? nil : list.first[0], edits: edits)
            end
          end
        end

        def remove_joints
          mods = selected_modules
          M.operation('Xóa liên kết cam') do
            mods.group_by { |m| M.asm_of(m) }.each do |asm, list|
              edits = list.map { |m| p = Store.params(m); p['joints']['enabled'] = false; [p['id'], p] }.to_h
              M.update!(asm, single: asm ? nil : list.first, edits: edits)
            end
          end
        end

        # ---- Tiết diện: đánh dấu hàng loạt
        def scan_sections(asm, module_ids = nil)
          mods = Store.modules_in(asm)
          data = Store.asm_data(asm)
          panels = []
          mods.each do |g|
            p = Store.params(g)
            next if module_ids && !module_ids.include?(p['id'])
            panels.concat(M.placed_panels(p['id'], M.build(p), M.record(g, p)))
          end
          rows = C::Sections.scan(panels, 'receiver_override' => data['sections']['receiver_override'])
          [rows, panels]
        end

        def mark_sections(asm, keys, overrides)
          M.operation('Đánh dấu tiết diện giao nhau') do
            d = Store.asm_data(asm)
            d['sections']['receiver_override'].merge!(overrides)
            keys.each { |k| d['sections']['marked'][k] = { 'at' => Time.now.to_i } }
            Store.set_asm_data(asm, d)
            M.update!(asm)
          end
        end

        def clear_sections(asm)
          M.operation('Xóa dấu tiết diện') do
            d = Store.asm_data(asm)
            d['sections']['marked'] = {}
            Store.set_asm_data(asm, d)
            M.update!(asm)
          end
        end

        # ---- Chế độ chọn
        def path_to(e)
          chain = []
          cur = Store.parent_group(e)
          while cur
            chain.unshift(cur)
            cur = Store.parent_group(cur)
          end
          chain
        end

        def select_whole_set
          Prefs.set_work('select_mode', 'set')
          asms = selected_assemblies
          asms = [model.active_path.to_a.reverse.find { |e| Store.assembly?(e) }].compact if asms.empty? && model.active_path
          model.active_path = nil if model.respond_to?(:active_path=) && model.active_path
          return if asms.empty?
          model.selection.clear
          asms.each { |a| model.selection.add(a) }
        end

        def select_single_modules
          Prefs.set_work('select_mode', 'module')
          asm = model.selection.find { |e| Store.assembly?(e) } || selected_assemblies.first
          return UI.messagebox('Chọn một bộ tủ trước.') unless asm
          unless model.respond_to?(:active_path=)
            return UI.messagebox('Phiên bản SketchUp này không hỗ trợ mở nhóm bằng Ruby. Bấm đúp vào bộ tủ để chọn từng module.')
          end
          model.active_path = path_to(asm) + [asm]
          model.selection.clear
        end

        # ================================================================ SỰ KIỆN NATIVE
        def stored_tf(g)
          a = g.get_attribute(Store::DICT, 'tf')
          a.is_a?(Array) && a.size == 16 ? Geom::Transformation.new(a) : nil
        end

        def on_module_transformed(g)
          old = stored_tf(g)
          return unless old
          return if M.same_tf?(old, g.transformation)
          p = Store.params(g) or return
          asm = M.asm_of(g)
          rot_old = (g.get_attribute(Store::DICT, 'rot') || U.rot_of(old)).to_i
          a = U.axes_scale(g.transformation)
          ox = C::Geom.rot_z([1, 0, 0], rot_old); oy = C::Geom.rot_z([0, 1, 0], rot_old)
          sx = C::Geom.dot(a['x'], ox); sy = C::Geom.dot(a['y'], oy); sz = a['z'][2]
          if [sx, sy, sz].any? { |s| (s - 1.0).abs > 1e-6 }
            if [sx, sy, sz].any? { |s| s <= 0 }
              M.operation('Hoàn lại lật module', transparent: true) { g.transformation = old }
              UI.messagebox('Không hỗ trợ lật (scale âm) module. Đã giữ nguyên.')
              return
            end
            np = C::Util.deep_copy(p)
            if np['l']
              np['l']['la'] = np['l']['la'].to_f * sx; np['l']['lb'] = np['l']['lb'].to_f * sy; np['w'] = np['l']['la']
            else
              np['w'] = p['w'].to_f * sx; np['d'] = p['d'].to_f * sy
            end
            np['h'] = p['h'].to_f * sz
            pos = a['origin']
            ok = M.operation('Đổi kích thước module', transparent: true) do
              M.update!(asm, single: asm ? nil : g, edits: { p['id'] => np }, moves: { p['id'] => { 'pos' => pos, 'rot' => rot_old } })
            end
            revert(g, old) unless ok
          else
            pos = a['origin']; rot = U.rot_of(g.transformation)
            oldpos = U.axes_scale(old)['origin']
            delta = C::Geom.sub(pos, oldpos)
            M.operation('Di chuyển module', transparent: true) do
              moves = { p['id'] => { 'pos' => pos, 'rot' => rot } }
              if asm
                recs = Store.modules_in(asm).map { |m| q = Store.params(m); [q['id'], M.record(m, q)] }.to_h
                recs[p['id']]['pos'] = oldpos
                mods, moved = C::Solver.drag(recs, Store.asm_data(asm)['links'], p['id'], delta)
                moved.each { |id| moves[id] = { 'pos' => mods[id]['pos'], 'rot' => mods[id]['rot'] } }
              end
              M.update!(asm, single: asm ? nil : g, moves: moves)
            end
          end
        end

        # Cập nhật bị từ chối (abort): trả transformation về trạng thái hợp lệ trước đó.
        def revert(g, old)
          return unless g.valid?
          M.operation('Giữ trạng thái hợp lệ', transparent: true) { g.transformation = old }
        end

        def on_assembly_transformed(asm)
          old = stored_tf(asm)
          return unless old
          return if M.same_tf?(old, asm.transformation)
          a = U.axes_scale(asm.transformation)
          ob = U.axes_scale(old)
          sx = a['sx'] / ob['sx']; sy = a['sy'] / ob['sy']; sz = a['sz'] / ob['sz']
          if [sx, sy, sz].all? { |s| (s - 1.0).abs < 1e-6 }
            asm.set_attribute(Store::DICT, 'tf', asm.transformation.to_a) unless M.busy?
            return
          end
          det = asm.transformation.to_a.then { |m| m[0] * (m[5] * m[10] - m[6] * m[9]) - m[4] * (m[1] * m[10] - m[2] * m[9]) + m[8] * (m[1] * m[6] - m[2] * m[5]) }
          if det <= 0
            M.operation('Hoàn lại lật bộ tủ', transparent: true) { asm.transformation = old }
            UI.messagebox('Không hỗ trợ lật (scale âm) bộ tủ. Đã giữ nguyên.')
            return
          end
          rot = U.rot_of(asm.transformation)
          ok = M.operation('Scale bộ tủ', transparent: true) do
            asm.transformation = Geom::Transformation.new(U.pt(a['origin'])) * Geom::Transformation.rotation(ORIGIN, Z_AXIS, rot.degrees)
            M.update!(asm, scale: [sx, sy, sz])
          end
          revert(asm, old) unless ok
        end

        def on_panel_transformed(g)
          old = stored_tf(g)
          return unless old
          return if M.same_tf?(old, g.transformation)
          mod = Store.parent_group(g)
          return unless mod && Store.module?(mod)
          p = Store.params(mod)
          lid = g.get_attribute(Store::DICT, 'local_id')
          built = M.build(p)
          dv = built['dividers'].find { |d| d['id'] == lid }
          if dv && U.axes_scale(g.transformation).values_at('sx', 'sy', 'sz').all? { |s| (s - 1).abs < 1e-6 }
            k = dv['axis'] == 'x' ? 0 : 2
            delta = U.axes_scale(g.transformation)['origin'][k] - U.axes_scale(old)['origin'][k]
            ok = M.update_module_params(mod, 'Di chuyển vách/đợt', transparent: true) do |q|
              q['interior'] = C::Interior.move_divider(q['interior'], built['nodes'], lid, dv['center'] + delta)
              chk = M.build(q)
              bad = chk['errors'].find { |e| e['level'] == 'error' }
              raise OpError, "Vị trí mới không hợp lệ: #{bad['message']}" if bad
              q
            end
            restore_panel(mod) unless ok
          else
            # Tấm khác: hình học do tham số quyết định → dựng lại từ dữ liệu.
            restore_panel(mod)
          end
        end

        def restore_panel(mod)
          M.update_module_params(mod, 'Khôi phục tấm theo tham số', transparent: true) { |q| q }
        end

        # Tấm bị xóa bằng Delete native: vách/đợt → gộp khoang; thùng → xóa thùng; tấm khác → ghi nhận
        # đã xóa (không tự hồi sinh ở lần Apply sau).
        def on_panels_removed(mod, local_ids)
          return unless mod.valid?
          M.update_module_params(mod, 'Xóa tấm', transparent: true) do |p|
            local_ids.each do |lid|
              if C::Interior.divider_owner(p['interior'], lid)
                p['interior'], = C::Interior.remove_divider(p['interior'], lid)
              elsif (dr = p['drawers'].find { |d| lid.start_with?("#{d['id']}:") })
                p['drawers'].delete(dr)
              else
                p['suppressed'] |= [lid]
              end
            end
            p
          end
        end

        def on_modules_removed(asm, ids)
          return unless asm.valid?
          M.operation('Gỡ liên kết module đã xóa', transparent: true) do
            M.update!(asm, drop_links_for: ids)
          end
        end
      end
    end
  end
end
