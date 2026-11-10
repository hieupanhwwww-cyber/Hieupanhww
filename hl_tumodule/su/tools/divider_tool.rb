# encoding: UTF-8
# Đặt VÁCH (axis 'x') hoặc ĐỢT (axis 'z') vào khoang dưới chuột.
#  - Tab: chuyển điểm bám mặt trái/tim/mặt phải (đợt: mặt dưới/tim/mặt trên).
#  - Mốc đo: mặt trong khoang phía gần chuột (trái/phải hoặc dưới/trên).
#  - Gõ số → Enter: đặt ngay đúng khoảng cách tới điểm bám. Khi đã gõ số, mốc + khoang bị KHÓA,
#    chuột không ghi đè số đang gõ. Esc: hủy số đang gõ (lần 2 thoát lệnh).
module HungLoan
  module TuModule
    module SU
      class DividerTool
        C = Core
        U = Units
        ANCH = { 'x' => [%w[near Mặt\ trái], %w[center Tim], %w[far Mặt\ phải]],
                 'z' => [%w[near Mặt\ dưới], %w[center Tim], %w[far Mặt\ trên]] }.freeze

        def initialize(axis)
          @axis = axis
          @anchor = 1 # tim
          @lock = nil
          @hover = nil
        end

        def name; @axis == 'x' ? 'vách' : 'đợt'; end

        def activate
          Sketchup.vcb_label = 'Khoảng cách (mm)'
          status
        end

        def status
          Sketchup.status_text = "Đặt #{name}: trỏ vào khoang, click đặt tự do, hoặc gõ khoảng cách rồi Enter. " \
                                 "Tab: đổi điểm bám (đang: #{ANCH[@axis][@anchor][1]}). Esc: hủy số đang gõ."
        end

        def deactivate(view) view.invalidate end
        def enableVCB?; true; end

        def onCancel(_reason, view)
          if @lock
            @lock = nil
            Sketchup.status_text = 'Đã hủy số đang gõ.'
          else
            Sketchup.active_model.select_tool(nil)
          end
          view.invalidate
        end

        def onKeyDown(key, _rep, _flags, view)
          if key == 9
            @anchor = (@anchor + 1) % 3
            status
            view.invalidate
            return true
          end
          # Bắt đầu gõ số → khóa mốc và khoang hiện tại.
          @lock ||= @hover.dup if @hover && Pick::DIGIT_KEYS.include?(key)
          false
        end

        def onMouseMove(_f, x, y, view)
          @x = x; @y = y
          return view.invalidate if @lock
          @hover = hover_at(view, x, y)
          if @hover
            Sketchup.vcb_value = @hover['dist'].round(1).to_s
          end
          view.invalidate
        end

        def hover_at(view, x, y)
          hit = Pick.module_at(view, x, y)
          return nil unless hit
          p = Store.params(hit['mod'])
          return nil unless p && p['geometry'] == 'carcass'
          built = Manager.build(p)
          ray = Pick.local_ray(view, x, y, hit['tf'])
          pt = Pick.hit_plane(ray, 1, 0.0)
          return nil unless pt
          cell = built['cells'].find { |c| pt[0] >= c['x0'] && pt[0] <= c['x1'] && pt[2] >= c['z0'] && pt[2] <= c['z1'] }
          return nil unless cell
          k = @axis == 'x' ? 0 : 2
          a, b = @axis == 'x' ? [cell['x0'], cell['x1']] : [cell['z0'], cell['z1']]
          v = pt[k]
          ref = (v - a) <= (b - v) ? 'start' : 'end'
          { 'mod' => hit['mod'], 'tf' => hit['tf'], 'cell' => cell, 'ref' => ref, 'a' => a, 'b' => b,
            'dist' => ref == 'start' ? v - a : b - v, 't' => p['t'].to_f, 'info' => built['info'] }
        end

        # Tim tấm từ khoảng cách mốc → điểm bám.
        def center_for(h, dist)
          t = h['t']
          ap = h['ref'] == 'start' ? h['a'] + dist : h['b'] - dist
          case ANCH[@axis][@anchor][0]
          when 'near' then ap + t / 2.0 # điểm bám là mặt trái/dưới của tấm
          when 'far' then ap - t / 2.0  # điểm bám là mặt phải/trên của tấm
          else ap
          end
        end

        def onUserText(text, view)
          h = @lock || @hover
          d = U.parse_mm(text)
          if h.nil? || d.nil? || d < 0
            UI.beep
            Sketchup.status_text = 'Trỏ vào một khoang và nhập khoảng cách mm hợp lệ.'
            return
          end
          place(h, d)
          @lock = nil
          view.invalidate
        end

        def onLButtonDown(_f, x, y, view)
          h = @lock || hover_at(view, x, y)
          return unless h
          place(h, h['dist'])
          @lock = nil
          view.invalidate
        end

        def place(h, dist)
          c = center_for(h, dist)
          if c - h['t'] / 2.0 < h['a'] - 0.01 || c + h['t'] / 2.0 > h['b'] + 0.01
            Safe.msgbox(format('Khoảng cách %.1f mm làm %s vượt khoang (lọt lòng %.1f mm).', dist, name, h['b'] - h['a']))
            return
          end
          Actions.insert_divider(h['mod'], h['cell']['id'], @axis, c)
          @hover = nil
        end

        def draw(view)
          h = @lock || @hover
          return unless h
          c = h['cell']; i = h['info']
          dist = h['dist']
          ctr = center_for(h, dist)
          t = h['t']
          box = if @axis == 'x'
                  [ctr - t / 2, ctr + t / 2, i['inner_front'], i['y_back_inner'], c['z0'], c['z1']]
                else
                  [c['x0'], c['x1'], i['inner_front'], i['y_back_inner'], ctr - t / 2, ctr + t / 2]
                end
          ok = box[@axis == 'x' ? 0 : 4] >= h['a'] - 0.01 && box[@axis == 'x' ? 1 : 5] <= h['b'] + 0.01
          Pick.draw_box(view, box, h['tf'], ok ? Sketchup::Color.new(200, 110, 30) : Sketchup::Color.new(220, 30, 30), 2)
          refv = h['ref'] == 'start' ? h['a'] : h['b']
          ref_line = @axis == 'x' ? [[refv, 0.0, c['z0']], [refv, 0.0, c['z1']]] : [[c['x0'], 0.0, refv], [c['x1'], 0.0, refv]]
          Pick.draw_lines(view, [ref_line], h['tf'], Sketchup::Color.new(0, 140, 255), 4)
          side = @axis == 'x' ? (h['ref'] == 'start' ? 'mặt trong TRÁI' : 'mặt trong PHẢI') : (h['ref'] == 'start' ? 'mặt trong DƯỚI' : 'mặt trong TRÊN')
          msg = format('Mốc: %s · Bám: %s · %.1f mm%s', side, ANCH[@axis][@anchor][1], dist, @lock ? ' (đang nhập — đã khóa mốc)' : '')
          Pick.text(view, @x || 0, @y || 0, msg)
        end
      end
    end
  end
end
