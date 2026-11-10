# encoding: UTF-8
# KHẢO SÁT BỘ MẪU SKP: nạp tạm từng file .skp, đo từng nhóm/tấm (tên, tag, vật liệu, hộp bao theo
# trục, kích thước, bán kính cung/lỗ, attribute dictionary — kể cả dữ liệu ABF gắn sẵn), ghi ra 1 file JSON.
# Model đang mở KHÔNG bị thay đổi: toàn bộ thao tác nạp được hoàn lại bằng abort_operation.
require 'json'

module HungLoan
  module TuModule
    module SU
      module Survey
        MM = 25.4
        MAX_DEPTH = 7
        MAX_NODES = 6000
        module_function

        def run
          dir = UI.select_directory(title: 'Chọn thư mục chứa các file .skp mẫu (Model_17MM)')
          return unless dir
          files = Dir.glob(File.join(dir, '*.skp')).sort
          return UI.messagebox('Thư mục không có file .skp.') if files.empty?
          out = UI.savepanel('Lưu kết quả khảo sát', dir, 'khao_sat_mau.json')
          return unless out
          out += '.json' unless out.downcase.end_with?('.json')
          model = Sketchup.active_model
          results = []
          t0 = Time.now
          model.start_operation('Khảo sát bộ mẫu (tạm)', true)
          begin
            files.each_with_index do |f, i|
              Sketchup.status_text = "Khảo sát #{i + 1}/#{files.size}: #{File.basename(f)}"
              results << survey_file(model, f)
            end
          ensure
            model.abort_operation
          end
          doc = { 'format' => 'HLTM-SURVEY', 'version' => 1, 'units' => 'mm', 'sketchup' => Sketchup.version,
                  'plugin' => TuModule::VERSION, 'files' => results }
          File.write(out, JSON.generate(doc), encoding: 'UTF-8')
          bad = results.count { |r| r['error'] }
          UI.messagebox("Đã khảo sát #{results.size} file (#{bad} lỗi) trong #{(Time.now - t0).round} giây.\n" \
                        "Kết quả: #{out}\n\nGửi file JSON này để làm thông minh đúng theo model gốc.", MB_MULTILINE)
        end

        # Khảo sát chính MODEL ĐANG MỞ (vd dự án đã chạy ABF): ghi cấu trúc nhóm, tag, hình học, thuộc tính + ID.
        def run_open_model
          model = Sketchup.active_model
          base = model.path.to_s.empty? ? 'model' : File.basename(model.path, '.skp')
          out = UI.savepanel('Lưu kết quả khảo sát model đang mở', nil, "khao_sat_#{base}.json")
          return unless out
          out += '.json' unless out.downcase.end_with?('.json')
          @count = 0
          idt = Geom::Transformation.new
          r = { 'file' => File.basename(model.path.to_s), 'loose' => loose_info(model.entities, idt),
                'nodes' => children(model.entities, idt, 0), 'tags' => model.layers.map { |l| l.name } }
          r['truncated'] = true if @count >= MAX_NODES
          doc = { 'format' => 'HLTM-SURVEY', 'version' => 1, 'units' => 'mm', 'sketchup' => Sketchup.version,
                  'plugin' => TuModule::VERSION, 'files' => [r] }
          File.write(out, JSON.generate(doc), encoding: 'UTF-8')
          UI.messagebox("Đã ghi #{@count} nhóm vào:\n#{out}\n\nGửi file JSON này cho kỹ thuật.", MB_MULTILINE)
        rescue StandardError => e
          UI.messagebox("Khảo sát lỗi: #{e.message}")
        end

        def survey_file(model, path)
          r = { 'file' => File.basename(path) }
          defn = model.definitions.load(path)
          r['definition'] = defn.name
          @count = 0
          r['bounds'] = box_mm(defn.bounds, Geom::Transformation.new)
          r['loose'] = loose_info(defn.entities, Geom::Transformation.new)
          r['nodes'] = children(defn.entities, Geom::Transformation.new, 0)
          r['truncated'] = true if @count >= MAX_NODES
          r['dicts'] = dicts(defn)
          r
        rescue StandardError => e
          r.merge('error' => "#{e.class}: #{e.message}")
        end

        def children(ents, tf, depth)
          out = []
          ents.each do |e|
            next unless e.is_a?(Sketchup::Group) || e.is_a?(Sketchup::ComponentInstance)
            break if @count >= MAX_NODES
            @count += 1
            d = e.definition
            t = tf * e.transformation
            n = {
              'name' => e.name.to_s, 'def' => d.name.to_s, 'type' => e.is_a?(Sketchup::Group) ? 'group' : 'component',
              'tag' => e.layer ? e.layer.name : nil, 'material' => e.material ? e.material.display_name : nil,
              'hidden' => e.hidden?, 'locked' => e.locked?, 'entity_id' => e.entityID,
              'persistent_id' => (e.respond_to?(:persistent_id) ? e.persistent_id : nil),
              'box' => box_mm(d.bounds, t), 'origin' => pt_mm(t.origin), 'axes' => axes(t)
            }
            n['size'] = (0..2).map { |k| (n['box'][1][k] - n['box'][0][k]).round(2) }
            n['loose'] = loose_info(d.entities, t)
            dd = dicts(e).merge(dicts(d)) { |_k, a, b| a.merge(b) }
            n['dicts'] = dd unless dd.empty?
            if depth < MAX_DEPTH
              kids = children(d.entities, t, depth + 1)
              n['children'] = kids unless kids.empty?
            end
            out << n
          end
          out
        end

        # Hình học rời trong một nhóm: số mặt/cạnh, tag đang dùng, các cung/lỗ tròn (bán kính, tâm, pháp tuyến).
        def loose_info(ents, tf)
          faces = 0; edges = 0
          tags = Hash.new(0)
          arcs = {}
          ents.each do |e|
            if e.is_a?(Sketchup::Face)
              faces += 1
              tags[e.layer.name] += 1 if e.layer
            elsif e.is_a?(Sketchup::Edge)
              edges += 1
              tags[e.layer.name] += 1 if e.layer
              c = e.curve
              next unless c.is_a?(Sketchup::ArcCurve)
              key = c.entityID
              next if arcs[key] || arcs.size >= 60
              arcs[key] = { 'r' => (c.radius.to_f * MM).round(2), 'center' => pt_mm(c.center.transform(tf)),
                            'normal' => c.normal.transform(tf).normalize.to_a.map { |x| x.round(3) },
                            'sweep_deg' => ((c.end_angle - c.start_angle) * 180.0 / Math::PI).round(1) }
            end
          end
          h = { 'faces' => faces, 'edges' => edges }
          h['tags'] = tags unless tags.empty?
          h['arcs'] = arcs.values unless arcs.empty?
          h
        end

        def dicts(e)
          out = {}
          ds = e.attribute_dictionaries
          return out unless ds
          ds.each do |d|
            h = {}
            d.each_pair { |k, v| h[k.to_s] = v.is_a?(Numeric) || v == true || v == false || v.nil? ? v : v.to_s[0, 400] }
            out[d.name] = h unless h.empty?
          end
          out
        rescue StandardError
          out
        end

        def pt_mm(p) [(p.x.to_f * MM).round(2), (p.y.to_f * MM).round(2), (p.z.to_f * MM).round(2)] end

        def axes(t)
          a = t.to_a
          [a[0, 3], a[4, 3], a[8, 3]].map { |v| v.map { |x| x.round(4) } }
        end

        def box_mm(bb, tf)
          return [[0, 0, 0], [0, 0, 0]] if bb.empty?
          pts = (0..7).map { |i| pt_mm(bb.corner(i).transform(tf)) }
          [(0..2).map { |k| pts.map { |p| p[k] }.min }, (0..2).map { |k| pts.map { |p| p[k] }.max }]
        end
      end
    end
  end
end
