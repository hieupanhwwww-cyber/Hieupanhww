# encoding: UTF-8
module HungLoan
  module TuModule
    module SU
      module Commands
        C = Core
        module_function

        def model; Sketchup.active_model; end

        def start_place(tid)
          tpl = C::Templates.find(tid)
          raise C::ValidationError, 'Mẫu không có trong thư viện' unless tpl && tpl['supported']
          s = C::Library.settings_for(Prefs.library, tid)
          if tpl['geometry'] == 'drawer_box'
            model.select_tool(DrawerTool.new(s, s['place_mode'] || 'single'))
          else
            model.select_tool(PlaceTool.new(tpl, s))
          end
        end

        def drawer_tool(mode)
          s = C::Library.settings_for(Prefs.library, 'hl.thung_ngan_keo.v1')
          model.select_tool(DrawerTool.new(s, mode))
        end

        def copy_divider
          pg = model.selection.find { |e| Store.panel?(e) && %w[partition shelf].include?(e.get_attribute(Store::DICT, 'role')) }
          return UI.messagebox('Mở module (bấm đúp) rồi chọn MỘT vách hoặc đợt cần sao chép.') unless pg
          mod = Store.parent_group(pg)
          r = UI.inputbox(['Số bản sao', 'Khoảng LỌT LÒNG giữa hai tấm (mm)', 'Hướng'], [1, 400, 'Phải/Lên'],
                          ['', '', 'Phải/Lên|Trái/Xuống'], 'Sao chép vách/đợt')
          return unless r
          n = r[0].to_i
          clear = Units.parse_mm(r[1].to_s)
          return UI.messagebox('Khoảng lọt lòng phải là số mm.') unless clear
          Actions.copy_divider(mod, pg.get_attribute(Store::DICT, 'local_id'), n, clear, r[2] == 'Phải/Lên' ? 1 : -1)
        end

        def cam_tool
          mods = Actions.selected_modules
          return UI.messagebox('Chọn bộ tủ hoặc module rồi chạy lệnh Liên kết cam.') if mods.empty?
          model.select_tool(CamTool.new(mods))
        end

        def section_tool
          mods = Actions.selected_modules
          asm = mods.map { |m| Manager.asm_of(m) }.compact.first
          return UI.messagebox('Chọn bộ tủ hoặc module trong bộ tủ để quét tiết diện.') unless asm
          whole = model.selection.any? { |e| Store.assembly?(e) }
          ids = whole ? nil : mods.map { |m| Store.id(m) }
          model.select_tool(SectionTool.new(asm, ids))
        end

        def run(name)
          case name
          when 'library' then LibraryDialog.show
          when 'properties' then PropertiesDialog.show
          when 'select_set' then Actions.select_whole_set
          when 'select_modules' then Actions.select_single_modules
          when 'fronts' then Actions.create_fronts
          when 'partition' then model.select_tool(DividerTool.new('x'))
          when 'shelf' then model.select_tool(DividerTool.new('z'))
          when 'copy_divider' then copy_divider
          when 'drawer' then drawer_tool('single')
          when 'drawer_cluster' then drawer_tool('cluster')
          when 'hinge_auto' then Actions.auto_hinges
          when 'hinge_manual' then model.select_tool(HingeTool.new)
          when 'cam' then cam_tool
          when 'cam_remove' then Actions.remove_joints
          when 'sections' then section_tool
          when 'sections_clear'
            asm = Actions.selected_assemblies.first
            asm ? Actions.clear_sections(asm) : UI.messagebox('Chọn bộ tủ.')
          when 'mfg_check' then Export.cmd_check
          when 'mfg_files' then Export.cmd_export_files
          when 'mfg_snapshot' then Export.cmd_snapshot
          when 'abf_cases' then TestCases.build_all
          when 'survey' then Survey.run
          end
        rescue C::ValidationError, OpError => e
          UI.messagebox(e.message)
        end

        ITEMS = [
          ['library', 'Thư viện module', 'Mở thư viện mẫu (cây thư mục, lọc loại, bánh răng setting)', 'library'],
          ['properties', 'Thuộc tính', 'Cửa sổ thuộc tính đối tượng đang chọn', 'properties'],
          nil,
          ['select_set', 'Chọn cả bộ', 'Chọn nguyên bộ tủ', 'select_set'],
          ['select_modules', 'Chọn từng module', 'Mở bộ tủ để chọn/Move từng module', 'select_modules'],
          nil,
          ['partition', 'Thêm vách đứng', 'Trỏ vào khoang: click hoặc gõ số + Enter; Tab đổi điểm bám', 'partition'],
          ['shelf', 'Thêm đợt ngang', 'Trỏ vào khoang: click hoặc gõ số + Enter; Tab đổi điểm bám', 'shelf'],
          ['copy_divider', 'Sao chép vách/đợt…', 'Nhập số bản sao và khoảng lọt lòng', 'copy'],
          ['drawer', 'Đặt từng thùng ngăn kéo', 'Ray bi hai bên: rộng = lọt lòng − 26 mm', 'drawer'],
          ['drawer_cluster', 'Tạo cả cụm thùng ngăn kéo', 'Theo bố cục mặt ngăn kéo của module', 'drawer'],
          ['fronts', 'Tạo mặt trước', 'Tạo/cập nhật cánh hoặc mặt ngăn kéo theo template', 'fronts'],
          nil,
          ['hinge_auto', 'Bản lề tự động', 'Đánh dấu lỗ cốc theo chiều cao cánh, tránh đợt', 'hinge'],
          ['hinge_manual', 'Bản lề thủ công', 'Click lên cánh để đặt/bỏ lỗ cốc', 'hinge'],
          ['cam', 'Liên kết Cam Minifix', 'Xem trước, đổi mặt, xóa rồi Enter áp dụng', 'cam'],
          ['cam_remove', 'Bỏ liên kết cam', 'Tắt liên kết cam của module đang chọn', nil],
          ['sections', 'Quét tiết diện giao nhau', 'Tìm cặp tấm giao thật, xem trước, đánh dấu hàng loạt', 'section'],
          ['sections_clear', 'Xóa dấu tiết diện', 'Bỏ toàn bộ dấu tiết diện của bộ tủ', nil],
          nil,
          ['mfg_check', 'Kiểm tra dữ liệu sản xuất', 'Kiểm tra tấm/feature, báo lỗi theo mã', 'check'],
          ['mfg_files', 'Xuất dữ liệu gia công (JSON/CSV)…', 'Dữ liệu trung lập mm', 'export'],
          ['mfg_snapshot', 'Tạo bản gia công (bàn giao ABF/Nesting)', 'Tấm phẳng một cấp, lỗ/rãnh khoét thật — ABF chưa kiểm chứng', 'export'],
          ['abf_cases', 'Dựng bộ ca kiểm thử ABF', 'Dựng các ca chuẩn để nạp thử trên ABF/Nesting', nil],
          nil,
          ['survey', 'Khảo sát bộ mẫu SKP…', 'Đo cấu tạo từng file .skp mẫu, ghi ra JSON (model đang mở không bị đổi)', nil]
        ].freeze

        def install
          return if @installed
          @installed = true
          menu = UI.menu('Extensions').add_submenu(C::Config::DISPLAY_NAME)
          tb = UI::Toolbar.new(C::Config::DISPLAY_NAME)
          ITEMS.each do |it|
            if it.nil?
              menu.add_separator
              next
            end
            key, label, tip, icon = it
            cmd = UI::Command.new(label) { run(key) }
            cmd.tooltip = label
            cmd.status_bar_text = tip
            if icon
              path = File.join(TuModule::DIR, 'icons', "#{icon}.svg")
              cmd.small_icon = path
              cmd.large_icon = path
              tb.add_item(cmd) unless %w[cam_remove sections_clear drawer_cluster copy_divider].include?(key)
            end
            menu.add_item(cmd)
          end
          tb.get_last_state == TB_NEVER_SHOWN ? tb.show : tb.restore
          UI.add_context_menu_handler do |cm|
            sel = Sketchup.active_model.selection
            if sel.any? { |e| Store.assembly?(e) || Store.module?(e) || Store.panel?(e) }
              sub = cm.add_submenu(C::Config::DISPLAY_NAME)
              sub.add_item('Thuộc tính') { PropertiesDialog.show }
              sub.add_item('Tạo mặt trước') { run('fronts') }
              sub.add_item('Chọn cả bộ') { run('select_set') }
              sub.add_item('Chọn từng module') { run('select_modules') }
              if sel.any? { |e| Store.panel?(e) && %w[partition shelf].include?(e.get_attribute(Store::DICT, 'role')) }
                sub.add_item('Sao chép vách/đợt…') { run('copy_divider') }
              end
              cm.add_item('Thuộc tính (Tủ Module)') { PropertiesDialog.show }
            end
          end
        end
      end
    end
  end
end
