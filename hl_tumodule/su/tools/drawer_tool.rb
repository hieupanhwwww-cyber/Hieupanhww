# encoding: UTF-8
# Thùng ngăn kéo ray bi gắn hai bên hông. Rộng ngoài = lọt lòng khoang − 2×13 mm; sâu ngoài = chiều dài ray đã chọn;
# cao theo mẫu. Hai chế độ: "single" (đặt từng thùng) và "cluster" (tạo cả cụm).
# Đặt từng thùng: Tab chuyển điểm neo ĐÁY NGOÀI → TIM CHIỀU CAO → ĐỈNH THÙNG; click hoặc gõ khoảng cách → Enter.
# Mốc đo chiều cao (giả định, xem ASSUMPTIONS.md): mặt trong đáy khoang.
module HungLoan
  module TuModule
    module SU
      class DrawerTool
        C = Core
        U = Units
        ANCH = [%w[bottom Đáy\ ngoài], %w[center Tim\ chiều\ cao], %w[top Đỉnh\ thùng]].freeze

        def initialize(box_settings, mode)
          @s = box_settings
          @mode = mode
          @anchor = 0
          @lock = nil
        end

        def box_tpl
          { 'height' => @s['box_height'].to_f, 'rail_length' => @s['rail_length'].to_f, 'side_t' => @s['box_side_t'].to_f,
            'bottom_t' => @s['box_bottom_t'].to_f, 'cluster_count' => @s['cluster_count'].to_i }
        end

        def activate
          Sketchup.vcb_label = @mode == 'single' ? 'Khoảng cách (mm)' : ''
          status
        end

        def status
          Sketchup.status_text = if @mode == 'single'
                                   "Đặt từng thùng (ray #{@s['rail_length'].to_i} mm, cao #{@s['box_height'].to_i} mm): " \
                                   "click hoặc gõ khoảng cách + Enter. Tab: neo #{ANCH[@anchor][1]}."
                                 else
                                   "Tạo cả cụm thùng (ray #{@s['rail_length'].to_i} mm): click vào khoang."
                                 end
        end

        def enableVCB?; @mode == 'single'; end
        def deactivate(view) view.invalidate end

        def onCancel(_r, view)
          if @lock then @lock = nil else Sketchup.active_model.select_tool(nil) end
          view.invalidate
        end

        def onKeyDown(key, _r, _f, view)
          if key == 9 && @mode == 'single'
            @anchor = (@anchor + 1) % 3
            status
            view.invalidate
            return true
          end
          @lock ||= @hover.dup if @hover && Pick::DIGIT_KEYS.include?(key)
          false
        end

        def onMouseMove(_f, x, y, view)
          @x = x; @y = y
          @hover = hover_at(view, x, y) unless @lock
          Sketchup.vcb_value = @hover['dist'].round(1).to_s if @hover && @mode == 'single' && !@lock
          view.invalidate
        end

        def hover_at(view, x, y)
          hit = Pick.module_at(view, x, y)
          return nil unless hit
          p = Store.params(hit['mod'])
          return nil unless p && p['geometry'] == 'carcass'
          built = Manager.build(p)
          pt = Pick.hit_plane(Pick.local_ray(view, x, y, hit['tf']), 1, 0.0)
          return nil unless pt
          cell = built['cells'].find { |c| pt[0] >= c['x0'] && pt[0] <= c['x1'] && pt[2] >= c['z0'] && pt[2] <= c['z1'] }
          return nil unless cell
          { 'mod' => hit['mod'], 'tf' => hit['tf'], 'cell' => cell, 'info' => built['info'], 'params' => p,
            'dist' => pt[2] - cell['z0'] }
        end

        def bottoms_for(h, dist)
          if @mode == 'single'
            [C::Builder.drawer_bottom_from_anchor(ANCH[@anchor][0], dist, box_tpl['height'])]
          else
            list, errs = C::Builder.cluster_layout(h['params'], h['cell'], h['info'], box_tpl)
            @cluster_errs = errs
            list
          end
        end

        def preview(h, dist)
          bt = box_tpl
          errs = []
          boxes = bottoms_for(h, dist).map do |b|
            dr = bt.merge('id' => 'preview', 'bottom' => b, 'clearance' => C::Config::RAIL_SIDE_CLEARANCE)
            _, e, box = C::Builder.drawer_box_panels(dr, h['cell'], h['info'])
            errs.concat(e)
            box
          end
          errs.concat(@cluster_errs || []) if @mode == 'cluster'
          [boxes, errs]
        end

        def draw(view)
          h = @lock || @hover
          return unless h
          boxes, errs = preview(h, h['dist'])
          col = errs.any? ? Sketchup::Color.new(220, 30, 30) : Sketchup::Color.new(30, 130, 200)
          boxes.each { |b| Pick.draw_box(view, [b['x0'], b['x1'], b['y0'], b['y1'], b['z0'], b['z1']], h['tf'], col, 2) }
          c = h['cell']
          Pick.draw_lines(view, [[[c['x0'], 0.0, c['z0']], [c['x1'], 0.0, c['z0']]]], h['tf'], Sketchup::Color.new(0, 140, 255), 4)
          b = boxes.first
          msg = b ? format('Rộng ngoài %.0f mm (lọt lòng %.0f − 26) · sâu %.0f mm theo ray', b['outer_w'], c['x1'] - c['x0'], b['depth']) : ''
          msg += format("\nNeo: %s · cách đáy khoang %.1f mm%s", ANCH[@anchor][1], h['dist'], @lock ? ' (đang nhập — đã khóa)' : '') if @mode == 'single'
          msg += "\n#{errs.first['message']}" if errs.any?
          Pick.text(view, @x || 0, @y || 0, msg)
        end

        def onUserText(text, view)
          h = @lock || @hover
          d = U.parse_mm(text)
          if h.nil? || d.nil?
            UI.beep
            return
          end
          commit(h, d)
          @lock = nil
          view.invalidate
        end

        def onLButtonDown(_f, x, y, view)
          h = @lock || hover_at(view, x, y)
          return unless h
          commit(h, h['dist'])
          @lock = nil
          view.invalidate
        end

        def commit(h, dist)
          _, errs = preview(h, dist)
          if errs.any?
            Safe.msgbox("Không đặt được thùng: #{errs.first['message']}")
            return
          end
          Actions.add_drawers(h['mod'], h['cell']['id'], bottoms_for(h, dist), box_tpl)
          @hover = nil
        end
      end
    end
  end
end
