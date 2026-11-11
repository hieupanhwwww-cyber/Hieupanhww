# encoding: UTF-8
# LỚP AN TOÀN: mọi lỗi Ruby không được làm hỏng thao tác của người dùng hoặc "câm lặng".
#  - Safe.guard      : bao một thao tác; lỗi → ghi nhật ký + thông báo ngắn (không spam).
#  - Safe.protect_tool: bọc mọi callback của công cụ chuột (rê/vẽ/click/phím) — lỗi ở draw/rê không bật hộp thoại
#                       liên tục; quá nhiều lỗi thì tự thoát công cụ.
#  - Safe.msgbox/notify: mọi thông báo đi qua đây để chế độ "tự kiểm tra" gom lại thay vì bật hộp thoại.
#  - Nhật ký: <thư mục dữ liệu>/loi.log (tự cắt khi quá 512 KB).
require 'time'

module HungLoan
  module TuModule
    module SU
      module Safe
        LOG_MAX = 512 * 1024
        TOOL_CB = %i[activate deactivate resume suspend onMouseMove onLButtonDown onLButtonUp onKeyDown onKeyUp
                     onUserText onReturn onCancel onSetCursor draw getExtents enableVCB?].freeze
        QUIET_CB = %i[draw onMouseMove getExtents onSetCursor enableVCB? onKeyUp].freeze # tần suất cao: không popup
        TOOL_DEFAULT = { onKeyDown: false, enableVCB?: false }.freeze
        MAX_TOOL_ERRORS = 5

        @quiet = 0
        @captured = []
        @shown = {}
        @session_logged = false
        @last = nil
        @mem = []          # lỗi trong phiên (ghi vào file .skp khi Save)
        @selftest = nil
        DIAG_DICT = 'HungLoan_TuModule_Diag'.freeze

        class << self
          attr_reader :captured, :last, :mem
          attr_accessor :selftest

          def log_path
            Prefs.path('loi.log')
          rescue StandardError
            File.join(Dir.tmpdir, 'hltm_loi.log')
          end

          def log(where, e)
            p = log_path
            begin
              File.delete(p) if File.exist?(p) && File.size(p) > LOG_MAX
            rescue StandardError
              nil
            end
            File.open(p, 'a:UTF-8') do |f|
              unless @session_logged
                f.puts("=== #{Time.now.strftime('%Y-%m-%d %H:%M:%S')} · Tủ Module #{TuModule::VERSION} · SketchUp #{Sketchup.version} · #{RUBY_PLATFORM} · Ruby #{RUBY_VERSION}")
                @session_logged = true
              end
              f.puts("[#{Time.now.strftime('%H:%M:%S')}] #{where}: #{e.class}: #{e.message}")
              (e.backtrace || []).first(14).each { |l| f.puts("    #{l.to_s.sub(TuModule::DIR, '…')}") }
            end
            @last = { 'where' => where, 'class' => e.class.to_s, 'message' => e.message, 'backtrace' => (e.backtrace || []).first(14) }
            @mem << { 't' => Time.now.strftime('%d/%m %H:%M:%S'), 'where' => where.to_s, 'class' => e.class.to_s, 'message' => e.message.to_s[0, 300],
                      'bt' => (e.backtrace || []).first(6).map { |l| l.to_s.sub(TuModule::DIR, '…')[0, 160] } }
            @mem.shift while @mem.size > 30
          rescue StandardError
            nil
          end

          # ---- CHẨN ĐOÁN ĐI KÈM FILE: ghi vào attribute của model ngay trước khi Save, để chỉ cần gửi file .skp là đủ.
          def diag_data
            cam = begin
              Prefs.cam_presets.first
            rescue StandardError
              {}
            end
            { 'plugin' => TuModule::VERSION, 'sketchup' => Sketchup.version.to_s, 'platform' => RUBY_PLATFORM, 'ruby' => RUBY_VERSION,
              'saved_at' => Time.now.strftime('%Y-%m-%d %H:%M:%S'), 'errors' => @mem,
              'selftest' => (@selftest || []).last(160),
              'abf_ops' => Core::AbfRules.ops, 'abf_settings' => Core::AbfRules.settings,
              'cam' => cam.reject { |k, _| k == 'count_rules' } }
          end

          def write_diag(model)
            model.set_attribute(DIAG_DICT, 'info', JSON.generate(diag_data))
          rescue StandardError => e
            log('ghi chẩn đoán', e) rescue nil
          end

          # ---- thông báo (có chế độ im lặng cho tự kiểm tra)
          def quiet
            @quiet += 1
            yield
          ensure
            @quiet -= 1
          end

          def quiet?; @quiet > 0; end

          def msgbox(msg, type = nil, title = nil)
            if quiet?
              @captured << msg.to_s
              return (defined?(IDYES) ? IDYES : 6)
            end
            args = [msg.to_s]
            args << type unless type.nil?
            args << title.to_s unless title.nil?
            UI.messagebox(*args)
          end

          def notify(msg) msgbox(msg) end

          def take_captured
            c = @captured
            @captured = []
            c
          end

          # Báo lỗi bất ngờ: mỗi vị trí tối đa 1 lần / 30 giây.
          def report_once(where, e)
            now = Time.now.to_f
            return if @shown[where] && now - @shown[where] < 30
            @shown[where] = now
            msgbox("Plugin gặp lỗi khi #{where}:\n#{e.message}\n\nChi tiết đã ghi vào:\n#{log_path}\nBạn gửi file này để được sửa.")
          end

          # Bao một thao tác. Lỗi dữ liệu người dùng (ValidationError/OpError) chỉ hiện thông báo; lỗi khác ghi nhật ký.
          def guard(where, silent: false, default: nil)
            yield
          rescue Core::ValidationError, OpError => e
            msgbox(e.message) unless silent
            default
          rescue StandardError, ScriptError => e
            log(where, e)
            report_once(where, e) unless silent
            default
          end

          # ---- công cụ chuột
          def tool_error(tool, cb, e)
            log("công cụ #{tool.class.name.to_s.split('::').last}##{cb}", e)
            n = (tool.instance_variable_get(:@__hl_errs) || 0) + 1
            tool.instance_variable_set(:@__hl_errs, n)
            if QUIET_CB.include?(cb)
              report_once("dùng công cụ #{tool.class.name.to_s.split('::').last}", e) if n == 1 && !@shown.key?("tool-#{tool.object_id}")
              @shown["tool-#{tool.object_id}"] = Time.now.to_f
            else
              report_once("thao tác #{cb} của #{tool.class.name.to_s.split('::').last}", e)
            end
            if n >= MAX_TOOL_ERRORS
              begin
                Sketchup.active_model.select_tool(nil)
              rescue StandardError
                nil
              end
              msgbox("Công cụ gặp lỗi nhiều lần nên đã tắt. Chi tiết: #{log_path}")
            end
          end

          def protect_tool(klass)
            return if klass.instance_variable_get(:@__hl_protected)
            klass.instance_variable_set(:@__hl_protected, true)
            wrapper = Module.new
            TOOL_CB.each do |cb|
              next unless klass.method_defined?(cb)
              dflt = TOOL_DEFAULT[cb]
              wrapper.send(:define_method, cb) do |*a, &b|
                begin
                  super(*a, &b)
                rescue Core::ValidationError, OpError => e
                  Safe.msgbox(e.message)
                  dflt
                rescue StandardError, ScriptError => e
                  Safe.tool_error(self, cb, e)
                  dflt
                end
              end
            end
            klass.prepend(wrapper)
          end

          def default_dir
            m = Sketchup.active_model
            p = m && m.path.to_s
            return File.dirname(p) if p && !p.empty? && File.directory?(File.dirname(p))
            desk = File.join(Dir.home, 'Desktop')
            File.directory?(desk) ? desk : Dir.home
          rescue StandardError
            Dir.home
          end

          def save_panel(title, filename)
            UI.savepanel(title, default_dir, filename)
          end

          def open_panel(title, filter)
            UI.openpanel(title, default_dir, filter)
          end
        end
      end
    end
  end
end
