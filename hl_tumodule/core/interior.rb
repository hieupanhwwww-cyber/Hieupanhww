# encoding: UTF-8
# Cây chia khoang bên trong: vách (trục x) và đợt (trục z).
# Nút lá: {'id','type'=>'leaf'}
# Nút chia: {'id','type'=>'split','axis'=>'x'|'z','dividers'=>[{'id','ratio','t'}],'children'=>[...]}
# ratio = vị trí TIM tấm chia theo tỷ lệ trong khoảng lọt lòng của nút cha → đổi kích thước thùng
# thì vị trí theo tỷ lệ bố trí ban đầu, độ dày giữ nguyên.
require_relative 'util'
require_relative 'config'

module HungLoan
  module TuModule
    module Core
      module Interior
        module_function

        # Trả {'cells'=>[], 'dividers'=>[], 'nodes'=>{id=>span}, 'errors'=>[]}
        def resolve(tree, x0, x1, z0, z1)
          out = { 'cells' => [], 'dividers' => [], 'nodes' => {}, 'errors' => [] }
          walk(tree, x0, x1, z0, z1, nil, 0, out)
          out
        end

        def walk(node, x0, x1, z0, z1, parent_id, level, out)
          out['nodes'][node['id']] = { 'x0' => x0, 'x1' => x1, 'z0' => z0, 'z1' => z1, 'parent' => parent_id, 'level' => level }
          if node['type'] == 'leaf'
            out['cells'] << { 'id' => node['id'], 'x0' => x0, 'x1' => x1, 'z0' => z0, 'z1' => z1, 'level' => level }
            if x1 - x0 < Config::MIN_CELL - TOL || z1 - z0 < Config::MIN_CELL - TOL
              out['errors'] << { 'code' => 'CELL_TOO_SMALL', 'cell' => node['id'],
                                 'message' => format('Khoang quá nhỏ (%.1f × %.1f mm, tối thiểu %.0f mm)', x1 - x0, z1 - z0, Config::MIN_CELL) }
            end
            return
          end
          ax = node['axis']
          a, b = ax == 'x' ? [x0, x1] : [z0, z1]
          prev = a
          node['dividers'].each_with_index do |dv, i|
            c = a + dv['ratio'].to_f * (b - a)
            lo = c - dv['t'] / 2.0
            hi = c + dv['t'] / 2.0
            if lo < prev - TOL
              out['errors'] << { 'code' => 'DIVIDER_OVERLAP', 'divider' => dv['id'], 'message' => 'Tấm chia chồng lên tấm bên cạnh hoặc vượt khoang' }
            end
            cx0, cx1, cz0, cz1 = ax == 'x' ? [prev, lo, z0, z1] : [x0, x1, prev, lo]
            walk(node['children'][i], cx0, cx1, cz0, cz1, node['id'], level + 1, out)
            out['dividers'] << {
              'id' => dv['id'], 'axis' => ax, 'lo' => lo, 'hi' => hi, 'center' => c, 't' => dv['t'],
              'span' => ax == 'x' ? [z0, z1] : [x0, x1], 'node' => node['id'], 'index' => i, 'level' => level,
              'root_level' => parent_id.nil?
            }
            prev = hi
          end
          if prev > b + TOL
            out['errors'] << { 'code' => 'DIVIDER_OUTSIDE', 'message' => 'Tấm chia vượt ra ngoài khoang' }
          end
          lx0, lx1, lz0, lz1 = ax == 'x' ? [prev, b, z0, z1] : [x0, x1, prev, b]
          walk(node['children'].last, lx0, lx1, lz0, lz1, node['id'], level + 1, out)
        end

        def find_node(tree, id, parent = nil, &blk)
          return [tree, parent] if tree['id'] == id
          return nil if tree['type'] == 'leaf'
          tree['children'].each do |ch|
            r = find_node(ch, id, tree)
            return r if r
          end
          nil
        end

        def find_divider(tree)
          return nil unless tree
          stack = [tree]
          until stack.empty?
            n = stack.pop
            next if n['type'] == 'leaf'
            n['dividers'].each_with_index { |d, i| yield(n, d, i) }
            stack.concat(n['children'])
          end
        end

        def divider_owner(tree, div_id)
          found = nil
          find_divider(tree) { |n, d, i| found = [n, i] if d['id'] == div_id && found.nil? }
          found
        end

        # Chèn tấm chia vào lá cell_id tại TIM center (tọa độ module, mm). Trả cây mới (bản sao).
        def insert_divider(tree, spans, cell_id, axis, center, t, div_id)
          tree = Util.deep_copy(tree)
          leaf, parent = find_node(tree, cell_id)
          raise ValidationError, 'Không tìm thấy khoang' unless leaf && leaf['type'] == 'leaf'
          new_leaf = { 'id' => Util.new_id('cell'), 'type' => 'leaf' }
          if parent && parent['axis'] == axis
            sp = spans[parent['id']]
            a, b = axis == 'x' ? [sp['x0'], sp['x1']] : [sp['z0'], sp['z1']]
            idx = parent['children'].index { |c| c['id'] == cell_id }
            parent['children'].insert(idx + 1, new_leaf)
            parent['dividers'].insert(idx, { 'id' => div_id, 'ratio' => (center - a) / (b - a), 't' => t })
          else
            sp = spans[cell_id]
            a, b = axis == 'x' ? [sp['x0'], sp['x1']] : [sp['z0'], sp['z1']]
            old = { 'id' => leaf['id'], 'type' => 'leaf' }
            leaf.clear
            leaf['id'] = Util.new_id('node')
            leaf['type'] = 'split'
            leaf['axis'] = axis
            leaf['dividers'] = [{ 'id' => div_id, 'ratio' => (center - a) / (b - a), 't' => t }]
            leaf['children'] = [old, new_leaf]
          end
          tree
        end

        # Xóa tấm chia: gộp hai khoang hai bên. Khoang bên phải/trên có nội dung con sẽ bị bỏ (báo lại).
        def remove_divider(tree, div_id)
          tree = Util.deep_copy(tree)
          own = divider_owner(tree, div_id)
          return [tree, []] unless own
          node, i = own
          dropped = []
          left = node['children'][i]
          right = node['children'][i + 1]
          keep = if left['type'] == 'leaf' && right['type'] != 'leaf' then right
                 else
                   dropped << right['id'] if right['type'] != 'leaf'
                   left
                 end
          node['dividers'].delete_at(i)
          node['children'][i] = keep
          node['children'].delete_at(i + 1)
          if node['dividers'].empty?
            only = node['children'][0]
            node.clear
            node.merge!(only)
          end
          [tree, dropped]
        end

        def move_divider(tree, spans, div_id, new_center)
          tree = Util.deep_copy(tree)
          own = divider_owner(tree, div_id)
          raise ValidationError, 'Không tìm thấy tấm chia' unless own
          node, i = own
          sp = spans[node['id']]
          a, b = node['axis'] == 'x' ? [sp['x0'], sp['x1']] : [sp['z0'], sp['z1']]
          node['dividers'][i]['ratio'] = (new_center - a) / (b - a)
          tree
        end

        # Sao chép tấm chia: count bản, khoảng LỌT LÒNG clear giữa hai tấm (mặt thực).
        # Bước tim = clear + độ dày (vd 17 + 400 = 417). Trả [cây mới, [id mới]].
        def copy_divider(tree, spans, div_id, count, clear, direction = 1)
          raise ValidationError, 'Số bản sao phải ≥ 1' if count.to_i < 1
          raise ValidationError, 'Khoảng lọt lòng phải > 0' if clear.to_f <= 0
          res = resolve_spans_only(tree, spans)
          own = divider_owner(tree, div_id)
          raise ValidationError, 'Không tìm thấy tấm chia' unless own
          node, i = own
          sp = spans[node['id']]
          a, b = node['axis'] == 'x' ? [sp['x0'], sp['x1']] : [sp['z0'], sp['z1']]
          divs = res.select { |d| d['node'] == node['id'] }.sort_by { |d| d['index'] }
          me = divs[i]
          t = me['t']
          new_ids = []
          tree2 = Util.deep_copy(tree)
          n2, = divider_owner(tree2, div_id)
          if direction >= 0
            limit = i + 1 < divs.size ? divs[i + 1]['lo'] : b
            face = me['hi']
            count.to_i.times do |k|
              lo = face + clear
              hi = lo + t
              if hi > limit + TOL
                raise ValidationError, format('Không đủ chỗ cho bản sao %d: cần tới %.1f mm, giới hạn %.1f mm', k + 1, hi, limit)
              end
              nid = Util.new_id('div')
              idx = i + 1 + k
              n2['children'].insert(idx, { 'id' => Util.new_id('cell'), 'type' => 'leaf' })
              n2['dividers'].insert(idx, { 'id' => nid, 'ratio' => ((lo + hi) / 2.0 - a) / (b - a), 't' => t })
              new_ids << nid
              face = hi
            end
          else
            limit = i > 0 ? divs[i - 1]['hi'] : a
            face = me['lo']
            count.to_i.times do |k|
              hi = face - clear
              lo = hi - t
              raise ValidationError, format('Không đủ chỗ cho bản sao %d', k + 1) if lo < limit - TOL
              nid = Util.new_id('div')
              n2['children'].insert(i, { 'id' => Util.new_id('cell'), 'type' => 'leaf' })
              n2['dividers'].insert(i, { 'id' => nid, 'ratio' => ((lo + hi) / 2.0 - a) / (b - a), 't' => t })
              new_ids << nid
              face = lo
            end
          end
          [tree2, new_ids]
        end

        def resolve_spans_only(tree, spans)
          root = spans[tree['id']]
          resolve(tree, root['x0'], root['x1'], root['z0'], root['z1'])['dividers']
        end
      end
    end
  end
end
