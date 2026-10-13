# encoding: UTF-8
module HieuPanhww
  module TaoVan
    module Board
      ATTR = 'HieuPanhww_TaoVan'.freeze

      # Độ dày nhỏ nhất của group/component chứa mặt (độ dày "ván gốc"), đơn vị inch.
      def self.container_thickness(instance, tr)
        return nil unless instance.respond_to?(:definition)
        b = instance.definition.bounds
        return nil if b.empty?
        dims = [b.width * tr.xscale, b.height * tr.yscale, b.depth * tr.zscale]
        t = dims.select { |d| d > 0.001 }.min
        t
      end

      def self.next_name(model)
        n = model.get_attribute(ATTR, 'counter', 0).to_i + 1
        model.set_attribute(ATTR, 'counter', n)
        format('Van_%03d', n)
      end

      def self.apply_naming(model, obj, opts)
        if opts['ten_tu_dong']
          obj.name = next_name(model)
          obj.layer = model.layers.add('Van')
        else
          obj.name  = opts['instance'].to_s unless opts['instance'].to_s.strip.empty?
          lay = opts['layer'].to_s.strip
          obj.layer = model.layers.add(lay) unless lay.empty?
        end
      end

      # loops: mảng loop (loop đầu là biên ngoài, còn lại là lỗ), mỗi loop là mảng Point3d TỌA ĐỘ THẾ GIỚI.
      # dir: Vector3d thế giới - hướng đùn. thickness: inch.
      # Trả về group/instance, hoặc nil nếu lỗi. Không tự bọc operation.
      def self.build(model, loops, dir, thickness, opts)
        inv  = model.edit_transform.inverse
        ents = model.active_entities
        grp  = ents.add_group
        gents = grp.entities
        dl = inv * dir
        dl.normalize!

        loops.each_with_index do |pts, i|
          local = pts.map { |p| inv * p }
          f = gents.add_face(local)
          f.erase! if i > 0 && f
        end

        faces = gents.grep(Sketchup::Face)
        return nil if faces.empty?
        faces.each do |f|
          next unless f.valid?
          f.pushpull(f.normal.dot(dl) >= 0 ? thickness : -thickness)
        end

        obj = opts['tao_component'] ? grp.to_component : grp
        apply_naming(model, obj, opts)
        obj
      end

      # Nhiều mặt đồng phẳng -> một ván duy nhất (gộp các mặt kề nhau).
      def self.build_merged(model, loops_list, dir, thickness, opts)
        inv  = model.edit_transform.inverse
        grp  = model.active_entities.add_group
        gents = grp.entities
        dl = inv * dir
        dl.normalize!

        loops_list.each do |loops|
          loops.each_with_index do |pts, i|
            f = gents.add_face(pts.map { |p| inv * p })
            f.erase! if i > 0 && f
          end
        end

        shared = gents.grep(Sketchup::Edge).select do |e|
          e.faces.size == 2 && e.faces[0].normal.parallel?(e.faces[1].normal)
        end
        gents.erase_entities(shared) unless shared.empty?

        gents.grep(Sketchup::Face).each do |f|
          next unless f.valid?
          f.pushpull(f.normal.dot(dl) >= 0 ? thickness : -thickness)
        end

        obj = opts['tao_component'] ? grp.to_component : grp
        apply_naming(model, obj, opts)
        obj
      end

      def self.world_loops(face, tr)
        face.loops.sort_by { |l| l.outer? ? 0 : 1 }
            .map { |l| l.vertices.map { |v| tr * v.position } }
      end

      # Tạo ván từ các mặt đang chọn (chế độ nhanh).
      def self.quick_from_selection(model)
        opts = Settings.all
        faces = model.selection.grep(Sketchup::Face)
        return 0 if faces.empty?
        t = opts['do_day_nhanh'].to_f.mm
        return 0 if t <= 0
        tr = model.edit_transform
        sign = opts['dao_huong'] ? -1 : 1

        groups =
          if opts['gop_dong_phang']
            faces.group_by do |f|
              n = (tr * f.normal).normalize
              d = n.dot(tr * f.vertices[0].position - ORIGIN)
              [n.to_a.map { |c| c.round(3) }, d.to_f.round(3)]
            end.values
          else
            faces.map { |f| [f] }
          end

        count = 0
        model.start_operation('Tạo ván nhanh', true)
        begin
          groups.each do |fs|
            n = (tr * fs[0].normal).normalize
            dir = n.reverse * sign
            if fs.size > 1
              build_merged(model, fs.map { |f| world_loops(f, tr) }, dir, t, opts)
            else
              build(model, world_loops(fs[0], tr), dir, t, opts)
            end
            count += 1
          end
          model.commit_operation
        rescue => e
          model.abort_operation
          UI.messagebox("Lỗi tạo ván: #{e.message}")
          return 0
        end
        count
      end
    end
  end
end
