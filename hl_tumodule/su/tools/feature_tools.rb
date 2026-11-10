# encoding: UTF-8
# Công cụ gia công: bản lề thủ công, xem trước/áp liên kết cam, quét tiết diện hàng loạt.
module HungLoan
  module TuModule
    module SU
      # ---------------------------------------------------------------- BẢN LỀ THỦ CÔNG
      # Click lên cánh: thêm lỗ cốc (tự dịch tới vị trí hợp lệ gần nhất nếu vướng đợt).
      # Click gần lỗ thủ công đã có (≤ 30 mm): bỏ lỗ đó.
      class HingeTool
        C = Core
        U = Units

        def activate
          Sketchup.status_text = 'Bản lề thủ công: click lên CÁNH để thêm lỗ cốc; click gần lỗ đã có để bỏ. Esc: thoát.'
        end

        def deactivate(view) view.invalidate end
        def onCancel(_r, _v) Sketchup.active_model.select_tool(nil) end

        def onMouseMove(_f, x, y, view)
          @x = x; @y = y
          @h = hover(view, x, y)
          view.invalidate
        end

        def hover(view, x, y)
          hit = Pick.module_at(view, x, y)
          return nil unless hit && hit['panel'] && hit['panel'].get_attribute(Store::DICT, 'role') == 'door'
          p = Store.params(hit['mod'])
          built = Manager.build(p)
          lid = hit['panel'].get_attribute(Store::DICT, 'local_id')
          door = built['doors'].find { |d| d['local_id'] == lid } or return nil
          hp = Prefs.hinge_preset(p['hinges']['preset'])
          ray = Pick.local_ray(view, x, y, hit['panel_tf'])
          pt = Pick.hit_plane(ray, 2, 0.0) || Pick.hit_plane(ray, 2, door['t'])
          return nil unless pt
          forb = C::Builder.forbidden_for(door, built['panels'].select { |q| q['role'] == 'shelf' }, hp)
          lo = hp['diameter'] / 2.0 + 5.0
          v = C::Hinges.nearest_valid(pt[1], forb, lo, door['h'] - lo)
          data = (p['hinges']['doors'] || {})[lid] || {}
          side = data['side'] || C::Hinges.default_side_for(built['doors'], built['doors'].index(door))
          u = side == 'left' ? hp['edge_offset'] : door['w'] - hp['edge_offset']
          { 'mod' => hit['mod'], 'tf' => hit['panel_tf'], 'door' => door, 'lid' => lid, 'v' => v, 'raw' => pt[1],
            'u' => u, 'hp' => hp, 'params' => p, 'existing' => door['features'].select { |f| f['op'] == 'hinge_cup' } }
        end

        def draw(view)
          return unless @h
          hp = @h['hp']
          col = @h['v'] ? Sketchup::Color.new(0, 150, 60) : Sketchup::Color.new(220, 30, 30)
          if @h['v']
            c = U.pt([@h['u'], @h['v'], -0.5]).transform(@h['tf'])
            n = Geom::Vector3d.new(0, 0, 1).transform(@h['tf'])
            pts = (0..24).map { |i| a = i * Math::PI / 12; U.pt([@h['u'] + hp['diameter'] / 2 * Math.cos(a), @h['v'] + hp['diameter'] / 2 * Math.sin(a), -0.5]).transform(@h['tf']) }
            view.drawing_color = col
            view.line_width = 2
            view.draw(GL_LINE_STRIP, pts)
            n && c
          end
          shifted = @h['v'] && (@h['v'] - @h['raw']).abs > 0.5
          msg = if @h['v'].nil? then 'Không có vị trí hợp lệ (vướng đợt/ngoài cánh)'
                else format('Lỗ cốc Ø%.0f tại %.0f mm từ đáy cánh%s', hp['diameter'], @h['v'], shifted ? ' (đã dịch tránh đợt)' : '')
                end
          Pick.text(view, @x, @y, msg)
        end

        def onLButtonDown(_f, x, y, view)
          h = hover(view, x, y)
          return unless h
          near = h['existing'].find { |f| (f['pos'][1] - h['raw']).abs <= 30 }
          lid = h['lid']; door = h['door']
          if near.nil? && h['v'].nil?
            Safe.msgbox('Không còn vị trí hợp lệ trên cánh tại đây (vướng đợt hoặc quá sát mép).')
            return
          end
          Manager.update_module_params(h['mod'], 'Bản lề thủ công') do |p|
            p['hinges']['enabled'] = true
            p['hinges']['doors'] ||= {}
            d = p['hinges']['doors'][lid] ||= { 'side' => C::Hinges.default_side_for([door], 0), 'mode' => 'auto', 'manual' => [], 'on_resize' => 'keep_edge' }
            if d['mode'] != 'manual'
              d['manual'] = h['existing'].map { |f| C::Hinges.manual_entry(f['pos'][1], door['h']) }
              d['mode'] = 'manual'
            end
            if near
              d['manual'].reject! { |e| ((e['anchor'] == 'top' ? door['h'] - e['dist'] : e['dist']) - near['pos'][1]).abs < 0.6 }
            else
              d['manual'] << C::Hinges.manual_entry(h['v'], door['h'])
            end
            p
          end
          view.invalidate
        end
      end

      # ---------------------------------------------------------------- XEM TRƯỚC CAM
      # Hiện vị trí cam (đỏ: cốc cam trên tấm mang cam; xanh: chốt trên tấm kia).
      # Click gần một liên kết: đổi mặt đặt cam. Phím Delete/Backspace: bật/tắt xóa liên kết đang trỏ.
      # Enter: áp dụng. Esc: hủy.
      class CamTool
        C = Core
        U = Units

        def initialize(mods)
          @mods = mods
          @ov = {}
          mods.each { |m| @ov[m] = C::Util.deep_copy(Store.params(m)['joints']['overrides'] || {}) }
          recompute
        end

        def recompute
          @items = []
          @mods.each do |m|
            p = C::Util.deep_copy(Store.params(m))
            p['joints']['enabled'] = true
            p['joints']['overrides'] = @ov[m]
            b = Manager.build(p)
            tf = Pick.world_tf(Actions.path_to(m) + [m])
            b['joints'].each do |j|
              pts = []
              b['panels'].each do |pn|
                (j['features'][pn['id']] || []).each do |f|
                  pts << [C::Geom.f2w(pn['frame'], f['pos']), f['op'], f['diameter']]
                end
              end
              @items << { 'mod' => m, 'tf' => tf, 'joint' => j, 'pts' => pts,
                          'line' => line_pts(b, j) }
            end
          end
        end

        def line_pts(b, j)
          a = b['panels'].find { |q| q['id'] == j['a'] }
          return [] unless a
          bb = C::Geom.panel_aabb(a)
          k = j['axis']
          p0 = bb[0].dup; p1 = bb[1].dup
          p0[k] = p1[k] = j['sign'] > 0 ? bb[1][k] : bb[0][k]
          [p0, p1]
        end

        def activate
          n = @items.size
          Sketchup.status_text = "Liên kết Cam Minifix (preset DEMO): #{n} cạnh tiếp xúc hợp lệ. Click: đổi mặt cam · Delete: xóa/khôi phục · Enter: áp dụng · Esc: hủy."
          Safe.msgbox('Không tìm thấy cạnh tiếp xúc hợp lệ cạnh–mặt giữa các tấm thân tủ.') if n.zero?
        end

        def deactivate(view) view.invalidate end
        def onCancel(_r, _v) Sketchup.active_model.select_tool(nil) end

        def onMouseMove(_f, x, y, view)
          @x = x; @y = y
          @hot = nearest(view, x, y)
          view.invalidate
        end

        def nearest(view, x, y)
          best = nil; bd = 25
          @items.each do |it|
            it['pts'].each do |w, _, _|
              s = view.screen_coords(U.pt(w).transform(it['tf']))
              d = Math.hypot(s.x - x, s.y - y)
              (bd = d; best = it) if d < bd
            end
          end
          best
        end

        def draw(view)
          @items.each do |it|
            del = it['joint']['deleted']
            it['pts'].each do |w, op, _|
              col = if del then Sketchup::Color.new(150, 150, 150)
                    elsif op == 'cam_bolt' then Sketchup::Color.new(30, 90, 220)
                    elsif op == 'cam_housing' then Sketchup::Color.new(220, 40, 40)
                    else Sketchup::Color.new(240, 160, 0)
                    end
              view.draw_points([U.pt(w).transform(it['tf'])], it.equal?(@hot) ? 12 : 8, 2, col)
            end
            Pick.draw_lines(view, [it['line']], it['tf'], Sketchup::Color.new(0, 160, 60), it.equal?(@hot) ? 4 : 1) if it['line'].size == 2
          end
          return unless @hot
          j = @hot['joint']
          msg = format('%s → %s · dài %.0f mm · %d bộ · cam ở mặt %s%s%s', j['a'], j['b'], j['length'], j['positions'].size,
                       j['cam_face_sign'] > 0 ? '+' : '−', j['manual'] ? ' · vị trí chỉnh riêng' : '', j['deleted'] ? ' · ĐÃ XÓA' : '')
          msg += "\n#{j['issues'].first['message']}" if j['issues'].any?
          Pick.text(view, @x, @y, msg)
        end

        def onLButtonDown(_f, _x, _y, view)
          return unless @hot
          o = (@ov[@hot['mod']][@hot['joint']['id']] ||= {})
          o['flip'] = !o['flip']
          recompute; @hot = nil
          view.invalidate
        end

        def onKeyDown(key, _r, _f, view)
          return false unless @hot && [46, 8, 127].include?(key)
          o = (@ov[@hot['mod']][@hot['joint']['id']] ||= {})
          o['deleted'] = !o['deleted']
          recompute; @hot = nil
          view.invalidate
          true
        end

        def onReturn(_view)
          Actions.apply_joints(@ov)
          Sketchup.active_model.select_tool(nil)
        end
      end

      # ---------------------------------------------------------------- QUÉT TIẾT DIỆN
      # Xem trước vùng giao, tấm nhận (cam), mặt và độ sâu. Click vào vùng "chưa xác định tấm nhận"
      # (vàng) để chọn tấm nhận. Enter: đánh dấu hàng loạt các vùng hợp lệ. Esc: hủy.
      class SectionTool
        C = Core
        U = Units

        def initialize(asm, module_ids)
          @asm = asm; @ids = module_ids
          @over = {}
          @tf = Pick.world_tf(Actions.path_to(asm) + [asm])
          rescan
        end

        def rescan
          d = Store.asm_data(@asm)
          d['sections']['receiver_override'].merge!(@over)
          mods = Store.modules_in(@asm)
          panels = []
          mods.each do |g|
            p = Store.params(g)
            next if @ids && !@ids.include?(p['id'])
            panels.concat(Manager.placed_panels(p['id'], Manager.build(p), Manager.record(g, p)))
          end
          @panels = panels.map { |q| [q['id'], q] }.to_h
          @rows = C::Sections.scan(panels, 'receiver_override' => d['sections']['receiver_override'])
          @marked = d['sections']['marked'].keys
        end

        def counts
          @rows.group_by { |r| r['status'] }.map { |k, v| [k, v.size] }.to_h
        end

        def activate
          c = counts
          Sketchup.status_text = format('Tiết diện: %d vùng hợp lệ, %d đã có rãnh, %d chưa xác định tấm nhận, %d hộp bao chồng giả. Enter: đánh dấu · Esc: hủy.',
                                        c['ok'].to_i, c['covered'].to_i, c['unresolved'].to_i, c['not_real'].to_i)
        end

        def deactivate(view) view.invalidate end
        def onCancel(_r, _v) Sketchup.active_model.select_tool(nil) end

        def row_world_pts(r)
          pid = r['receiver'] || r['a']
          pn = @panels[pid]
          return [] unless pn
          if r['pieces']
            w = r['face'] == 'A' ? pn['t'] + 0.5 : -0.5
            r['pieces'].map { |poly| poly.map { |p| C::Geom.f2w(pn['frame'], [p[0], p[1], w]) } }
          else
            bb = C::Geom.panel_aabb(pn)
            [[bb[0], bb[1]]]
          end
        end

        def draw(view)
          @rows.each do |r|
            col = case r['status']
                  when 'ok' then @marked.include?(r['key']) ? Sketchup::Color.new(0, 150, 60) : Sketchup::Color.new(220, 40, 40)
                  when 'covered' then Sketchup::Color.new(120, 120, 120)
                  when 'unresolved' then Sketchup::Color.new(230, 170, 0)
                  else next
                  end
            row_world_pts(r).each do |poly|
              next if poly.size < 2
              pts = poly.map { |p| U.pt(p).transform(@tf) }
              view.drawing_color = col
              view.line_width = 3
              view.draw(GL_LINE_LOOP, pts)
            end
          end
          return unless @hot
          r = @hot
          msg = case r['status']
                when 'ok' then format('%s nhận dấu %s, mặt %s, sâu %.1f mm', r['receiver'], r['mark'] == 'cutout' ? 'khoét suốt' : 'tiết diện', r['face'], r['depth'])
                when 'unresolved' then "#{r['a']} ↔ #{r['b']}: #{r['message']} (click để chọn)"
                else r['message'].to_s
                end
          Pick.text(view, @x, @y, msg)
        end

        def onMouseMove(_f, x, y, view)
          @x = x; @y = y
          @hot = nil; bd = 30
          @rows.each do |r|
            next if r['status'] == 'not_real'
            row_world_pts(r).flatten(1).each do |p|
              s = view.screen_coords(U.pt(p).transform(@tf))
              d = Math.hypot(s.x - x, s.y - y)
              (bd = d; @hot = r) if d < bd
            end
          end
          view.invalidate
        end

        def onLButtonDown(_f, _x, _y, view)
          return unless @hot && %w[unresolved ok].include?(@hot['status'])
          k = @hot['key']
          cur = @over[k] || @hot['receiver']
          @over[k] = cur == @hot['a'] ? @hot['b'] : @hot['a']
          rescan
          view.invalidate
        end

        def onReturn(_view)
          keys = @rows.select { |r| r['status'] == 'ok' }.map { |r| r['key'] }
          unresolved = @rows.select { |r| r['status'] == 'unresolved' }
          if keys.empty?
            Safe.msgbox('Không có vùng tiết diện hợp lệ để đánh dấu.')
          else
            Actions.mark_sections(@asm, keys, @over)
            note = unresolved.any? ? "\n#{unresolved.size} vùng chưa xác định tấm nhận chưa được đánh dấu:\n" + unresolved.first(6).map { |r| "• #{r['a']} ↔ #{r['b']}" }.join("\n") : ''
            Safe.msgbox("Đã đánh dấu #{keys.size} vùng tiết diện.#{note}")
          end
          Sketchup.active_model.select_tool(nil)
        end
      end
    end
  end
end
