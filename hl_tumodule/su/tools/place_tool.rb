# encoding: UTF-8
# Đặt module từ thư viện: rê xem trước (không ghi geometry khi rê) → click đặt → KẾT THÚC lệnh.
# Điểm bám cố định định sẵn theo template; Tab hoặc ←/→ xoay từng bước 90° quanh trục đứng qua điểm bám.
module HungLoan
  module TuModule
    module SU
      class PlaceTool
        C = Core
        U = Units

        def initialize(tpl, settings)
          @tpl = tpl
          @settings = settings
          @rot = 0
          @gap = (settings['upper_gap'] || C::Config::KITCHEN_UPPER_GAP).to_f
          @ip = Sketchup::InputPoint.new
          @cache = {}
          @snap = nil
          @free_tf = nil
          @msg = nil
        end

        def activate
          update_status
          Sketchup.vcb_label = kitchen_upper? ? 'Khoảng hở (mm)' : ''
          Sketchup.vcb_value = kitchen_upper? ? @gap.round.to_s : ''
        end

        def deactivate(view) view.invalidate end
        def onCancel(_r, view) Sketchup.active_model.select_tool(nil); view.invalidate end
        def enableVCB?; kitchen_upper?; end

        def kitchen_upper?; @tpl['link_role'] == 'kitchen_upper'; end

        def update_status
          s = "Đặt #{@tpl['name']}: rê để xem trước, click để đặt. Tab hoặc ←/→: xoay 90°."
          s += ' Gõ khoảng hở tủ dưới → tủ trên rồi Enter.' if kitchen_upper?
          Sketchup.status_text = s
        end

        def onUserText(text, view)
          v = U.parse_mm(text)
          if v.nil? || v < 0
            UI.beep
            Sketchup.status_text = 'Khoảng hở không hợp lệ (nhập số mm ≥ 0).'
            return
          end
          @gap = v
          Sketchup.vcb_value = v.round.to_s
          view.invalidate
        end

        def onKeyDown(key, _rep, _flags, view)
          if key == 9 || key == VK_RIGHT
            @rot = (@rot + 90) % 360
          elsif key == VK_LEFT
            @rot = (@rot + 270) % 360
          else
            return false
          end
          recompute(view)
          view.invalidate
          true
        end

        # Dữ liệu xem trước theo kích thước (cache theo dims, không quét scene mỗi lần rê).
        def preview_for(dims)
          key = dims.to_a.sort.inspect
          @cache[key] ||= begin
            p = C::Params.build(@tpl, @settings, 'preview')
            dims.each { |k, v| p[k] = v }
            b = C::Builder.build(p)
            { 'params' => p, 'lines' => Pick.panel_lines(b['panels']), 'errors' => b['errors'].select { |e| e['level'] == 'error' },
              'anchor' => anchor_local(p) }
          end
        end

        def anchor_local(p)
          a = @tpl['anchor']
          d = p['l'] ? p['l']['lb'].to_f : p['d'].to_f
          [a['fx'] * p['w'].to_f, a['fy'] * d, a['fz'] * p['h'].to_f]
        end

        def onMouseMove(_flags, x, y, view)
          @x = x; @y = y
          @ip.pick(view, x, y)
          recompute(view)
          view.invalidate
        end

        def recompute(view)
          return unless @x
          @snap = find_snap(view, @x, @y)
          dims = @snap ? @snap['dims'] : {}
          @pv = preview_for(dims)
          if @snap
            @tf = @snap['target_tf'] * U.place_tf(@snap['offset'], @snap['rot_rel'])
          else
            pos = @ip.position
            a = @pv['anchor']
            @tf = Geom::Transformation.new(pos) * Geom::Transformation.rotation(ORIGIN, Z_AXIS, @rot.degrees) *
                  Geom::Transformation.new(U.pt(a.map(&:-@)))
          end
        end

        def find_snap(view, x, y)
          hit = Pick.module_at(view, x, y)
          return nil unless hit
          tp = Store.params(hit['mod'])
          return nil unless tp && tp['geometry'] == 'carcass'
          role = @tpl['link_role']
          base = C::Params.build(@tpl, @settings, 'x')
          case role
          when 'stack_upper'
            return nil unless %w[stack_lower base stack_upper].include?(tp['link_role'])
            { 'target' => hit['mod'], 'target_tf' => hit['tf'], 'offset' => [0.0, 0.0, tp['h'].to_f], 'rot_rel' => 0,
              'dims' => { 'w' => tp['w'].to_f, 'd' => tp['d'].to_f },
              'link' => { 'type' => 'stack', 'lower' => tp['id'] }, 'label' => 'Bắt nóc: cục trên khớp rộng & sâu cục dưới' }
          when 'kitchen_upper'
            return nil unless tp['link_role'] == 'kitchen_lower'
            d = base['d'].to_f
            { 'target' => hit['mod'], 'target_tf' => hit['tf'], 'offset' => [0.0, tp['d'].to_f - d, tp['h'].to_f + @gap], 'rot_rel' => 0,
              'dims' => { 'w' => tp['w'].to_f }, 'gap' => @gap,
              'link' => { 'type' => 'kitchen', 'lower' => tp['id'] },
              'label' => format('Tủ bếp trên: căn thẳng mặt sau, hở %.0f mm (gõ số + Enter để đổi)', @gap) }
          when 'side'
            ray = Pick.local_ray(view, x, y, hit['tf'])
            pt = Pick.hit_plane(ray, 1, 0.0) || ray[0]
            left = pt[0] < tp['w'].to_f / 2.0
            local = @ip.position.transform(hit['tf'].inverse)
            ly = U.mm(local.y)
            front = ly < tp['d'].to_f / 2.0
            w = base['w'].to_f; d = base['d'].to_f
            { 'target' => hit['mod'], 'target_tf' => hit['tf'],
              'offset' => [left ? -w : tp['w'].to_f, front ? 0.0 : tp['d'].to_f - d, 0.0], 'rot_rel' => 0, 'dims' => {},
              'edge' => front ? 'front' : 'back',
              'label' => "Tủ hông bám #{left ? 'bên trái' : 'bên phải'}, #{front ? 'MÉP TRƯỚC' : 'MÉP SAU'} tủ chính" }
          end
        end

        def draw(view)
          return unless @pv && @tf
          color = @pv['errors'].any? ? Sketchup::Color.new(220, 40, 40) : Sketchup::Color.new(150, 90, 40)
          Pick.draw_lines(view, @pv['lines'], @tf, color, 1)
          ap = U.pt(@pv['anchor']).transform(@tf)
          view.draw_points([ap], 10, 2, Sketchup::Color.new(0, 120, 255)) if !@snap
          if @snap
            tp = Store.params(@snap['target'])
            if @snap['edge']
              y = @snap['edge'] == 'front' ? 0.0 : tp['d'].to_f
              Pick.draw_lines(view, [[[0.0, y, 0.0], [tp['w'].to_f, y, 0.0]], [[0.0, y, tp['h'].to_f], [tp['w'].to_f, y, tp['h'].to_f]]],
                              @snap['target_tf'], Sketchup::Color.new(0, 160, 60), 4)
            else
              Pick.draw_box(view, [0, tp['w'].to_f, 0, tp['d'].to_f, 0, tp['h'].to_f], @snap['target_tf'], Sketchup::Color.new(0, 160, 60), 3)
            end
          end
          msg = @snap ? @snap['label'] : "Điểm bám: #{@tpl['anchor']['label']} · xoay #{@rot}°"
          msg = "#{msg}\nLỗi: #{@pv['errors'].first['message']}" if @pv['errors'].any?
          Pick.text(view, @x || 0, @y || 0, msg)
          @ip.draw(view) if @ip.display? && !@snap
        end

        def onLButtonDown(_flags, x, y, view)
          onMouseMove(0, x, y, view)
          if @pv['errors'].any?
            UI.messagebox("Chưa đặt được: #{@pv['errors'].first['message']}")
            return
          end
          model = Sketchup.active_model
          place = if @snap
                    tgt = @snap['target']
                    asm = Manager.asm_of(tgt)
                    unless asm
                      UI.messagebox('Module đích không nằm trong bộ tủ do plugin tạo. Đặt tự do rồi ghép lại.')
                      return
                    end
                    rec = Manager.record(tgt, Store.params(tgt))
                    pos = C::Geom.place_point(rec['pos'], rec['rot'], @snap['offset'])
                    { 'asm' => asm, 'pos' => pos, 'rot' => rec['rot'], 'link' => @snap['link'], 'dims' => @snap['dims'], 'gap' => @snap['gap'] }
                  else
                    { 'asm' => nil, 'pos' => [0.0, 0.0, 0.0], 'rot' => 0, 'origin_tf' => model.edit_transform.inverse * @tf }
                  end
          g = Manager.place_new(@tpl, @settings, place)
          return unless g # lỗi: giữ công cụ để người dùng điều chỉnh
          model.select_tool(nil) # đặt thành công → kết thúc lệnh
        end

        def getExtents
          bb = Geom::BoundingBox.new
          if @pv && @tf
            @pv['lines'].each { |a, b| bb.add(U.pt(a).transform(@tf)); bb.add(U.pt(b).transform(@tf)) }
          end
          bb
        end
      end
    end
  end
end
