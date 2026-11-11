# encoding: UTF-8
# Dữ liệu người dùng ghi ở thư mục có quyền ghi (không ghi vào thư mục cài extension):
#  Windows: %APPDATA%/HungLoanTuModule ; macOS: ~/Library/Application Support/HungLoanTuModule
require 'json'
require 'fileutils'
require 'tmpdir'

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
            begin
              FileUtils.mkdir_p(d)
              raise Errno::EACCES, d unless File.writable?(d)
            rescue StandardError
              d = File.join(Dir.tmpdir, 'HungLoanTuModule')
              FileUtils.mkdir_p(d)
            end
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
            Safe.msgbox("Cấu hình thư viện không dùng được (#{e.message}). Dùng cấu hình mặc định; file cũ được giữ lại.") if defined?(UI)
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
          # Bộ đã lưu còn nguyên số DEMO cũ (tâm cốc 24, cách đầu 50) → dùng số đo từ dự án ABF của xưởng (33 / 60).
          list.map do |h|
            h = C::Config::CAM_PRESET_DEMO.merge(h)
            if h['cam_offset'].to_f == 24.0 && h['end_setback'].to_f == 50.0
              h = h.merge('cam_offset' => C::Config::CAM_PRESET_DEMO['cam_offset'], 'end_setback' => C::Config::CAM_PRESET_DEMO['end_setback'])
            end
            h
          end
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
          raw = read_json('abf_ops.json', nil) || {}
          ops_raw = raw.key?('ops') ? raw['ops'] : raw # bản 1.3 lưu phẳng
          ops_raw = C::AbfRules.migrate_ops(ops_raw) unless raw['version'].to_i >= 2
          # Bản cũ có thể đã lưu tên nhóm cam trùng tên layer → trả về tên nhóm đúng của ABF.
          %w[cam_housing cam_bolt cam_edge_hole].each do |k|
            o = ops_raw[k]
            ops_raw[k] = C::AbfRules::DEFAULT_OPS[k].dup if o.is_a?(Hash) && o['instance'].to_s == o['layer'].to_s
          end
          cfg, errs = C::AbfRules.clean_ops(ops_raw)
          C::AbfRules.ops = errs.empty? ? cfg : C::AbfRules::DEFAULT_OPS
          st, serr = C::AbfRules.clean_settings(raw['settings'] || {})
          C::AbfRules.settings = serr.empty? ? st : C::AbfRules::DEFAULT_SETTINGS
        end

        def save_abf_ops(cfg, settings = nil)
          settings ||= C::AbfRules.settings
          write_json('abf_ops.json', { 'version' => 2, 'ops' => cfg, 'settings' => settings })
          C::AbfRules.ops = cfg
          C::AbfRules.settings = settings
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
