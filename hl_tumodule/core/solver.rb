# encoding: UTF-8
# Bộ giải liên kết module trong một bộ tủ (assembly). Giải MỘT LẦN theo nhóm biến, không vòng lặp observer.
#  - 'stack'   (cục dưới ↔ cục trên xếp chồng): RỘNG + SÂU liên kết hai chiều; cao độc lập; cục trên nằm trên nóc cục dưới.
#  - 'kitchen' (tủ bếp dưới ↔ tủ bếp trên): CHỈ RỘNG liên kết hai chiều; sâu độc lập; căn thẳng mặt sau;
#               cao độ tủ trên GIỮ NGUYÊN khi đổi cao tủ dưới, khoảng hở được tính lại.
#  - 'side'    (tủ hông): chỉ bắt điểm lúc đặt, không duy trì liên kết kích thước/vị trí.
# mods: {id => {'w','d','h','pos'=>[x,y,z],'rot'=>deg,'geometry'}} — pos là gốc module trong hệ assembly (mm).
require_relative 'util'
require_relative 'geom'

module HungLoan
  module TuModule
    module Core
      module Solver
        G = Geom
        module_function

        class UF
          def initialize; @p = {}; end
          def find(x)
            @p[x] ||= x
            @p[x] == x ? x : (@p[x] = find(@p[x]))
          end
          def union(a, b); @p[find(a)] = find(b); end
          def groups(keys); keys.group_by { |k| find(k) }.values; end
        end

        # changes: {id => {'w'=>..,'d'=>..,'h'=>..}} đã áp vào mods hay chưa đều được (sẽ áp).
        # Trả {'mods'=>..., 'errors'=>[], 'gaps'=>{link_id=>mm}, 'changed'=>[ids]}
        def solve(mods_in, links, changes = {})
          mods = Util.deep_copy(mods_in)
          errors = []
          changes.each do |id, ch|
            next unless mods[id]
            ch.each { |k, v| mods[id][k] = v.to_f if %w[w d h].include?(k) }
          end
          before = Util.deep_copy(mods_in)
          uw = UF.new; ud = UF.new
          links.each do |l|
            next unless mods[l['lower']] && mods[l['upper']]
            case l['type']
            when 'stack' then uw.union(l['lower'], l['upper']); ud.union(l['lower'], l['upper'])
            when 'kitchen' then uw.union(l['lower'], l['upper'])
            end
          end
          [[uw, 'w'], [ud, 'd']].each do |uf, key|
            uf.groups(mods.keys).each do |grp|
              next if grp.size < 2
              src = grp.select { |id| changes[id] && changes[id].key?(key) }
              vals = src.map { |id| mods[id][key] }.uniq
              if vals.size > 1
                errors << { 'code' => 'LINK_CONFLICT', 'message' => "Hai module liên kết bị đặt hai giá trị #{key} khác nhau cùng lúc" }
                next
              end
              roots = grp.reject { |id| links.any? { |l| l['upper'] == id && grp.include?(l['lower']) } }
              v = vals.first || mods[(roots.first || grp.first)][key]
              grp.each { |id| mods[id][key] = v }
            end
          end
          gaps = {}
          order = topo(links, mods)
          order.each do |l|
            lo = mods[l['lower']]; up = mods[l['upper']]
            case l['type']
            when 'stack'
              up['rot'] = lo['rot']
              up['pos'] = G.place_point(lo['pos'], lo['rot'], [0.0, 0.0, lo['h']])
            when 'kitchen'
              up['rot'] = lo['rot']
              np = G.place_point(lo['pos'], lo['rot'], [0.0, lo['d'] - up['d'], 0.0])
              up['pos'] = [np[0], np[1], up['pos'][2]]
              gap = up['pos'][2] - (lo['pos'][2] + lo['h'])
              gaps[l['id']] = gap
              if gap < -TOL
                errors << { 'code' => 'KITCHEN_GAP_NEGATIVE', 'link' => l['id'],
                            'message' => format('Tủ bếp dưới cao lên làm giao tủ trên %.1f mm. Giảm chiều cao hoặc nâng tủ trên bằng tay.', -gap) }
              end
            end
          end
          changed = mods.keys.select { |id| mods[id] != before[id] }
          { 'mods' => mods, 'errors' => errors, 'gaps' => gaps, 'changed' => changed }
        end

        def topo(links, mods)
          ls = links.select { |l| mods[l['lower']] && mods[l['upper']] && %w[stack kitchen].include?(l['type']) }
          out = []
          done = {}
          uppers = ls.map { |l| l['upper'] }
          (ls.size + 1).times do
            ls.each do |l|
              next if done[l['id']]
              # cục dưới phải đã ổn định (không phải upper của link chưa xử lý)
              pending = ls.any? { |m| !done[m['id']] && m['upper'] == l['lower'] }
              next if pending
              out << l
              done[l['id']] = true
            end
          end
          out + (ls - out) # vòng lặp bất thường: vẫn xử lý một lần, không lặp
        end

        # Scale native cả bộ: chiều cao từng cục theo tỷ lệ; độ dày tấm do builder giữ.
        def scale_assembly(mods_in, links, sx, sy, sz)
          mods = Util.deep_copy(mods_in)
          mods.each_value do |m|
            m['pos'] = [m['pos'][0] * sx, m['pos'][1] * sy, m['pos'][2] * sz]
            r = m['rot'].to_i % 180
            fx, fy = r == 90 ? [sy, sx] : [sx, sy]
            if m['geometry'].to_s.start_with?('l_')
              m['la'] = m['la'].to_f * fx if m['la']
              m['lb'] = m['lb'].to_f * fy if m['lb']
              m['w'] = m['la'] if m['la']
            else
              m['w'] *= fx
              m['d'] *= fy
            end
            m['h'] *= sz
          end
          res = solve(mods, links, {})
          res['changed'] = mods_in.keys
          res
        end

        # Move cục dưới: kéo cục trên (xếp chồng) đi cùng. Tủ bếp: kéo theo x/y, giữ cao độ (giả định).
        def drag(mods_in, links, id, delta)
          mods = Util.deep_copy(mods_in)
          moved = []
          queue = [id]
          until queue.empty?
            cur = queue.shift
            links.each do |l|
              next unless l['lower'] == cur && mods[l['upper']]
              up = mods[l['upper']]
              dz = l['type'] == 'stack' ? delta[2] : 0.0
              up['pos'] = [up['pos'][0] + delta[0], up['pos'][1] + delta[1], up['pos'][2] + dz]
              moved << l['upper']
              queue << l['upper'] if l['type'] == 'stack'
            end
          end
          [mods, moved.uniq]
        end
      end
    end
  end
end
