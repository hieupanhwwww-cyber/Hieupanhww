# encoding: UTF-8
# Mô tả trường Thuộc tính theo loại đối tượng và áp dụng thay đổi (một lần Apply = một operation).
module HungLoan
  module TuModule
    module SU
      module Props
        C = Core
        T = Core::Templates
        M = Manager
        module_function

        def f(key, label, type, value, extra = {})
          { 'key' => key, 'label' => label, 'type' => type, 'value' => value }.merge(extra)
        end

        def ro(label, value) f('_', label, 'info', value) end

        # ------------------------------------------------------------ BỘ TỦ
        def assembly(asm)
          mods = Store.modules_in(asm)
          data = Store.asm_data(asm)
          names = mods.map { |m| p = Store.params(m); [p['id'], p['template_name']] }.to_h
          links = data['links'].map do |l|
            kind = { 'stack' => 'Xếp chồng (rộng+sâu)', 'kitchen' => 'Tủ bếp (chỉ rộng, căn mặt sau)' }[l['type']] || l['type']
            gap = data['gaps'] && data['gaps'][l['id']]
            "#{names[l['lower']]} ↔ #{names[l['upper']]}: #{kind}#{gap ? format(' · hở thực tế %.1f mm', gap) : ''}"
          end
          {
            'kind' => 'assembly', 'target' => "asm:#{Store.id(asm)}", 'title' => asm.name, 'scope' => 'Bộ tủ',
            'sections' => [
              { 'title' => 'Bộ tủ', 'fields' => [ro('Số module', mods.size), ro('Liên kết', links.empty? ? 'Không' : links.join("\n")),
                                                  ro('Tiết diện đã đánh dấu', data['sections']['marked'].size)] }
            ],
            'tools' => [%w[select_modules Chọn\ từng\ module], %w[fronts Tạo\ mặt\ trước], %w[cam Liên\ kết\ cam], %w[sections Quét\ tiết\ diện]],
            'apply' => false
          }
        end

        # ------------------------------------------------------------ MODULE
        def module(mod)
          p = Store.params(mod)
          tpl = T.find(p['template_id']) || {}
          b = M.build(p)
          secs = []
          dims = []
          if p['l']
            dims << f('la', 'Dài nhánh A (mm, từ góc ngoài phía sau)', 'mm', p['l']['la'])
            dims << f('lb', 'Dài nhánh B (mm, từ góc ngoài phía sau)', 'mm', p['l']['lb'])
            dims << f('d', 'Chiều sâu chung hai nhánh (mm)', 'mm', p['d'])
          else
            dims << f('w', 'Rộng (mm)', 'mm', p['w']) << f('d', 'Sâu (mm)', 'mm', p['d'])
          end
          dims << f('h', 'Cao (mm)', 'mm', p['h']) << f('t', 'Độ dày ván (mm)', 'mm', p['t']) << f('tb', 'Độ dày hậu (mm)', 'mm', p['tb'])
          secs << { 'title' => 'Kích thước', 'fields' => dims }
          if p['geometry'] == 'carcass'
            secs << { 'title' => 'Cấu tạo thân tủ', 'fields' => [
              f('top_joint', 'Nóc', 'enum', p['top_joint'], 'options' => T::JOINT_OPTS),
              f('bottom_joint', 'Đáy', 'enum', p['bottom_joint'], 'options' => T::JOINT_OPTS),
              f('back_mode', 'Kiểu hậu', 'enum', p['back']['mode'], 'options' => T::BACK_OPTS),
              f('back_scope', 'Phạm vi hậu', 'enum', p['back']['scope'], 'options' => [['whole', 'Hậu chung'], ['per_column', 'Riêng từng khoang đứng']]),
              f('back_setback', 'Lùi hậu (mm)', 'mm', p['back']['setback']),
              f('groove_depth', 'Sâu rãnh hậu (mm)', 'mm', p['back']['groove_depth']),
              f('corner_radius', 'Bo góc trước nóc/đáy/đợt (mm)', 'mm', p['round']['corner_r']),
              f('end_round', 'Bán kính đầu bo phải (mm, 0 = không)', 'mm', p['round']['end_r'])
            ] }
          end
          fr = p['front']
          if fr['type'] != 'open'
            ff = [f('front_enabled', 'Có mặt trước', 'bool', fr['enabled']),
                  f('front_mount', fr['type'] == 'doors' ? 'Kiểu cánh' : 'Kiểu mặt', 'enum', fr['mount'], 'options' => T::MOUNT_OPTS),
                  f('edge_gap', 'Khe biên (mm)', 'mm', fr['edge_gap']), f('mid_gap', 'Khe giữa cánh (mm)', 'mm', fr['mid_gap'])]
            if fr['type'] == 'doors'
              (b['zones'] || []).each_with_index do |z, i|
                cur = b['doors'].count { |d| d['zone'] == z['key'] }
                ff << f("door_count:#{z['key']}", "Số cánh khoang #{i + 1} (chia đều)", 'int', cur.zero? ? C::Builder.door_count(fr, z) : cur, 'min' => 1, 'max' => 6)
              end
            else
              ff << f('drawer_count', 'Số mặt ngăn kéo', 'int', fr['drawer_count'], 'min' => 1, 'max' => 8)
              ff << f('drawer_ratios', 'Tỷ lệ chiều cao (dưới → trên)', 'text', fr['drawer_ratios'].map { |x| x == x.round ? x.round : x }.join(','))
              ff << ro('Khe luồn tay trên mỗi mặt', "#{fr['handle_gap'].to_i} mm (cố định)")
            end
            secs << { 'title' => 'Mặt trước', 'fields' => ff }
          end
          if fr['type'] == 'doors'
            hs = p['hinges']
            secs << { 'title' => 'Bản lề (lỗ cốc trên cánh)', 'fields' => [
              f('hinges_enabled', 'Đánh dấu lỗ cốc', 'bool', hs['enabled']),
              f('hinge_preset', 'Bộ cấu hình', 'enum', hs['preset'], 'options' => Prefs.hinge_presets.map { |h| [h['name'], h['name']] }),
              f('split_policy', 'Khi cánh tự chia đôi', 'enum', hs['split_policy'],
                'options' => [['keep_and_add', 'Giữ bản lề còn phù hợp, bổ sung cánh mới'], ['recompute_all', 'Tính lại cho cả hai cánh']])
            ], 'preset_editor' => Prefs.hinge_preset(hs['preset']) }
          end
          if p['geometry'] == 'carcass' || p['geometry'].start_with?('l_')
            secs << { 'title' => 'Liên kết ngang Cam Minifix', 'fields' => [
              f('joints_enabled', 'Có liên kết cam', 'bool', p['joints']['enabled']),
              f('cam_preset', 'Preset', 'enum', p['joints']['preset'], 'options' => Prefs.cam_presets.map { |h| [h['name'], h['name']] }),
              ro('Số cạnh liên kết', b['joints'].count { |j| !j['deleted'] })
            ] }
          end
          if p['link_role'] == 'kitchen_upper' && (asm = M.asm_of(mod))
            data = Store.asm_data(asm)
            l = data['links'].find { |x| x['upper'] == p['id'] && x['type'] == 'kitchen' }
            gap = l && data['gaps'] && data['gaps'][l['id']]
            secs << { 'title' => 'Tủ bếp trên', 'fields' => [ro('Khoảng hở thực tế tới tủ dưới', gap ? format('%.1f mm', gap) : 'Chưa ghép'),
                                                           ro('Khoảng hở nhập lúc đặt', format('%.0f mm', p['upper_gap'].to_f))] }
          end
          warn_list = b['errors'].map { |e| "#{e['level'] == 'error' ? '⛔' : '⚠'} #{e['message']}" }
          {
            'kind' => 'module', 'target' => "mod:#{p['id']}", 'title' => p['template_name'],
            'scope' => M.asm_of(mod) ? 'Module trong bộ tủ' : 'Module', 'type_label' => T.type_label(p['module_type']),
            'sections' => secs, 'warnings' => warn_list, 'apply' => true,
            'tools' => [%w[fronts Tạo\ mặt\ trước], %w[partition Thêm\ vách], %w[shelf Thêm\ đợt], %w[drawer Đặt\ thùng],
                        %w[hinge_auto Bản\ lề\ tự\ động], %w[hinge_manual Bản\ lề\ thủ\ công], %w[cam Liên\ kết\ cam]]
          }
        end

        # ------------------------------------------------------------ TẤM
        def panel(pg)
          mod = Store.parent_group(pg)
          p = Store.params(mod)
          b = M.build(p)
          lid = pg.get_attribute(Store::DICT, 'local_id')
          pn = b['panels'].find { |x| x['local_id'] == lid }
          return { 'kind' => 'none', 'message' => 'Tấm không còn trong tham số module' } unless pn
          secs = []
          info = [ro('Vai trò', pn['label']), ro('Kích thước', format('%.1f × %.1f × %.1f mm', pn['w'] || 0, pn['h'] || 0, pn['t'])),
                  ro('Thao tác gia công', pn['features'].size)]
          secs << { 'title' => 'Tấm', 'fields' => info }
          if (dv = b['dividers'].find { |d| d['id'] == lid })
            node = b['nodes'][dv['node']]
            a = dv['axis'] == 'x' ? node['x0'] : node['z0']
            secs << { 'title' => dv['axis'] == 'x' ? 'Vị trí vách' : 'Vị trí đợt', 'fields' => [
              f('div_dist', dv['axis'] == 'x' ? 'Khoảng cách mặt trong trái khoang → mặt trái vách (mm)' : 'Khoảng cách mặt trong dưới → mặt dưới đợt (mm)', 'mm', (dv['lo'] - a).round(2))
            ], 'note' => 'Có thể Move trực tiếp; đổi kích thước thùng thì vị trí theo tỷ lệ ban đầu.' }
          end
          if pn['role'] == 'door'
            hd = (p['hinges']['doors'] || {})[lid] || {}
            side = hd['side'] || C::Hinges.default_side_for(b['doors'], b['doors'].index { |d| d['local_id'] == lid } || 0)
            secs << { 'title' => 'Bản lề cánh này', 'fields' => [
              f('hinge_side', 'Bên bản lề', 'enum', side, 'options' => [['left', 'Trái'], ['right', 'Phải']]),
              f('hinge_mode', 'Cách tính', 'enum', hd['mode'] || 'auto', 'options' => [['auto', 'Tự động theo chiều cao'], ['manual', 'Thủ công (click đặt)']]),
              f('on_resize', 'Khi đổi chiều cao cánh (thủ công)', 'enum', hd['on_resize'] || 'keep_edge',
                'options' => [['keep_edge', 'Giữ khoảng cách tới mép gần nhất'], ['proportional', 'Theo tỷ lệ chiều cao'], ['recompute', 'Tính lại theo quy tắc tự động']]),
              ro('Vị trí lỗ cốc (mm từ đáy cánh)', pn['features'].select { |x| x['op'] == 'hinge_cup' }.map { |x| "#{x['pos'][1].round(1)}#{x['shifted'] ? '*' : ''}" }.join(', ') + ' (* = đã dịch tránh đợt)')
            ] }
          end
          if pn['drawer'] && (dr = p['drawers'].find { |d| d['id'] == pn['drawer'] })
            box = b['boxes'].find { |x| x['id'] == dr['id'] }
            secs << { 'title' => 'Thùng ngăn kéo (ray bi hai bên)', 'fields' => [
              f('dr_height', 'Chiều cao thùng (mm)', 'mm', dr['height']),
              f('dr_rail', 'Chiều dài ray = sâu ngoài thùng (mm)', 'enum', dr['rail_length'].to_f, 'options' => C::Config::RAIL_LENGTHS.map { |x| [x.to_f, "#{x} mm"] }),
              f('dr_bottom', 'Đáy thùng cách đáy lòng khoang (mm)', 'mm', dr['bottom']),
              ro('Rộng ngoài thùng', box ? format('%.1f mm (lọt lòng − 2 × %.0f)', box['outer_w'], dr['clearance']) : '—')
            ] }
          end
          js = b['joints'].select { |j| [j['a'], j['b']].include?(lid) }
          if p['joints']['enabled'] && js.any?
            jf = []
            js.each do |j|
              k = j['id']
              jf << ro("Cam #{j['a']} → #{j['b']}", format('dài %.0f mm%s', j['length'], j['deleted'] ? ' · đã xóa' : ''))
              jf << f("joint_pos:#{k}", 'Vị trí (mm từ đầu cạnh, cách dấu phẩy; trống = tự chia)', 'text',
                      j['manual'] ? j['positions'].map { |q| (q - j['line'][0]).round(1) }.join(',') : '')
              jf << f("joint_flip:#{k}", 'Đổi mặt đặt cam', 'bool', (p['joints']['overrides'][k] || {})['flip'] ? true : false)
              jf << f("joint_del:#{k}", 'Xóa liên kết này', 'bool', j['deleted'])
            end
            secs << { 'title' => 'Liên kết cam của tấm', 'fields' => jf }
          end
          {
            'kind' => 'panel', 'target' => "pnl:#{p['id']}/#{lid}", 'title' => "#{pn['label']} — #{p['template_name']}",
            'scope' => 'Tấm', 'sections' => secs, 'apply' => secs.size > 1, 'tools' => [%w[copy_divider Sao\ chép\ vách/đợt]]
          }
        end

        # ------------------------------------------------------------ ÁP DỤNG
        def num(v, label)
          x = C::Util.num(v)
          raise C::ValidationError.new("#{label}: cần nhập số", label) if x.nil?
          x
        end

        def apply(e, vals)
          if Store.module?(e) then apply_module(e, vals)
          elsif Store.panel?(e) then apply_panel(e, vals)
          end
        end

        def apply_module(mod, v)
          M.update_module_params(mod, 'Áp dụng thuộc tính') do |p|
            %w[w d h t tb].each { |k| p[k] = num(v[k], k) if v.key?(k) }
            if p['l']
              p['l']['la'] = num(v['la'], 'la') if v.key?('la')
              p['l']['lb'] = num(v['lb'], 'lb') if v.key?('lb')
              p['w'] = p['l']['la']
            end
            p['front']['t'] = p['t'] if v.key?('t')
            %w[top_joint bottom_joint].each { |k| p[k] = v[k] if %w[inset overlay].include?(v[k]) }
            p['back']['mode'] = v['back_mode'] if %w[overlay inset groove].include?(v['back_mode'])
            p['back']['scope'] = v['back_scope'] if %w[whole per_column].include?(v['back_scope'])
            p['back']['setback'] = num(v['back_setback'], 'back_setback') if v.key?('back_setback')
            p['back']['groove_depth'] = num(v['groove_depth'], 'groove_depth') if v.key?('groove_depth')
            p['round']['corner_r'] = num(v['corner_radius'], 'corner_radius') if v.key?('corner_radius')
            p['round']['end_r'] = num(v['end_round'], 'end_round') if v.key?('end_round')
            fr = p['front']
            fr['enabled'] = v['front_enabled'] == true if v.key?('front_enabled')
            fr['mount'] = v['front_mount'] if %w[overlay inset].include?(v['front_mount'])
            fr['edge_gap'] = num(v['edge_gap'], 'edge_gap') if v.key?('edge_gap')
            fr['mid_gap'] = num(v['mid_gap'], 'mid_gap') if v.key?('mid_gap')
            v.each do |k, val|
              next unless k.start_with?('door_count:')
              n = num(val, 'Số cánh').to_i
              raise C::ValidationError, 'Số cánh phải từ 1 đến 6' unless n.between?(1, 6)
              fr['door_counts'][k.sub('door_count:', '')] = n
            end
            if v.key?('drawer_count') || v.key?('drawer_ratios')
              n = num(v['drawer_count'] || fr['drawer_count'], 'drawer_count').to_i
              rs = (v['drawer_ratios'] || fr['drawer_ratios'].join(',')).to_s.split(/[,;\s]+/).map { |x| C::Util.num(x) }
              raise C::ValidationError.new('Tỷ lệ chiều cao phải là các số dương', 'drawer_ratios') if rs.any? { |x| x.nil? || x <= 0 }
              rs = Array.new(n, 1.0) if rs.size != n && v.key?('drawer_count') && !v.key?('drawer_ratios')
              raise C::ValidationError.new("Cần #{n} tỷ lệ chiều cao", 'drawer_ratios') if rs.size != n
              fr['drawer_count'] = n; fr['drawer_ratios'] = rs
            end
            p['hinges']['enabled'] = v['hinges_enabled'] == true if v.key?('hinges_enabled')
            p['hinges']['preset'] = v['hinge_preset'] if v['hinge_preset']
            p['hinges']['split_policy'] = v['split_policy'] if %w[keep_and_add recompute_all].include?(v['split_policy'])
            p['joints']['enabled'] = v['joints_enabled'] == true if v.key?('joints_enabled')
            p['joints']['preset'] = v['cam_preset'] if v['cam_preset']
            p
          end
        end

        def apply_panel(pg, v)
          mod = Store.parent_group(pg)
          lid = pg.get_attribute(Store::DICT, 'local_id')
          M.update_module_params(mod, 'Áp dụng thuộc tính tấm') do |p|
            if v.key?('div_dist')
              b = M.build(p)
              dv = b['dividers'].find { |d| d['id'] == lid }
              p = Actions.set_divider_distance(p, lid, num(v['div_dist'], 'Khoảng cách'), 'start') if dv
            end
            if v.key?('hinge_side') || v.key?('hinge_mode') || v.key?('on_resize')
              p['hinges']['doors'] ||= {}
              d = p['hinges']['doors'][lid] ||= { 'manual' => [] }
              d['side'] = v['hinge_side'] if %w[left right].include?(v['hinge_side'])
              d['mode'] = v['hinge_mode'] if %w[auto manual].include?(v['hinge_mode'])
              d['on_resize'] = v['on_resize'] if %w[keep_edge proportional recompute].include?(v['on_resize'])
              p['hinges']['enabled'] = true
            end
            if (dr = p['drawers'].find { |x| lid.start_with?("#{x['id']}:") })
              dr['height'] = num(v['dr_height'], 'Chiều cao thùng') if v.key?('dr_height')
              dr['rail_length'] = num(v['dr_rail'], 'Ray') if v.key?('dr_rail')
              dr['bottom'] = num(v['dr_bottom'], 'Vị trí đáy') if v.key?('dr_bottom')
            end
            v.each do |k, val|
              next unless k =~ /\Ajoint_(pos|flip|del):(.+)\z/
              kind = Regexp.last_match(1); key = Regexp.last_match(2)
              o = (p['joints']['overrides'][key] ||= {})
              case kind
              when 'flip' then o['flip'] = val == true
              when 'del' then o['deleted'] = val == true
              when 'pos'
                list = val.to_s.split(/[,;\s]+/).reject(&:empty?).map { |x| C::Util.num(x) }
                raise C::ValidationError, 'Vị trí cam phải là số mm' if list.any?(&:nil?)
                o['positions'] = list.map { |x| { 'anchor' => 'start', 'dist' => x } }
                o.delete('positions') if list.empty?
              end
            end
            p
          end
        end

        def save_hinge_preset(d)
          h = d['preset'] || {}
          name = h['name'].to_s.strip
          raise C::ValidationError, 'Bộ cấu hình cần có tên' if name.empty?
          num_keys = %w[diameter depth edge_offset end_offset shelf_clearance min_spacing]
          clean = { 'name' => name, 'demo' => false }
          num_keys.each do |k|
            x = C::Util.num(h[k])
            raise C::ValidationError.new("#{k}: cần số dương", k) if x.nil? || x <= 0
            clean[k] = x
          end
          raise C::ValidationError, 'Độ sâu cốc phải nhỏ hơn độ dày cánh' if clean['depth'] >= 25
          th = h['thresholds'].to_s.split(/[;\n]+/).map { |row| a, b = row.split(/[:=,]/).map { |x| C::Util.num(x) }; [a, b] }
          raise C::ValidationError, 'Ngưỡng dạng "900:2; 1600:3; ..."' if th.empty? || th.any? { |a, b| a.nil? || b.nil? || b < 1 }
          clean['thresholds'] = th.sort_by(&:first).map { |a, b| [a, b.to_i] }
          list = Prefs.hinge_presets.reject { |x| x['name'] == name }
          Prefs.save_hinge_presets(list + [clean])
        end
      end
    end
  end
end
