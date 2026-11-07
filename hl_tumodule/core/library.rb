# encoding: UTF-8
# Cấu hình thư viện người dùng (thuần Ruby, lưu JSON ở vị trí có quyền ghi do lớp SketchUp quyết định).
#  - folders: [{'id','name','parent'}]  (cây thư mục, có thư mục con)
#  - links:   [{'folder','template'}]   (quan hệ nhiều thư mục ↔ một ID mẫu, không trùng)
#  - settings:{template_id => {...}}     (MỘT bộ setting mặc định cho mỗi mẫu)
require 'json'
require_relative 'util'
require_relative 'templates'
require_relative 'params'

module HungLoan
  module TuModule
    module Core
      module Library
        SCHEMA = 1
        BACKUP_FORMAT = 'HLTM-LIBRARY-BACKUP'.freeze
        module_function

        def default_config
          folders = [
            { 'id' => 'f_khung', 'name' => 'Khung tủ', 'parent' => nil },
            { 'id' => 'f_bep', 'name' => 'Tủ bếp', 'parent' => nil },
            { 'id' => 'f_bep_L', 'name' => 'Chữ L', 'parent' => 'f_bep' },
            { 'id' => 'f_nk', 'name' => 'Ngăn kéo', 'parent' => nil },
            { 'id' => 'f_dac_biet', 'name' => 'Chữ L & bo cong', 'parent' => nil }
          ]
          map = {
            'f_khung' => %w[hl.khung_tu.v1 hl.cuc_tren.v1 hl.tu_hong.v1],
            'f_bep' => %w[hl.tu_bep_duoi.v1 hl.tu_bep_tren.v1],
            'f_bep_L' => %w[hl.tu_bep_L.v1],
            'f_nk' => %w[hl.tu_ngan_keo3.v1 hl.thung_ngan_keo.v1],
            'f_dac_biet' => %w[hl.tu_L_mot_thung.v1 hl.tu_dau_bo.v1 hl.tu_bep_L.v1]
          }
          links = map.flat_map { |f, ts| ts.map { |t| { 'folder' => f, 'template' => t } } }
          { 'schema' => SCHEMA, 'folders' => folders, 'links' => links, 'settings' => {} }
        end

        # ---- Truy vấn (CHỈ trả mẫu đã làm thông minh theo catalog plugin)
        def visible?(tid)
          t = Templates.find(tid)
          t && t['supported']
        end

        def card(tpl, cfg)
          {
            'id' => tpl['id'], 'name' => tpl['name'], 'module_type' => tpl['module_type'],
            'type_label' => Templates.type_label(tpl['module_type']), 'geometry' => tpl['geometry'],
            'anchor' => tpl['anchor']['label'], 'front_rule' => tpl['front_rule'],
            'folders' => cfg['links'].select { |l| l['template'] == tpl['id'] }.map { |l| l['folder'] },
            'customized' => cfg['settings'].key?(tpl['id'])
          }
        end

        def list_folder(cfg, folder_id)
          ids = if folder_id.nil? || folder_id == '__all__'
                  Templates.supported.map { |t| t['id'] }
                else
                  cfg['links'].select { |l| l['folder'] == folder_id }.map { |l| l['template'] }
                end
          ids.uniq.select { |id| visible?(id) }.map { |id| card(Templates.find(id), cfg) }
        end

        # Bộ lọc loại: TOÀN BỘ THƯ VIỆN, không phụ thuộc thư mục; mỗi ID mẫu một kết quả.
        def filter_type(cfg, type)
          Templates.supported.select { |t| type.nil? || type == '' || type == '__all__' || t['module_type'] == type }
                   .map { |t| card(t, cfg) }
        end

        # ---- Thư mục
        def add_folder(cfg, name, parent)
          name = name.to_s.strip
          raise ValidationError.new('Tên thư mục không được trống', 'name') if name.empty?
          raise ValidationError, 'Thư mục cha không tồn tại' if parent && !cfg['folders'].any? { |f| f['id'] == parent }
          c = Util.deep_copy(cfg)
          id = Util.new_id('f')
          c['folders'] << { 'id' => id, 'name' => name, 'parent' => parent }
          [c, id]
        end

        def rename_folder(cfg, id, name)
          name = name.to_s.strip
          raise ValidationError.new('Tên thư mục không được trống', 'name') if name.empty?
          c = Util.deep_copy(cfg)
          f = c['folders'].find { |x| x['id'] == id } or raise ValidationError, 'Không tìm thấy thư mục'
          f['name'] = name
          c
        end

        def descendants(cfg, id)
          kids = cfg['folders'].select { |f| f['parent'] == id }.map { |f| f['id'] }
          kids + kids.flat_map { |k| descendants(cfg, k) }
        end

        # Xóa thư mục + thư mục con: chỉ xóa quan hệ; mẫu, setting và module đã đặt giữ nguyên.
        def delete_folder(cfg, id)
          c = Util.deep_copy(cfg)
          gone = [id] + descendants(cfg, id)
          c['folders'].reject! { |f| gone.include?(f['id']) }
          c['links'].reject! { |l| gone.include?(l['folder']) }
          c
        end

        def add_to_folder(cfg, folder, tid)
          raise ValidationError, 'Thư mục không tồn tại' unless cfg['folders'].any? { |f| f['id'] == folder }
          raise ValidationError, 'Mẫu không thuộc thư viện đi kèm' unless visible?(tid)
          c = Util.deep_copy(cfg)
          c['links'] << { 'folder' => folder, 'template' => tid } unless c['links'].any? { |l| l['folder'] == folder && l['template'] == tid }
          c
        end

        def remove_from_folder(cfg, folder, tid)
          raise ValidationError, 'Cần chỉ rõ thư mục cần bỏ' if folder.nil? || folder == '' || folder == '__all__'
          c = Util.deep_copy(cfg)
          c['links'].reject! { |l| l['folder'] == folder && l['template'] == tid }
          c
        end

        # ---- Setting từng mẫu
        def settings_for(cfg, tid)
          tpl = Templates.find(tid) or raise ValidationError, 'Không tìm thấy mẫu'
          saved = cfg['settings'][tid] || {}
          vals, = Params.clean_settings(tpl, tpl['defaults'].merge(saved))
          vals
        end

        def original_settings(tid)
          tpl = Templates.find(tid) or raise ValidationError, 'Không tìm thấy mẫu'
          vals, = Params.clean_settings(tpl, tpl['defaults'])
          vals
        end

        # Lưu: thay toàn bộ bộ setting cũ của đúng mẫu. Lỗi → không lưu, trả lỗi theo trường.
        def save_settings(cfg, tid, values)
          tpl = Templates.find(tid) or raise ValidationError, 'Không tìm thấy mẫu'
          vals, errs = Params.clean_settings(tpl, values || {})
          return [cfg, errs] if errs.any?
          c = Util.deep_copy(cfg)
          c['settings'][tid] = vals
          [c, {}]
        end

        # ---- Migration cấu hình khi cập nhật plugin
        def migrate(cfg)
          c = Util.deep_copy(cfg)
          c['schema'] = c['schema'].to_i
          raise ValidationError, "Cấu hình schema #{c['schema']} mới hơn plugin" if c['schema'] > SCHEMA
          c['folders'] ||= []; c['links'] ||= []; c['settings'] ||= {}
          dropped = []
          c['settings'].keys.each do |tid|
            tpl = Templates.find(tid)
            unless tpl
              dropped << "setting mẫu #{tid} (mẫu không còn trong catalog)"
              c['settings'].delete(tid)
              next
            end
            keys = tpl['fields'].map { |f| f['key'] }
            (c['settings'][tid].keys - keys).each do |k|
              dropped << "trường #{k} của #{tpl['name']}"
              c['settings'][tid].delete(k)
            end
            vals, errs = Params.clean_settings(tpl, tpl['defaults'].merge(c['settings'][tid]))
            errs.each_key do |k|
              dropped << "giá trị #{k} của #{tpl['name']} không còn hợp lệ"
              c['settings'][tid].delete(k)
            end
            c['settings'][tid] = vals.select { |k, _| c['settings'][tid].key?(k) }
          end
          c['links'].select! { |l| Templates.find(l['template']) && c['folders'].any? { |f| f['id'] == l['folder'] } }
          c['schema'] = SCHEMA
          [c, dropped]
        end

        # ---- Sao lưu: xuất và NHẬP THAY TOÀN BỘ (không gộp)
        def export_backup(cfg, plugin_version)
          JSON.pretty_generate(
            'format' => BACKUP_FORMAT, 'schema' => SCHEMA, 'plugin_version' => plugin_version,
            'catalog' => Templates.all.map { |t| t['id'] },
            'folders' => cfg['folders'], 'links' => cfg['links'], 'settings' => cfg['settings']
          )
        end

        # Kiểm tra TOÀN BỘ file trước. Hợp lệ → trả cấu hình mới thay thế; không hợp lệ → raise, cấu hình cũ giữ nguyên.
        def import_backup(text)
          data = begin
            JSON.parse(text)
          rescue JSON::ParserError => e
            raise ValidationError, "File không phải JSON hợp lệ: #{e.message[0, 80]}"
          end
          raise ValidationError, 'File không phải bản sao lưu thư viện Tủ Module' unless data.is_a?(Hash) && data['format'] == BACKUP_FORMAT
          sch = data['schema']
          raise ValidationError, 'Thiếu phiên bản schema' unless sch.is_a?(Integer)
          raise ValidationError, "Bản sao lưu schema #{sch} mới hơn plugin (#{SCHEMA})" if sch > SCHEMA
          %w[folders links settings].each do |k|
            want = k == 'settings' ? Hash : Array
            raise ValidationError, "Trường #{k} sai kiểu dữ liệu" unless data[k].is_a?(want)
          end
          ids = {}
          data['folders'].each_with_index do |f, i|
            raise ValidationError, "Thư mục ##{i + 1} sai cấu trúc" unless f.is_a?(Hash) && f['id'].is_a?(String) && f['name'].is_a?(String) && !f['name'].strip.empty?
            raise ValidationError, "Trùng ID thư mục #{f['id']}" if ids[f['id']]
            ids[f['id']] = f
          end
          data['folders'].each do |f|
            next if f['parent'].nil?
            raise ValidationError, "Thư mục #{f['name']} trỏ tới thư mục cha không tồn tại" unless ids[f['parent']]
            seen = {}
            cur = f
            while cur && cur['parent']
              raise ValidationError, "Cây thư mục bị vòng lặp tại #{f['name']}" if seen[cur['id']]
              seen[cur['id']] = true
              cur = ids[cur['parent']]
            end
          end
          pairs = {}
          data['links'].each do |l|
            raise ValidationError, 'Quan hệ thư mục–mẫu sai cấu trúc' unless l.is_a?(Hash) && l['folder'].is_a?(String) && l['template'].is_a?(String)
            raise ValidationError, "Quan hệ trỏ tới thư mục không tồn tại (#{l['folder']})" unless ids[l['folder']]
            raise ValidationError, "Mẫu #{l['template']} không có trong catalog plugin này" unless Templates.find(l['template'])
            pairs[[l['folder'], l['template']]] = true
          end
          settings = {}
          data['settings'].each do |tid, vals|
            tpl = Templates.find(tid) or raise ValidationError, "Setting cho mẫu #{tid} không có trong catalog plugin này"
            raise ValidationError, "Setting #{tpl['name']} sai kiểu" unless vals.is_a?(Hash)
            unknown = vals.keys - tpl['fields'].map { |fd| fd['key'] }
            raise ValidationError, "Setting #{tpl['name']} có trường không dùng được: #{unknown.join(', ')}" if unknown.any?
            clean, errs = Params.clean_settings(tpl, tpl['defaults'].merge(vals))
            if errs.any?
              k, m = errs.first
              raise ValidationError, "Setting #{tpl['name']} – #{k}: #{m}"
            end
            settings[tid] = clean.select { |k, _| vals.key?(k) }
          end
          {
            'schema' => SCHEMA,
            'folders' => data['folders'].map { |f| { 'id' => f['id'], 'name' => f['name'].strip, 'parent' => f['parent'] } },
            'links' => pairs.keys.map { |f, t| { 'folder' => f, 'template' => t } },
            'settings' => settings
          }
        end
      end
    end
  end
end
