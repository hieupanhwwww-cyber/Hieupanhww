# encoding: UTF-8
# Hai cửa sổ làm việc độc lập (Thư viện, Thuộc tính) + hộp setting mẫu nổi trên Thư viện.
# Cầu nối: JS gọi sketchup.req(JSON{seq, action, data}); Ruby kiểm tra rồi trả HL.reply({seq, ok, ...}).
require 'json'

module HungLoan
  module TuModule
    module SU
      module Bridge
        module_function

        def make(title, key, file, w, h, style = UI::HtmlDialog::STYLE_DIALOG)
          d = UI::HtmlDialog.new(dialog_title: title, preferences_key: key, scrollable: true, resizable: true,
                                 width: w, height: h, min_width: 280, min_height: 300, style: style)
          d.set_file(File.join(TuModule::DIR, 'html', file))
          d
        end

        def bind(dialog, handler)
          dialog.add_action_callback('req') do |_ctx, raw|
            msg = begin
              JSON.parse(raw.to_s)
            rescue JSON::ParserError
              nil
            end
            next unless msg.is_a?(Hash) && msg['action'].is_a?(String)
            seq = msg['seq'].to_i
            out = begin
              r = handler.call(msg['action'], msg['data'].is_a?(Hash) ? msg['data'] : {})
              { 'ok' => true }.merge(r || {})
            rescue Core::ValidationError, OpError => e
              { 'ok' => false, 'error' => e.message, 'field' => (e.respond_to?(:field) ? e.field : nil) }
            rescue StandardError => e
              warn "[TuModule] dialog #{msg['action']}: #{e.message}\n#{e.backtrace.first(5).join("\n")}"
              { 'ok' => false, 'error' => "Lỗi: #{e.message}" }
            end
            reply(dialog, out.merge('seq' => seq, 'action' => msg['action']))
          end
        end

        def reply(dialog, data)
          dialog.execute_script("HL.reply(#{JSON.generate(data)})") if dialog.visible?
        end

        def push(dialog, data)
          dialog.execute_script("HL.push(#{JSON.generate({ 'ok' => true }.merge(data))})") if dialog && dialog.visible?
        end
      end

      # ================================================================== THƯ VIỆN
      module LibraryDialog
        L = Core::Library
        module_function

        def show
          if @d && @d.visible?
            @d.bring_to_front
            return
          end
          @d = Bridge.make('Thư viện module — Hùng Loan', 'HLTM_Library', 'library.html', 760, 560)
          Bridge.bind(@d, method(:handle))
          @d.set_on_closed { SettingsDialog.close }
          @d.show
        end

        def cfg; Prefs.library; end

        # Ảnh thật trích từ file SKP nguồn (nếu có trong gói); không có thì JS vẽ hình minh họa.
        def thumb_for(tid)
          File.exist?(File.join(TuModule::DIR, 'thumbs', "#{tid}.png")) ? "../thumbs/#{tid}.png" : nil
        end

        def with_thumbs(cards)
          cards.map { |c| c.merge('thumb' => thumb_for(c['id'])) }
        end

        def state(extra = {})
          {
            'folders' => cfg['folders'], 'types' => Core::Templates::MODULE_TYPES,
            'counts' => cfg['folders'].map { |f| [f['id'], L.list_folder(cfg, f['id']).size] }.to_h,
            'total' => Core::Templates.supported.size, 'notes' => Prefs.migration_notes
          }.merge(extra)
        end

        def handle(action, d)
          case action
          when 'init' then state
          when 'list' then { 'cards' => with_thumbs(L.list_folder(cfg, d['folder'])), 'scope' => d['folder'] }
          when 'filter' then { 'cards' => with_thumbs(L.filter_type(cfg, d['type'])), 'scope' => 'type' }
          when 'place'
            Commands.start_place(d['tid'])
            {}
          when 'gear'
            SettingsDialog.open(d['tid'], @d)
            {}
          when 'folder_add'
            c, id = L.add_folder(cfg, d['name'], d['parent'])
            Prefs.library = c
            state('select' => id)
          when 'folder_rename'
            Prefs.library = L.rename_folder(cfg, d['id'], d['name'])
            state
          when 'folder_delete'
            Prefs.library = L.delete_folder(cfg, d['id'])
            state
          when 'add_to_folder'
            Prefs.library = L.add_to_folder(cfg, d['folder'], d['tid'])
            state
          when 'remove_from_folder'
            Prefs.library = L.remove_from_folder(cfg, d['folder'], d['tid'])
            state
          when 'export'
            path = Safe.save_panel('Xuất sao lưu thư viện', 'thu_vien_tu_module.json')
            return { 'cancel' => true } unless path
            File.write(path, L.export_backup(cfg, TuModule::VERSION), encoding: 'UTF-8')
            { 'message' => "Đã xuất: #{path}" }
          when 'import'
            path = Safe.open_panel('Nhập sao lưu thư viện', 'JSON|*.json||')
            return { 'cancel' => true } unless path
            newcfg = L.import_backup(File.read(path, encoding: 'UTF-8'))
            ok = Safe.msgbox("Nhập sẽ THAY TOÀN BỘ setting và cây thư mục hiện tại bằng bản sao lưu (không gộp).\n" \
                               'Các module đã đặt trong bản vẽ không bị thay đổi. Tiếp tục?', MB_YESNO)
            return { 'cancel' => true } unless ok == IDYES
            Prefs.library = newcfg
            SettingsDialog.reload_if_open
            state('message' => 'Đã nhập và thay toàn bộ cấu hình thư viện.')
          else
            raise Core::ValidationError, "Lệnh không hợp lệ: #{action}"
          end
        end

        def dialog; @d; end
      end

      # ================================================================== HỘP SETTING MẪU (bánh răng)
      module SettingsDialog
        L = Core::Library
        module_function

        def open(tid, parent)
          tpl = Core::Templates.find(tid)
          raise Core::ValidationError, 'Mẫu không có trong thư viện' unless tpl && tpl['supported']
          @tid = tid
          if @d && @d.visible?
            Bridge.push(@d, payload)
            @d.bring_to_front
            return
          end
          @d = Bridge.make('Setting mẫu', 'HLTM_Settings', 'settings.html', 380, 560, UI::HtmlDialog::STYLE_UTILITY)
          Bridge.bind(@d, method(:handle))
          @d.show
          @d.bring_to_front
        end

        def payload
          tpl = Core::Templates.find(@tid)
          { 'kind' => 'template', 'tid' => @tid, 'name' => tpl['name'], 'geometry' => tpl['geometry'], 'module_type' => tpl['module_type'],
            'type_label' => Core::Templates.type_label(tpl['module_type']), 'fields' => tpl['fields'],
            'values' => L.settings_for(Prefs.library, @tid), 'customized' => Prefs.library['settings'].key?(@tid),
            'anchor' => tpl['anchor']['label'], 'thumb' => LibraryDialog.thumb_for(@tid) }
        end

        def handle(action, d)
          if d['tid'] && d['tid'] != @tid
            raise Core::ValidationError, 'Hộp setting đã chuyển sang mẫu khác — không lưu để tránh lưu nhầm.'
          end
          case action
          when 'init' then payload
          when 'save'
            c, errs = L.save_settings(Prefs.library, @tid, d['values'] || {})
            return { 'ok' => false, 'errors' => errs, 'error' => 'Có trường chưa hợp lệ — chưa lưu.' } if errs.any?
            Prefs.library = c
            payload.merge('message' => 'Đã lưu. Áp dụng cho các lần đặt MỚI của mẫu này; module đã đặt giữ nguyên.')
          when 'restore'
            payload.merge('values' => L.original_settings(@tid), 'message' => 'Đã nạp thông số gốc — bấm "Lưu setting" để áp dụng.', 'dirty' => true)
          when 'close'
            @d.close
            {}
          else
            raise Core::ValidationError, 'Lệnh không hợp lệ'
          end
        end

        def close; @d.close if @d && @d.visible?; end
        def reload_if_open; Bridge.push(@d, payload) if @d && @d.visible? && @tid; end
      end

      # ================================================================== CÀI ĐẶT CHUNG
      module GeneralDialog
        A = Core::AbfRules
        CAM_KEYS = [['cam_diameter', 'Ø cốc cam'], ['cam_depth', 'Sâu cốc cam'], ['cam_offset', 'Tâm cốc cách mặt tiếp xúc'],
                    ['edge_diameter', 'Ø lỗ cạnh'], ['edge_depth', 'Sâu lỗ cạnh'], ['bolt_diameter', 'Ø lỗ chốt'],
                    ['bolt_depth', 'Sâu lỗ chốt'], ['end_setback', 'Cam đầu/cuối cách đầu cạnh']].freeze
        module_function

        def show
          if @d && @d.visible?
            @d.bring_to_front
            return
          end
          @d = Bridge.make('Cài đặt chung — Tủ Module', 'HLTM_General', 'general.html', 560, 640)
          Bridge.bind(@d, method(:handle))
          @d.show
        end

        def payload
          cam = Prefs.cam_presets.first
          { 'ops' => A::OP_KEYS.map { |k| { 'key' => k, 'title' => A::OP_TITLES[k], 'layer' => A.ops[k]['layer'], 'instance' => A.ops[k]['instance'],
                                            'def_layer' => A::DEFAULT_OPS[k]['layer'], 'def_instance' => A::DEFAULT_OPS[k]['instance'] } },
            'settings' => A::DEFAULT_SETTINGS.keys.map { |k|
              { 'key' => k, 'label' => A::SETTING_TITLES[k], 'value' => A.settings[k], 'default' => A::DEFAULT_SETTINGS[k],
                'type' => (k == 'hinge_mark' ? 'enum' : (A::DEFAULT_SETTINGS[k].is_a?(Numeric) ? 'mm' : 'text')), 'options' => (k == 'hinge_mark' ? A::HINGE_MARKS : nil) }
            },
            'cam' => CAM_KEYS.map { |k, label| { 'key' => k, 'label' => label, 'value' => cam[k] } },
            'cam_name' => cam['name'], 'cam_demo' => cam['demo'] ? true : false }
        end

        def handle(action, d)
          case action
          when 'init' then payload
          when 'save'
            cfg, errs = A.clean_ops(d['ops'] || {})
            st, serr = A.clean_settings(d['settings'] || {})
            errs = errs.merge(serr)
            cam = Core::Util.deep_copy(Prefs.cam_presets.first)
            CAM_KEYS.each do |k, label|
              x = Core::Util.num((d['cam'] || {})[k])
              if x.nil? || x <= 0 then errs["cam.#{k}"] = "#{label}: cần số dương"
              else cam[k] = x
              end
            end
            return { 'ok' => false, 'errors' => errs, 'error' => 'Có ô chưa hợp lệ — chưa lưu.' } if errs.any?
            changed_cam = CAM_KEYS.any? { |k, _| (cam[k].to_f - Prefs.cam_presets.first[k].to_f).abs > 1e-9 }
            if changed_cam
              cam['name'] = 'Minifix xưởng' if cam['demo']
              cam['demo'] = false
              Prefs.save_cam_presets([cam] + Prefs.cam_presets.drop(1))
            end
            Prefs.save_abf_ops(cfg, st)
            n = d['regen'] ? Actions.regen_all : nil
            payload.merge('message' => n ? "Đã lưu và cập nhật #{n} bộ tủ trong model." : 'Đã lưu. Áp dụng cho tủ đặt mới và lần cập nhật kế tiếp.')
          when 'defaults'
            payload.merge('ops' => A::OP_KEYS.map { |k| { 'key' => k, 'title' => A::OP_TITLES[k], 'layer' => A::DEFAULT_OPS[k]['layer'],
                                                           'instance' => A::DEFAULT_OPS[k]['instance'], 'def_layer' => A::DEFAULT_OPS[k]['layer'],
                                                           'def_instance' => A::DEFAULT_OPS[k]['instance'] } },
                          'message' => 'Đã nạp tên mặc định — bấm Lưu để áp dụng.', 'dirty' => true)
          else
            raise Core::ValidationError, 'Lệnh không hợp lệ'
          end
        end
      end

      # ================================================================== THUỘC TÍNH
      module PropertiesDialog
        C = Core
        module_function

        def show
          if @d && @d.visible?
            @d.bring_to_front
          else
            @d = Bridge.make('Thuộc tính — Tủ Module', 'HLTM_Properties', 'properties.html', 360, 640)
            Bridge.bind(@d, method(:handle))
            @d.show
          end
          selection_changed
        end

        def visible?; @d && @d.visible?; end

        def selection_changed
          return unless visible?
          return if @pending
          @pending = true
          UI.start_timer(0.05, false) do
            @pending = false
            Bridge.push(@d, describe) rescue nil
          end
        end

        def target
          sel = Sketchup.active_model.selection
          e = sel.find { |x| Store.assembly?(x) || Store.module?(x) || Store.panel?(x) }
          e
        end

        def describe
          e = target
          return { 'kind' => 'none' } unless e
          if Store.assembly?(e) then Props.assembly(e)
          elsif Store.module?(e) then Props.module(e)
          else Props.panel(e)
          end
        end

        def handle(action, d)
          case action
          when 'init' then describe
          when 'apply'
            e = target
            desc = describe
            if desc['target'] != d['target']
              raise C::ValidationError, 'Đối tượng đang chọn đã thay đổi — chưa áp dụng (nháp vẫn giữ theo đối tượng cũ).'
            end
            Props.apply(e, d['values'] || {})
            describe.merge('message' => 'Đã áp dụng.')
          when 'save_hinge_preset'
            Props.save_hinge_preset(d)
            describe.merge('message' => 'Đã lưu bộ cấu hình bản lề.')
          when 'tool'
            Commands.run(d['name'])
            {}
          else
            raise C::ValidationError, 'Lệnh không hợp lệ'
          end
        end
      end
    end
  end
end
