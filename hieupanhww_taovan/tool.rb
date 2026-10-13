# encoding: UTF-8
module HieuPanhww
  module TaoVan
    class VanTool
      def activate
        @hit = nil
        @flip = false
        update_status
        Sketchup.active_model.active_view.invalidate
        # Chế độ tạo ván nhanh: tạo ngay từ các mặt đang chọn.
        if Settings.get('tao_van_nhanh')
          model = Sketchup.active_model
          n = Board.quick_from_selection(model)
          Sketchup.status_text = "Đã tạo #{n} ván." if n > 0
        end
      end

      def deactivate(view)
        view.invalidate
      end

      def resume(view)
        update_status
        view.invalidate
      end

      def update_status
        Sketchup.status_text = 'Tạo Ván: bấm vào mặt để tạo ván. Tab = đảo hướng. Esc = thoát.'
      end

      def onSetCursor
        UI.set_cursor(632) # con trỏ chọn
      end

      def onMouseMove(flags, x, y, view)
        ph = view.pick_helper
        ph.do_pick(x, y)
        @hit = nil
        ph.count.times do |i|
          leaf = ph.leaf_at(i)
          next unless leaf.is_a?(Sketchup::Face)
          path = ph.path_at(i) || []
          # chỉ nhận mặt thuộc ngữ cảnh đang chỉnh sửa hoặc nằm trong group/component
          tr = ph.transformation_at(i)
          @hit = { face: leaf, tr: tr, parent: path.reverse.find { |e| e.respond_to?(:definition) } }
          break
        end
        view.invalidate
      end

      def onKeyDown(key, repeat, flags, view)
        if key == 9 # Tab
          @flip = !@flip
          view.invalidate
        end
      end

      def direction(view)
        n = (@hit[:tr] * @hit[:face].normal).normalize
        cam = view.camera.direction
        d = n.dot(cam) < 0 ? n.reverse : n # hướng "đi vào" từ phía camera
        d = d.reverse if Settings.get('dao_huong')
        d = d.reverse if @flip
        d
      end

      def thickness
        if Settings.get('do_day_tu_dong') && @hit && @hit[:parent]
          t = Board.container_thickness(@hit[:parent], @hit[:tr])
          return t if t
        end
        Settings.get('do_day').to_f.mm
      end

      def onLButtonDown(flags, x, y, view)
        onMouseMove(flags, x, y, view)
        return unless @hit
        t = thickness
        return if t <= 0
        model = view.model
        opts = Settings.all
        model.start_operation('Tạo ván', true)
        begin
          obj = Board.build(model, Board.world_loops(@hit[:face], @hit[:tr]), direction(view), t, opts)
          if obj
            model.commit_operation
          else
            model.abort_operation
          end
        rescue => e
          model.abort_operation
          UI.messagebox("Lỗi tạo ván: #{e.message}")
        end
        view.invalidate
      end

      def draw(view)
        return unless @hit
        loops = Board.world_loops(@hit[:face], @hit[:tr])
        view.line_width = 2
        view.drawing_color = Sketchup::Color.new(0, 120, 255)
        loops.each { |pts| view.draw_polyline(pts + [pts[0]]) }
        t = thickness
        off = direction(view).clone
        off.length = t
        view.drawing_color = Sketchup::Color.new(255, 140, 0)
        loops[0].each { |p| view.draw_line(p, p + off) }
        top = loops[0].map { |p| p + off }
        view.draw_polyline(top + [top[0]])
      end

      def getExtents
        bb = Geom::BoundingBox.new
        if @hit
          Board.world_loops(@hit[:face], @hit[:tr])[0].each { |p| bb.add(p) }
          bb.add(bb.min.offset(Z_AXIS, -1.m))
          bb.add(bb.max.offset(Z_AXIS, 1.m))
        end
        bb
      end
    end
  end
end
