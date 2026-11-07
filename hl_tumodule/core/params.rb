# encoding: UTF-8
# Tham số instance module: dựng từ template + bộ setting mẫu, kiểm tra hợp lệ, migration.
require_relative 'util'
require_relative 'config'
require_relative 'templates'

module HungLoan
  module TuModule
    module Core
      module Params
        SCHEMA = Config::SCHEMA_VERSION
        module_function

        # Kiểm tra bộ setting theo schema trường của template. Trả [giá trị sạch, {key => lỗi}].
        def clean_settings(tpl, values)
          out = {}
          errs = {}
          (tpl['fields'] || []).each do |fd|
            k = fd['key']
            raw = values.key?(k) ? values[k] : tpl['defaults'][k]
            case fd['type']
            when 'mm', 'int'
              v = Util.num(raw)
              if v.nil?
                errs[k] = 'Cần nhập số'
                next
              end
              v = v.round if fd['type'] == 'int'
              if fd['min'] && v < fd['min']
                errs[k] = "Tối thiểu #{fd['min']}"
              elsif fd['max'] && v > fd['max']
                errs[k] = "Tối đa #{fd['max']}"
              end
              out[k] = fd['type'] == 'int' ? v.to_i : v.to_f
            when 'enum'
              opts = fd['options'].map { |o| o[0] }
              v = opts.find { |o| o.to_s == raw.to_s }
              if v.nil?
                errs[k] = 'Giá trị không hợp lệ'
              else
                out[k] = v
              end
            when 'bool'
              out[k] = raw == true || raw.to_s == 'true'
            when 'ratios'
              parts = raw.to_s.split(/[,;\s]+/).reject(&:empty?).map { |x| Util.num(x) }
              if parts.empty? || parts.any? { |x| x.nil? || x <= 0 }
                errs[k] = 'Nhập các số dương, cách nhau dấu phẩy'
              else
                out[k] = parts.map { |x| x == x.round ? x.round.to_s : x.to_s }.join(',')
              end
            else
              out[k] = raw
            end
          end
          if out.key?('drawer_count') && out.key?('drawer_ratios') && errs.empty?
            n = out['drawer_ratios'].split(',').size
            errs['drawer_ratios'] = "Cần đúng #{out['drawer_count']} tỷ lệ (đang có #{n})" if n != out['drawer_count']
          end
          [out, errs]
        end

        # Dựng tham số instance. settings đã được clean.
        def build(tpl, settings, id)
          s = Util.deep_merge(tpl['defaults'], settings || {})
          t = s['t'] || Config::BOARD_T
          p = {
            'schema' => SCHEMA, 'id' => id, 'template_id' => tpl['id'], 'template_name' => tpl['name'],
            'module_type' => tpl['module_type'], 'geometry' => tpl['geometry'], 'link_role' => tpl['link_role'],
            'w' => s['w'], 'd' => s['d'], 'h' => s['h'], 't' => t, 'tb' => s['tb'] || Config::BACK_T,
            'top_joint' => s['top_joint'] || 'overlay', 'bottom_joint' => s['bottom_joint'] || 'inset',
            'back' => {
              'mode' => s['back_mode'] || 'groove', 'scope' => s['back_scope'] || 'whole',
              'setback' => s['back_setback'] || Config::BACK_SETBACK, 'groove_depth' => s['groove_depth'] || Config::GROOVE_DEPTH,
              'groove_tol' => Config::GROOVE_TOL, 'groove_clear' => Config::GROOVE_CLEAR
            },
            'round' => { 'corner_r' => s['corner_radius'].to_f, 'end_r' => s['end_round'].to_f, 'end_side' => 'right',
                         'side_r' => s['side_radius'].to_f },
            'interior' => { 'id' => 'cell_root', 'type' => 'leaf' },
            'front' => {
              'type' => tpl['front_rule'], 'enabled' => false, 'mount' => s['front_mount'] || 'overlay',
              't' => t, 'edge_gap' => s['edge_gap'] || Config::DOOR_EDGE_GAP, 'mid_gap' => s['mid_gap'] || Config::DOOR_MID_GAP,
              'door_counts' => {}, 'drawer_count' => (s['drawer_count'] || 3).to_i,
              'drawer_ratios' => (s['drawer_ratios'] || '1,1,1').to_s.split(',').map(&:to_f),
              'handle_gap' => Config::HANDLE_GAP
            },
            'hinges' => { 'enabled' => false, 'preset' => Config::HINGE_PRESET_DEMO['name'],
                          'split_policy' => 'keep_and_add', 'doors' => {} },
            'drawers' => [],
            'joints' => { 'enabled' => false, 'preset' => Config::CAM_PRESET_DEMO['name'], 'overrides' => {} },
            'suppressed' => [],
            'shelf_setback' => 0.0
          }
          if %w[l_two_box l_single].include?(tpl['geometry'])
            p['l'] = { 'la' => s['la'], 'lb' => s['lb'], 'orient' => s['l_orient'] || 'right' }
            p['w'] = s['la']
          end
          if tpl['geometry'] == 'drawer_box'
            p['box'] = { 'height' => s['box_height'], 'rail_length' => s['rail_length'], 'side_t' => s['box_side_t'],
                         'bottom_t' => s['box_bottom_t'], 'place_mode' => s['place_mode'], 'cluster_count' => s['cluster_count'] }
          end
          p['upper_gap'] = s['upper_gap'].to_f if s.key?('upper_gap')
          p
        end

        def migrate(p)
          p = Util.deep_copy(p)
          v = p['schema'].to_i
          if v < 1
            p['suppressed'] ||= []
            p['schema'] = 1
          end
          if v > SCHEMA
            raise ValidationError, "Dữ liệu module có schema #{v} mới hơn plugin (#{SCHEMA}). Hãy cập nhật plugin."
          end
          p
        end
      end
    end
  end
end
