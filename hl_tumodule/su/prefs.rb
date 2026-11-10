# encoding: UTF-8
# Dữ liệu người dùng ghi ở thư mục có quyền ghi (không ghi vào thư mục cài extension):
#  Windows: %APPDATA%/HungLoanTuModule ; macOS: ~/Library/Application Support/HungLoanTuModule
require 'json'
require 'fileutils'

module HungLoan
  module TuModule
    module SU
      module Prefs
        C = Core
        module_function

        def dir
          @dir ||= begin
            base = ENV['APPDATA'] && !ENV['APPDATA'].empty? ? ENV['APPDATA'] : File.join(Dir.home, 'Library', 'Application Support')
            d = File.join(base, 'HungLoanTuModule')
            FileUtils.mkdir_p(d)
            d
          end
        end

        def path(name) File.join(dir, name) end

        def read_json(name, default)
          p = path(name)
          return default unless File.exist?(p)
          JSON.parse(File.read(p, encoding: 'UTF-8'))
        rescue StandardError => e
          warn "[TuModule] Không đọc được #{name}: #{e.message}"
          default
        end

        # Ghi nguyên tử: ghi file tạm rồi đổi tên, tránh hỏng file khi lỗi giữa chừng.
        def write_json(name, data)
          p = path(name)
          tmp = "#{p}.tmp"
          File.write(tmp, JSON.pretty_generate(data), encoding: 'UTF-8')
          File.rename(tmp, p)
        end

        # ---- Thư viện
        def library
          @library ||= begin
            raw = read_json('library.json', nil)
            if raw
              cfg, dropped = C::Library.migrate(raw)
              @migration_notes = dropped
              cfg
            else
              C::Library.default_config
            end
          rescue C::ValidationError => e
            UI.messagebox("Cấu hình thư viện không dùng được (#{e.message}). Dùng cấu hình mặc định; file cũ được giữ lại.") if defined?(UI)
            FileUtils.cp(path('library.json'), path("library.broken.#{Time.now.to_i}.json")) rescue nil
            C::Library.default_config
          end
        end

        def migration_notes; @migration_notes || []; end

        def library=(cfg)
          write_json('library.json', cfg)
          @library = cfg
        end

        # ---- Bộ cấu hình bản lề (nhiều bộ) và preset cam
        def hinge_presets
          list = read_json('hinge_presets.json', nil)
          list = [C::Config::HINGE_PRESET_DEMO.dup] unless list.is_a?(Array) && list.any?
          list
        end

        def save_hinge_presets(list) write_json('hinge_presets.json', list) end

        def hinge_preset(name)
          hinge_presets.find { |h| h['name'] == name } || hinge_presets.first
        end

        def cam_presets
          list = read_json('cam_presets.json', nil)
          list = [C::Config::CAM_PRESET_DEMO.dup] unless list.is_a?(Array) && list.any?
          list
        end

        def save_cam_presets(list) write_json('cam_presets.json', list) end

        def cam_preset(name)
          cam_presets.find { |h| h['name'] == name } || cam_presets.first
        end

        def ctx_for(params)
          { 'hinge_preset' => hinge_preset((params['hinges'] || {})['preset']),
            'cam_preset' => cam_preset((params['joints'] || {})['preset']) }
        end

        # ---- Bảng tên layer/instance gia công (Cài đặt chung)
        def load_abf_ops
          raw = read_json('abf_ops.json', nil)
          cfg, errs = C::AbfRules.clean_ops(raw || {})
          C::AbfRules.ops = errs.empty? ? cfg : C::AbfRules::DEFAULT_OPS
        end

        def save_abf_ops(cfg)
          write_json('abf_ops.json', cfg)
          C::AbfRules.ops = cfg
        end

        # ---- Cấu hình làm việc (chế độ chọn, v.v.)
        def work
          @work ||= read_json('work.json', {})
        end

        def set_work(k, v)
          work[k] = v
          write_json('work.json', work)
        end
      end
    end
  end
end
