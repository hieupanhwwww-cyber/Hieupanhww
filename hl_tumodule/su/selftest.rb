# encoding: UTF-8
# TỰ KIỂM TRA TRONG SKETCHUP THẬT: thử API của host, dựng từng mẫu, bật từng chức năng, Move/Scale, xuất gia công.
# Thêm tạm vài tủ vào model hiện tại rồi XÓA SẠCH khi xong. Kết quả ghi ra tu_kiem_tra.txt (kèm nhật ký lỗi chi tiết).
module HungLoan
  module TuModule
    module SU
      module SelfTest
        C = Core
        U = Units
        M = Manager
        module_function

        def model; Sketchup.active_model; end

        def run
          ok = Safe.msgbox("Tự kiểm tra sẽ THÊM TẠM vài tủ vào model hiện tại, chạy thử mọi chức năng rồi XÓA sạch.\n" \
                           "Nên chạy trong model trống. Mất khoảng 10–30 giây. Tiếp tục?", MB_YESNO)
          return unless ok == IDYES
          @lines = []
          @fail = 0
          @pass = 0
          t0 = Time.now
          before = model.entities.to_a.map(&:entityID)
          head
          begin
            probe_host
            run_templates
            run_links
            run_tools_flow
            run_export
          ensure
            cleanup(before)
          end
          finish(t0)
        end

        def head
          @lines << "TỰ KIỂM TRA TỦ MODULE #{TuModule::VERSION} — #{Time.now.strftime('%d/%m/%Y %H:%M:%S')}"
          @lines << "SketchUp #{Sketchup.version} · #{RUBY_PLATFORM} · Ruby #{RUBY_VERSION} · 64bit=#{Sketchup.respond_to?(:is_64bit?) ? Sketchup.is_64bit? : '?'}"
          @lines << "Model: #{model.path.to_s.empty? ? '(chưa lưu)' : model.path}"
          @lines << ''
        end

        # Chạy một bước; mọi lỗi (kể cả bị Manager nuốt) đều được ghi lại.
        def step(name)
          Manager.last_error = nil
          Safe.take_captured
          res = nil
          Safe.quiet do
            begin
              res = yield
            rescue Exception => e # rubocop:disable Lint/RescueException — tự kiểm tra phải bắt mọi thứ
              Safe.log("tự kiểm tra: #{name}", e)
              record(false, name, "#{e.class}: #{e.message}", e.backtrace)
              return nil
            end
          end
          msgs = Safe.take_captured
          err = Manager.last_error
          if err
            record(false, name, "#{err.class}: #{err.message}", err.backtrace)
          elsif msgs.any? { |m| m =~ /Không|lỗi|Lỗi|không/ && m !~ /^Đã / }
            record(false, name, msgs.first(2).join(' | '), nil)
          else
            record(true, name, nil, nil)
          end
          res
        end

        def record(ok, name, detail, bt)
          if ok
            @pass += 1
            @lines << "  OK    #{name}"
          else
            @fail += 1
            @lines << "  LỖI   #{name}"
            @lines << "          → #{detail}" if detail
            (bt || []).first(8).each { |l| @lines << "            #{l.to_s.sub(TuModule::DIR, '…')}" }
          end
        end

        def section(t) @lines << ''; @lines << "■ #{t}" end

        # ------------------------------------------------------------ 1. API của host
        def probe_host
          section('API SketchUp')
          step('start/commit/abort_operation (4 tham số)') do
            model.start_operation('hltm-probe', true, false, false)
            model.abort_operation
          end
          step('Group, add_circle, add_face, pushpull, make_unique') do
            model.start_operation('hltm-probe', true)
            begin
              g = model.active_entities.add_group
              edges = g.entities.add_circle(ORIGIN, Z_AXIS, 1.0, 24)
              f = g.entities.add_face(edges)
              raise 'add_face(edges) trả nil' unless f
              f.pushpull(0.5)
              g2 = g.copy
              g2.make_unique
              raise 'persistent_id thiếu' unless g.respond_to?(:persistent_id) && g.persistent_id.to_i > 0
            ensure
              model.abort_operation
            end
          end
          step('attribute: Vector3d / mảng / JSON') do
            model.start_operation('hltm-probe', true)
            begin
              g = model.active_entities.add_group
              g.set_attribute('ABF', 'v', Geom::Vector3d.new(0, 0, -1))
              g.set_attribute('ABF', 'b', true)
              g.set_attribute('ABF', 'n', 2.0)
              raise 'Vector3d không đọc lại được' unless g.get_attribute('ABF', 'v').is_a?(Geom::Vector3d)
              g.set_attribute('HungLoan_TuModule', 'params', JSON.generate('a' => [1, 2, 'é']))
              raise 'JSON sai' unless JSON.parse(g.get_attribute('HungLoan_TuModule', 'params'))['a'][2] == 'é'
            ensure
              model.abort_operation
            end
          end
          step('Tag (layers.add, color=)') do
            model.start_operation('hltm-probe', true)
            begin
              ly = model.layers.add('HLTM_PROBE')
              ly.color = Sketchup::Color.new(1, 2, 3) if ly.respond_to?(:color=)
            ensure
              model.abort_operation
            end
          end
          step('UI::HtmlDialog tạo được') do
            raise 'thiếu UI::HtmlDialog' unless defined?(UI::HtmlDialog)
          end
          step('Thư mục dữ liệu ghi được') do
            p = Prefs.path('hltm_probe.tmp')
            File.write(p, 'ok', encoding: 'UTF-8')
            File.delete(p)
          end
          step('Bộ nhớ cấu hình: thư viện + tên ABF') do
            raise 'thư viện rỗng' if C::Library.filter_type(Prefs.library, nil).empty?
            cfg, errs = C::AbfRules.clean_ops(C::AbfRules.ops)
            raise "tên ABF không hợp lệ: #{errs.inspect}" if errs.any?
          end
        end

        # ------------------------------------------------------------ 2. từng mẫu
        def place_template(tpl, origin)
          s = C::Library.settings_for(Prefs.library, tpl['id'])
          M.place_new(tpl, s, { 'asm' => nil, 'pos' => [0.0, 0.0, 0.0], 'rot' => 0, 'origin_tf' => U.place_tf(origin, 0) })
        end

        def run_templates
          section('Từng mẫu trong thư viện')
          @placed = {}
          x = 0.0
          C::Templates.supported.each do |tpl|
            next if tpl['geometry'] == 'drawer_box'
            g = step("đặt mẫu “#{tpl['name']}”") do
              gg = place_template(tpl, [x, -20_000.0, 0.0])
              raise 'không tạo được module' unless gg && gg.valid?
              raise 'module không có tấm' if Store.panels_in(gg).empty?
              gg
            end
            x += 4000.0
            next unless g
            @placed[tpl['id']] = g
            next if tpl['front_rule'] == 'open'
            step("  mặt trước + cam + bản lề cho “#{tpl['name']}”") do
              vals = { 'front_enabled' => true, 'joints_enabled' => true }
              vals['hinges_enabled'] = true if tpl['front_rule'] == 'doors'
              Props.apply_module(g, vals)
              b = M.build(Store.params(g))
              errs = b['errors'].select { |e| e['level'] == 'error' }
              raise errs.first['message'] unless errs.empty?
            end
            step("  kiểm tra dữ liệu sản xuất “#{tpl['name']}”") do
              _p, _j, iss = Export.check(model)
              errs = iss.select { |i| i['level'] == 'error' && i['code'] != 'UNSUPPORTED_BENT' }
              raise "#{errs.size} lỗi, đầu tiên: #{errs.first['code']} #{errs.first['message']}" unless errs.empty?
            end
          end
        end

        # ------------------------------------------------------------ 3. liên kết module
        def run_links
          section('Ghép bộ tủ')
          lo = @placed['hl.khung_tu.v1']
          if lo && lo.valid?
            asm = M.asm_of(lo)
            lp = Store.params(lo)
            up = step('đặt cục trên lên cục dưới (xếp chồng)') do
              t = C::Templates.find('hl.cuc_tren.v1')
              s = C::Library.settings_for(Prefs.library, t['id'])
              g = M.place_new(t, s, { 'asm' => asm, 'pos' => [0.0, 0.0, lp['h']], 'rot' => 0,
                                      'link' => { 'type' => 'stack', 'lower' => lp['id'] }, 'dims' => { 'w' => lp['w'], 'd' => lp['d'] } })
              raise 'không đặt được' unless g
              g
            end
            if up
              step('sửa rộng cục trên → cục dưới đổi theo') do
                Props.apply_module(up, 'w' => '1000')
                raise "rộng cục dưới = #{Store.params(lo)['w']}" unless (Store.params(lo)['w'] - 1000).abs < 1e-6
              end
              step('Move cục dưới kéo cục trên') do
                lo.transformation = Geom::Transformation.new(U.pt([500.0, 0, 0])) * lo.transformation
                Actions.on_module_transformed(lo)
              end
              step('Scale cả bộ theo chiều cao') do
                asm.transformation = asm.transformation * Geom::Transformation.scaling(1.0, 1.0, 1.1)
                Actions.on_assembly_transformed(asm)
                raise 'còn scale dư' unless (U.axes_scale(asm.transformation)['sz'] - 1.0).abs < 1e-6
              end
            end
          end
          bl = @placed['hl.tu_bep_duoi.v1']
          if bl && bl.valid?
            asm = M.asm_of(bl)
            bp = Store.params(bl)
            step('đặt tủ bếp trên, căn mặt sau') do
              t = C::Templates.find('hl.tu_bep_tren.v1')
              s = C::Library.settings_for(Prefs.library, t['id'])
              g = M.place_new(t, s, { 'asm' => asm, 'pos' => [0.0, bp['d'] - s['d'], bp['h'] + 600.0], 'rot' => 0,
                                      'link' => { 'type' => 'kitchen', 'lower' => bp['id'] }, 'dims' => { 'w' => bp['w'] }, 'gap' => 600.0 })
              raise 'không đặt được' unless g
              Props.apply_module(bl, 'd' => '600')
              rec = M.record(g, Store.params(g))
              raise 'mặt sau không thẳng' unless (rec['pos'][1] + Store.params(g)['d'] - 600.0).abs < 1e-6
            end
          end
        end

        # ------------------------------------------------------------ 4. thao tác nội thất
        def run_tools_flow
          section('Vách, đợt, thùng ngăn kéo, bản lề')
          g = @placed['hl.khung_tu.v1']
          return unless g && g.valid?
          step('thêm vách đứng') do
            b = M.build(Store.params(g))
            Actions.insert_divider(g, b['cells'][0]['id'], 'x', b['info']['w'] / 2.0)
            raise 'không có vách' unless Store.panels_in(g).any? { |p| p.get_attribute(Store::DICT, 'role') == 'partition' }
          end
          step('thêm đợt ngang + sao chép') do
            b = M.build(Store.params(g))
            cell = b['cells'].first
            Actions.insert_divider(g, cell['id'], 'z', (cell['z0'] + cell['z1']) / 2.0)
            sh = Store.panels_in(g).find { |p| p.get_attribute(Store::DICT, 'role') == 'shelf' }
            raise 'không có đợt' unless sh
            Actions.copy_divider(g, sh.get_attribute(Store::DICT, 'local_id'), 2, 200.0, 1)
          end
          step('đặt thùng ngăn kéo ray bi') do
            b = M.build(Store.params(g))
            cell = b['cells'].max_by { |c| c['x1'] - c['x0'] }
            bt = C::Library.original_settings('hl.thung_ngan_keo.v1')
            box = { 'height' => bt['box_height'], 'rail_length' => 350.0, 'side_t' => bt['box_side_t'], 'bottom_t' => bt['box_bottom_t'] }
            Actions.add_drawers(g, cell['id'], [0.0], box)
          end
          step('bản lề thủ công + tự động') do
            Props.apply_module(g, 'front_enabled' => true, 'hinges_enabled' => true)
            Actions.auto_hinges
          end
          step('xóa native một tấm rồi cập nhật') do
            Actions.on_panels_removed(g, ['side_R'])
            Props.apply_module(g, 'h' => '2100')
          end
          step('đổi tên layer/instance ABF + cập nhật lại') do
            d = GeneralDialog
            d.handle('defaults', {})
            r = d.handle('init', {})
            ops = r['ops'].map { |o| [o['key'], { 'layer' => o['layer'], 'instance' => o['instance'] }] }.to_h
            cam = r['cam'].map { |c| [c['key'], c['value']] }.to_h
            sets = r['settings'].map { |x| [x['key'], x['value']] }.to_h
            res = d.handle('save', 'ops' => ops, 'cam' => cam, 'settings' => sets, 'regen' => true)
            raise res['error'].to_s if res['ok'] == false
          end
        end

        # ------------------------------------------------------------ 5. xuất gia công
        def run_export
          section('Dữ liệu sản xuất và bàn giao ABF')
          step('kiểm tra toàn bộ + xuất bản gia công') do
            parts, _j, iss = Export.check(model)
            raise 'không có chi tiết' if parts.empty?
            errs = iss.select { |i| i['level'] == 'error' && i['code'] != 'UNSUPPORTED_BENT' }
            raise "#{errs.size} lỗi dữ liệu: #{errs.first['code']} — #{errs.first['message']}" unless errs.empty?
            Export.cmd_snapshot
          end
        end

        # ------------------------------------------------------------ dọn dẹp + báo cáo
        def cleanup(before)
          section('Dọn dẹp')
          Safe.quiet do
            begin
              model.start_operation('Dọn tự kiểm tra', true)
              extra = model.entities.to_a.reject { |e| before.include?(e.entityID) }
              model.entities.erase_entities(extra.select(&:valid?)) unless extra.empty?
              model.commit_operation
              @lines << "  OK    đã xóa #{extra.size} đối tượng thử"
            rescue StandardError => e
              Safe.log('dọn tự kiểm tra', e)
              @lines << "  LỖI   không dọn được: #{e.message}"
              begin
                model.abort_operation
              rescue StandardError
                nil
              end
            end
          end
        end

        def finish(t0)
          @lines << ''
          @lines << "KẾT QUẢ: #{@pass} đạt, #{@fail} lỗi · #{(Time.now - t0).round(1)} giây"
          path = Prefs.path('tu_kiem_tra.txt')
          File.write(path, @lines.join("\n") + "\n", encoding: 'UTF-8')
          if File.exist?(Safe.log_path)
            File.open(path, 'a:UTF-8') { |f| f.puts("\n--- NHẬT KÝ LỖI (#{Safe.log_path}) ---"); f.puts(File.read(Safe.log_path, encoding: 'UTF-8').lines.last(120).join) }
          end
          msg = if @fail.zero? then "Tất cả #{@pass} bước đều đạt.\nBáo cáo: #{path}"
                else "#{@pass} bước đạt, #{@fail} bước LỖI.\n\nBáo cáo chi tiết (gửi file này cho kỹ thuật):\n#{path}"
                end
          Safe.msgbox(msg, MB_MULTILINE)
        end
      end
    end
  end
end
