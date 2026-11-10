# encoding: UTF-8
# Sinh danh sách tấm (chi tiết có tham số) từ tham số module. Hệ trục module:
# x = rộng (trái→phải), y = sâu (mặt trước y=0 → mặt sau), z = cao; gốc = góc trái-trước-dưới.
# Khung tấm: u,v trong mặt tấm, n pháp tuyến; mặt A ở w = t, mặt B ở w = 0.
require_relative 'util'
require_relative 'config'
require_relative 'geom'
require_relative 'interior'
require_relative 'hinges'
require_relative 'joints'

module HungLoan
  module TuModule
    module Core
      module Builder
        G = Geom
        C = Config
        module_function

        def box_panel(id, role, x0, x1, y0, y1, z0, z1, orient, extra = {})
          case orient
          when :x
            f = G.frame([x0, y0, z0], [0, 1, 0], [0, 0, 1], [1, 0, 0]); w = y1 - y0; h = z1 - z0; t = x1 - x0
          when :z
            f = G.frame([x0, y0, z0], [1, 0, 0], [0, 1, 0], [0, 0, 1]); w = x1 - x0; h = y1 - y0; t = z1 - z0
          when :y
            f = G.frame([x0, y1, z0], [1, 0, 0], [0, 0, 1], [0, -1, 0]); w = x1 - x0; h = z1 - z0; t = y1 - y0
          end
          {
            'id' => id, 'local_id' => id, 'role' => role, 'label' => C::ROLE_LABELS[role] || role, 'kind' => 'flat',
            't' => t, 'w' => w, 'h' => h, 'frame' => f, 'outline' => G.rect_outline(w, h), 'features' => []
          }.merge(extra)
        end

        # Đường bao tấm ngang (nóc/đáy/đợt) trong mặt bằng, có bo góc trước và đầu bo phải.
        # Trả đường bao theo tọa độ local (u = x - x0, v = y - y0).
        def plan_outline(x0, x1, y0, y1, corner_r, endr)
          w = x1 - x0; h = y1 - y0
          rl = corner_r; rr = corner_r
          if endr
            cx, cy, r = endr
            if (x1 - (cx + r)).abs < TOL && (y0 - (cy - r)).abs < TOL
              return G.rounded_rect_outline(w, h, 'bl' => rl, 'br' => r, 'tr' => 0, 'tl' => 0)
            end
            # Tấm lọt bên trong vỏ uốn: bậc ở mép trước rồi cung bán kính trong.
            o = [{ 't' => 'L', 'p' => [rl, 0.0] }]
            o << { 't' => 'L', 'p' => [cx - x0, 0.0] }
            o << { 't' => 'L', 'p' => [cx - x0, cy - r - y0] } if cy - r - y0 > 1e-6
            o << { 't' => 'A', 'c' => [cx - x0, cy - y0], 'r' => r, 'a0' => -90.0, 'a1' => 0.0 }
            o << { 't' => 'L', 'p' => [w, h] }
            o << { 't' => 'L', 'p' => [0.0, h] }
            if rl > 0
              o << { 't' => 'L', 'p' => [0.0, rl] }
              o << { 't' => 'A', 'c' => [rl, rl], 'r' => rl, 'a0' => 180.0, 'a1' => 270.0 }
            else
              o[0] = { 't' => 'L', 'p' => [0.0, 0.0] }
            end
            return o
          end
          G.rounded_rect_outline(w, h, 'bl' => rl, 'br' => rr, 'tr' => 0, 'tl' => 0)
        end

        def horiz_panel(id, role, x0, x1, y0, y1, z0, z1, corner_r, endr)
          pnl = box_panel(id, role, x0, x1, y0, y1, z0, z1, :z)
          pnl['outline'] = plan_outline(x0, x1, y0, y1, corner_r, endr) if corner_r > 0 || endr
          pnl
        end

        def err(list, code, msg, extra = {})
          list << { 'code' => code, 'level' => 'error', 'message' => msg }.merge(extra)
        end

        # ----------------------------------------------------------- KHUNG TỦ
        def carcass(p, opts = {})
          errors = []
          w = p['w'].to_f; d = p['d'].to_f; h = p['h'].to_f; t = p['t'].to_f; tb = p['tb'].to_f
          bk = p['back']; mode = bk['mode']; sb = bk['setback'].to_f; gd = bk['groove_depth'].to_f
          gtol = bk['groove_tol'].to_f; gclr = bk['groove_clear'].to_f
          scope = bk['scope'] || 'whole'
          top_ov = p['top_joint'] == 'overlay'; bot_ov = p['bottom_joint'] == 'overlay'
          # Len chân: đáy nâng lên, hai hồi chạy tới sàn (đáy buộc lọt giữa hai hồi).
          pl = p['plinth'] || {}
          ph = pl['h'].to_f
          pl_sb = pl['setback'].to_f
          bot_ov = false if ph > 0
          # Xà thay nóc: hai xà trước/sau lọt giữa hai hồi.
          stretch = p['top_style'] == 'stretchers'
          sw = (p['stretcher_w'] || C::STRETCHER_W).to_f
          top_ov = false if stretch
          sup = p['suppressed'] || []
          fr = p['front'] || {}
          fr_active = fr['enabled'] && fr['type'] != 'open'
          inner_front = fr_active && fr['mount'] == 'inset' ? fr['t'].to_f : 0.0
          inner_front += p['shelf_setback'].to_f
          rnd = p['round'] || {}
          corner_r = rnd['corner_r'].to_f
          end_r = rnd['end_r'].to_f

          err(errors, 'DIM_W', "Rộng #{w} mm quá nhỏ so với 2 hồi #{t} mm", 'field' => 'w') if w < 2 * t + C::MIN_CELL
          err(errors, 'DIM_H', "Cao #{h} mm quá nhỏ", 'field' => 'h') if h < ph + 2 * t + C::MIN_CELL
          if ph > 0
            err(errors, 'PLINTH_H', 'Chiều cao len chân phải từ 20 đến 300 mm (0 = không chân)', 'field' => 'plinth_h') if ph < 20 || ph > 300
            err(errors, 'PLINTH_SETBACK', 'Lùi len chân quá lớn so với chiều sâu', 'field' => 'plinth_setback') if pl_sb < 0 || pl_sb + 2 * t > d - tb - 20
            err(errors, 'PLINTH_ROUND', 'Tủ đầu bo chưa hỗ trợ len chân', 'field' => 'plinth_h') if rnd['end_r'].to_f > 0
          end
          if stretch
            err(errors, 'STRETCHER_W', 'Bản rộng xà phải từ 40 mm và nhỏ hơn nửa chiều sâu', 'field' => 'stretcher_w') if sw < 40 || sw > d / 2.0 - 10
            err(errors, 'STRETCHER_ROUND', 'Tủ đầu bo dùng nóc tấm, không dùng xà', 'field' => 'top_style') if rnd['end_r'].to_f > 0
          end
          dc = mode == 'overlay' ? d - tb : d
          y_back_inner = mode == 'overlay' ? d - tb : d - sb - tb
          err(errors, 'DIM_D', "Sâu #{d} mm không đủ cho hậu và lùi hậu", 'field' => 'd') if y_back_inner - inner_front < C::MIN_CELL
          if mode == 'groove'
            err(errors, 'GROOVE_DEPTH', "Rãnh sâu #{gd} mm phải nhỏ hơn độ dày ván #{t} mm − 2", 'field' => 'groove_depth') if gd > t - 2
            err(errors, 'GROOVE_CLEAR', 'Rãnh hậu phải sâu hơn khe hở hậu', 'field' => 'groove_depth') if gd <= gclr
          end
          if scope == 'per_column' && mode == 'overlay'
            err(errors, 'BACK_SCOPE', 'Hậu phủ phía sau chỉ dùng kiểu hậu chung toàn thùng', 'field' => 'back_scope')
          end
          if end_r > 0
            err(errors, 'END_R_SMALL', "Bán kính đầu bo #{end_r} mm phải ≥ độ dày + 20 mm", 'field' => 'end_round') if end_r < t + 20
            err(errors, 'END_R_BIG', format('Bán kính đầu bo %.0f mm không vừa (tối đa %.0f mm theo sâu/rộng)', end_r, [dc - C::MIN_CELL, w / 2.0].min), 'field' => 'end_round') if end_r > dc - C::MIN_CELL || end_r > w / 2.0
            if fr_active
              err(errors, 'END_R_FRONT', 'Tủ đầu bo dùng mặt trước hở trong bản này', 'field' => 'end_round')
            end
          end
          if corner_r > 0
            lim = [dc - inner_front, (w - 2 * t) / 2.0].min
            err(errors, 'CORNER_R_BIG', format('Bán kính bo góc %.0f mm không vừa tấm (tối đa %.0f mm)', corner_r, lim), 'field' => 'corner_radius') if corner_r > lim
          end

          panels = []
          side_z0 = bot_ov ? t : 0.0
          side_z1 = top_ov ? h - t : h
          zb0 = ph; zi0 = ph + t; zi1 = h - t; xi0 = t; xi1 = w - t
          endc_out = end_r > 0 ? [w - end_r, end_r, end_r] : nil
          endc_in = end_r > 0 ? [w - end_r, end_r, end_r - t] : nil

          panels << box_panel('side_L', 'side', 0.0, t, 0.0, dc, side_z0, side_z1, :x)
          panels << box_panel('side_R', 'side', w - t, w, end_r > 0 ? end_r : 0.0, dc, side_z0, side_z1, :x)
          if end_r > 0
            panels << {
              'id' => 'bent_R', 'local_id' => 'bent_R', 'role' => 'bent_end', 'label' => C::ROLE_LABELS['bent_end'],
              'kind' => 'bent', 't' => t, 'bent' => { 'c' => [w - end_r, end_r], 'r_out' => end_r, 'r_in' => end_r - t,
                                                   'a0' => -90.0, 'a1' => 0.0, 'z0' => side_z0, 'z1' => side_z1 },
              'frame' => G.frame([0, 0, 0], [1, 0, 0], [0, 1, 0], [0, 0, 1]), 'outline' => G.rect_outline(1, 1), 'features' => []
            }
          end
          tx0, tx1 = top_ov ? [0.0, w] : [t, w - t]
          bx0, bx1 = bot_ov ? [0.0, w] : [t, w - t]
          if stretch
            panels << box_panel('stretcher_F', 'stretcher', t, w - t, 0.0, sw, h - t, h, :z)
            panels << box_panel('stretcher_B', 'stretcher', t, w - t, dc - sw, dc, h - t, h, :z)
          else
            panels << horiz_panel('top', 'top', tx0, tx1, 0.0, dc, h - t, h, corner_r, top_ov ? endc_out : endc_in)
          end
          panels << horiz_panel('bottom', 'bottom', bx0, bx1, 0.0, dc, zb0, zb0 + t, corner_r, bot_ov ? endc_out : endc_in)
          if ph > 0
            panels << box_panel('plinth_F', 'plinth', t, w - t, pl_sb, pl_sb + t, 0.0, ph, :y)
            panels << box_panel('plinth_B', 'plinth', t, w - t, dc - t, dc, 0.0, ph, :y) unless pl['back'] == false
          end

          # Khoang bên trong
          res = Interior.resolve(p['interior'], xi0, xi1, zi0, zi1)
          res['errors'].each { |e| errors << e.merge('level' => 'error') }
          root = p['interior']
          root_x_split = root['type'] == 'split' && root['axis'] == 'x'
          divs = res['dividers']
          # Hậu
          e = gd - gclr
          backs = []
          if scope == 'per_column' && root_x_split
            bounds = [xi0] + divs.select { |dv| dv['root_level'] }.flat_map { |dv| [dv['lo'], dv['hi']] } + [xi1]
            bounds.each_slice(2).with_index do |(a, b), i|
              ex = mode == 'groove' ? e : 0.0
              backs << box_panel("back_#{i}", 'back', a - ex, b + ex, d - sb - tb, d - sb, zi0 - ex, zi1 + ex, :y)
            end
          else
            case mode
            when 'overlay'
              backs << box_panel('back', 'back', 0.0, w, d - tb, d, zb0, h, :y)
            when 'inset'
              backs << box_panel('back', 'back', xi0, xi1, d - sb - tb, d - sb, zi0, zi1, :y)
            else
              backs << box_panel('back', 'back', xi0 - e, xi1 + e, d - sb - tb, d - sb, zi0 - e, zi1 + e, :y)
            end
          end
          panels.concat(backs)

          divider_panels = []
          divs.each do |dv|
            if dv['axis'] == 'x'
              y1 = scope == 'per_column' && dv['root_level'] && mode != 'overlay' ? d : y_back_inner
              pn = box_panel(dv['id'], 'partition', dv['lo'], dv['hi'], inner_front, y1, dv['span'][0], dv['span'][1], :x,
                             'divider' => true, 'axis' => 'x')
            else
              x0, x1 = dv['span']
              er = endc_in && (x1 - xi1).abs < TOL ? endc_in : nil
              cr = corner_r > 0 ? corner_r : 0.0
              pn = horiz_panel(dv['id'], 'shelf', x0, x1, inner_front, y_back_inner, dv['lo'], dv['hi'], cr, er)
              pn['divider'] = true
              pn['axis'] = 'z'
            end
            divider_panels << pn
          end
          panels.concat(divider_panels)

          # Rãnh soi hậu (feature + hình học khoét). Rãnh chạy suốt chiều dài tấm (giả định).
          if mode == 'groove'
            gy0 = d - sb - tb - gtol / 2.0; gy1 = d - sb + gtol / 2.0
            add_groove = lambda do |pn, face, axis_along|
              if axis_along == :v
                rect = [gy0 - pn['frame']['o'][1], 0.0, gy1 - pn['frame']['o'][1], pn['h']]
              else
                rect = [0.0, gy0 - pn['frame']['o'][1], pn['w'], gy1 - pn['frame']['o'][1]]
              end
              pn['features'] << {
                'id' => "#{pn['id']}:back_groove", 'type' => 'groove', 'op' => 'back_groove', 'face' => face,
                'rect' => rect, 'depth' => gd, 'through' => false, 'width' => gy1 - gy0,
                'path' => axis_along == :v ? [[(rect[0] + rect[2]) / 2, 0.0], [(rect[0] + rect[2]) / 2, pn['h']]] :
                                             [[0.0, (rect[1] + rect[3]) / 2], [pn['w'], (rect[1] + rect[3]) / 2]],
                'carve' => bk['carve'] == true, 'source' => { 'kind' => 'back_groove', 'other' => backs.first && backs.first['local_id'] }
              }
            end
            panels.each do |pn|
              case pn['local_id']
              when 'side_L' then add_groove.call(pn, 'A', :v)
              when 'side_R' then add_groove.call(pn, 'B', :v)
              when 'top', 'stretcher_B' then add_groove.call(pn, 'B', :u)
              when 'bottom' then add_groove.call(pn, 'A', :u)
              end
            end
            if scope == 'per_column' && root_x_split
              divider_panels.each do |pn|
                next unless pn['axis'] == 'x' && divs.find { |dv| dv['id'] == pn['id'] }['root_level']
                add_groove.call(pn, 'A', :v)
                add_groove.call(pn, 'B', :v)
                if 2 * gd > t - 3
                  err(errors, 'GROOVE_PARTITION', format('Vách dày %.0f mm không đủ soi rãnh hai mặt sâu %.0f mm', pn['t'], gd), 'field' => 'groove_depth')
                end
              end
            end
          end

          # Vùng cánh (khoang đứng chia bởi vách cấp gốc)
          boundaries = [{ 'id' => 'side_L', 'kind' => 'side', 'face' => xi0, 'center' => t / 2.0 }]
          if root_x_split
            divs.select { |dv| dv['root_level'] }.sort_by { |dv| dv['center'] }.each do |dv|
              boundaries << { 'id' => dv['id'], 'kind' => 'partition', 'lo' => dv['lo'], 'hi' => dv['hi'], 'center' => dv['center'] }
            end
          end
          boundaries << { 'id' => 'side_R', 'kind' => 'side', 'face' => xi1, 'center' => w - t / 2.0 }
          zones = boundaries.each_cons(2).map do |bl, br|
            { 'key' => "#{bl['id']}|#{br['id']}", 'left' => bl, 'right' => br,
              'x0' => bl['kind'] == 'side' ? xi0 : bl['hi'], 'x1' => br['kind'] == 'side' ? xi1 : br['lo'] }
          end

          info = { 'w' => w, 'd' => d, 'h' => h, 't' => t, 'plinth' => ph, 'y_back_inner' => y_back_inner, 'inner_front' => inner_front,
                   'dc' => dc, 'interior' => [xi0, xi1, zi0, zi1], 'side_z' => [side_z0, side_z1] }
          cells = res['cells'].map { |c| c.merge('y0' => inner_front, 'y1' => y_back_inner) }
          fronts = []
          doors = []
          if fr['enabled']
            if fr['type'] == 'doors'
              doors, fe = make_doors(p, zones, info, opts)
              errors.concat(fe)
              fronts.concat(doors)
            elsif fr['type'] == 'drawers'
              faces, fe = make_drawer_faces(p, info)
              errors.concat(fe)
              fronts.concat(faces)
            end
          end
          panels.concat(fronts)
          panels.reject! { |pn| sup.include?(pn['local_id']) }
          { 'panels' => panels, 'cells' => cells, 'dividers' => divs, 'nodes' => res['nodes'], 'zones' => zones,
            'doors' => doors.reject { |dd| sup.include?(dd['local_id']) }, 'info' => info, 'errors' => errors }
        end

        def door_count(fr, zone)
          n = (fr['door_counts'] || {})[zone['key']]
          return n.to_i if n && n.to_i >= 1
          (zone['x1'] - zone['x0']) > C::AUTO_TWO_DOORS_OVER ? 2 : 1
        end

        def make_doors(p, zones, info, opts)
          fr = p['front']; errs = []
          w = info['w']; h = info['h']; t = info['t']
          eg = fr['edge_gap'].to_f; mg = fr['mid_gap'].to_f; tf = fr['t'].to_f
          doors = []
          zones.each_with_index do |z, zi|
            if fr['mount'] == 'inset'
              x0 = z['x0'] + eg; x1 = z['x1'] - eg; z0 = info['interior'][2] + eg; z1 = h - t - eg; y0 = 0.0; y1 = tf
            else
              x0 = z['left']['kind'] == 'side' ? eg : z['left']['center'] + mg / 2.0
              x1 = z['right']['kind'] == 'side' ? w - eg : z['right']['center'] - mg / 2.0
              z0 = info['plinth'].to_f + eg; z1 = h - eg; y0 = -tf; y1 = 0.0
            end
            x0 = [x0, opts['door_x_min'] + eg].max if opts['door_x_min'] && zi.zero?
            n = door_count(fr, z)
            dw = (x1 - x0 - (n - 1) * mg) / n.to_f
            if dw < 100
              err(errs, 'DOOR_TOO_NARROW', format('Cánh quá hẹp (%.0f mm) ở khoang %d', dw, zi + 1))
              next
            end
            n.times do |i|
              a = x0 + i * (dw + mg)
              lid = "door:#{z['key']}:#{i}"
              pn = box_panel(lid, 'door', a, a + dw, y0, y1, z0, z1, :y,
                             'zone' => z['key'], 'zone_index' => zi, 'x0' => a, 'x1' => a + dw, 'door_index' => i)
              doors << pn
            end
          end
          [doors, errs]
        end

        def make_drawer_faces(p, info)
          fr = p['front']; errs = []
          w = info['w']; h = info['h']; t = info['t']
          eg = fr['edge_gap'].to_f; tf = fr['t'].to_f; hg = fr['handle_gap'].to_f
          ratios = fr['drawer_ratios'] || []
          n = fr['drawer_count'].to_i
          ratios = Array.new(n, 1.0) if ratios.size != n
          if fr['mount'] == 'inset'
            x0 = t + eg; x1 = w - t - eg; base = info['interior'][2] + eg; top = h - t; y0 = 0.0; y1 = tf
          else
            x0 = eg; x1 = w - eg; base = info['plinth'].to_f + eg; top = h; y0 = -tf; y1 = 0.0
          end
          total = top - base
          sum = ratios.sum.to_f
          faces = []
          z = base
          ratios.each_with_index do |r, i|
            alloc = total * r / sum
            fh = alloc - hg
            if fh < 60
              err(errs, 'DRAWER_FACE_SMALL', format('Mặt ngăn kéo %d chỉ cao %.0f mm sau khi trừ khe luồn tay %.0f mm', i + 1, fh, hg))
            else
              faces << box_panel("dface:#{i}", 'drawer_face', x0, x1, y0, y1, z, z + fh, :y,
                                 'face_index' => i, 'handle_gap' => hg, 'gap_top' => [z + fh, z + alloc])
            end
            z += alloc
          end
          [faces, errs]
        end

        # ----------------------------------------------------------- THÙNG NGĂN KÉO
        def drawer_box_panels(dr, cell, info)
          errs = []
          cl = (dr['clearance'] || C::RAIL_SIDE_CLEARANCE).to_f
          ts = dr['side_t'].to_f; tbot = dr['bottom_t'].to_f
          bx0 = cell['x0'] + cl; bx1 = cell['x1'] - cl
          by0 = info['inner_front']; by1 = by0 + dr['rail_length'].to_f
          bz0 = cell['z0'] + dr['bottom'].to_f; bz1 = bz0 + dr['height'].to_f
          if bx1 - bx0 < 2 * ts + C::MIN_CELL
            err(errs, 'DRAWER_NARROW', format('Khoang rộng %.0f mm không đủ cho thùng (hở ray 2×%.0f mm)', cell['x1'] - cell['x0'], cl), 'drawer' => dr['id'])
          end
          if by1 > info['y_back_inner'] + TOL
            err(errs, 'DRAWER_RAIL_LONG', format('Ray %.0f mm không vừa: lòng sâu còn %.0f mm (tính tới mặt trong hậu)', dr['rail_length'], info['y_back_inner'] - by0), 'drawer' => dr['id'])
          end
          if bz0 < cell['z0'] - TOL || bz1 > cell['z1'] + TOL
            err(errs, 'DRAWER_HEIGHT', format('Thùng cao %.0f mm tại vị trí này vượt khoang (khoang %.0f–%.0f mm)', dr['height'], cell['z0'], cell['z1']), 'drawer' => dr['id'])
          end
          pid = dr['id']
          extra = { 'drawer' => pid }
          panels = [
            box_panel("#{pid}:side_L", 'drawer_side', bx0, bx0 + ts, by0, by1, bz0, bz1, :x, extra),
            box_panel("#{pid}:side_R", 'drawer_side', bx1 - ts, bx1, by0, by1, bz0, bz1, :x, extra),
            box_panel("#{pid}:front", 'drawer_front', bx0 + ts, bx1 - ts, by0, by0 + ts, bz0 + tbot, bz1, :y, extra),
            box_panel("#{pid}:back", 'drawer_back', bx0 + ts, bx1 - ts, by1 - ts, by1, bz0 + tbot, bz1, :y, extra),
            box_panel("#{pid}:bottom", 'drawer_bottom', bx0, bx1, by0, by1, bz0, bz0 + tbot, :z, extra)
          ]
          box = { 'x0' => bx0, 'x1' => bx1, 'y0' => by0, 'y1' => by1, 'z0' => bz0, 'z1' => bz1,
                  'outer_w' => bx1 - bx0, 'depth' => by1 - by0 }
          [panels, errs, box]
        end

        # Vị trí đáy thùng (tính từ đáy lòng khoang) theo điểm neo: bottom | center | top.
        def drawer_bottom_from_anchor(anchor, dist, height)
          case anchor
          when 'center' then dist - height / 2.0
          when 'top' then dist - height
          else dist
          end
        end

        # Bố trí cả cụm: theo mặt ngăn kéo của module nếu có, nếu không chia đều cluster_count.
        def cluster_layout(p, cell, info, box_tpl)
          h = box_tpl['height'].to_f
          list = []
          fr = p['front'] || {}
          if fr['type'] == 'drawers'
            pp = Util.deep_copy(p); pp['front']['enabled'] = true
            faces, = make_drawer_faces(pp, info)
            faces.each do |f|
              z0 = f['frame']['o'][2]
              zb = [z0 + C::DRAWER_BOX_BOTTOM_OFFSET, cell['z0']].max
              list << zb - cell['z0']
            end
          else
            n = [box_tpl['cluster_count'].to_i, 1].max
            alloc = (cell['z1'] - cell['z0']) / n.to_f
            n.times { |i| list << i * alloc + C::DRAWER_BOX_BOTTOM_OFFSET }
          end
          errs = []
          list.each_cons(2).with_index do |(a, b), i|
            if a + h > b + TOL
              err(errs, 'CLUSTER_OVERLAP', format('Thùng %d cao %.0f mm chạm thùng %d — giảm chiều cao thùng trong setting', i + 1, h, i + 2))
            end
          end
          [list, errs]
        end

        # ----------------------------------------------------------- CHỮ L
        def transform_panels(panels, pos, rot, prefix)
          panels.map do |pn|
            q = Util.deep_copy(pn)
            q['id'] = q['local_id'] = "#{prefix}#{pn['local_id']}"
            q['frame'] = G.place_frame(pos, rot, pn['frame'])
            if q['kind'] == 'bent'
              q['bent']['c'] = G.place_point(pos, rot, pn['bent']['c'] + [0.0])[0, 2]
              q['bent']['a0'] += rot; q['bent']['a1'] += rot
            end
            q['features'].each { |f| f['id'] = "#{prefix}#{f['id']}" }
            q
          end
        end

        # Phản chiếu toàn bộ tấm qua mặt x = xm (đổi hướng chữ L). Khung giữ thuận tay phải:
        # u' = -R(u), tọa độ u' = w - u (dời gốc sang mép đối diện).
        def mirror_panels(panels, xm)
          panels.map do |pn|
            q = Util.deep_copy(pn)
            w = pn['w'].to_f
            f = G.mirror_frame_x(pn['frame'], xm)
            f['o'] = G.sub(f['o'], G.mul(f['u'], w))
            q['frame'] = f
            pts = G.tessellate(pn['outline'], C::ARC_SEG_PER_QUARTER)
            q['outline'] = G.poly_outline(pts.map { |pt| [w - pt[0], pt[1]] }.reverse)
            q['features'] = (pn['features'] || []).map { |ft| mirror_feature(ft, w) }
            q['x0'], q['x1'] = [2 * xm - pn['x1'], 2 * xm - pn['x0']] if pn['x0'] && pn['x1']
            q
          end
        end

        def mirror_feature(f, w)
          g = Util.deep_copy(f)
          g['pos'] = [w - f['pos'][0], f['pos'][1], f['pos'][2]] if f['pos']
          g['dir'] = [-f['dir'][0], f['dir'][1], f['dir'][2]] if f['dir']
          g['rect'] = [w - f['rect'][2], f['rect'][1], w - f['rect'][0], f['rect'][3]] if f['rect']
          g['path'] = f['path'].map { |pt| [w - pt[0], pt[1]] } if f['path']
          if g['face'] == 'E:u0' then g['face'] = 'E:u1'
          elsif g['face'] == 'E:u1' then g['face'] = 'E:u0'
          end
          g
        end

        def l_two_box(p)
          la = p['l']['la'].to_f; lb = p['l']['lb'].to_f; d = p['d'].to_f
          errors = []
          err(errors, 'L_SHORT_A', format('Nhánh A (%.0f) phải dài hơn chiều sâu chung %.0f mm + 200', la, d), 'field' => 'la') if la < d + 200
          err(errors, 'L_SHORT_B', format('Nhánh B (%.0f) phải dài hơn chiều sâu chung %.0f mm + 200', lb, d), 'field' => 'lb') if lb < d + 200
          return empty(errors) if errors.any?
          base = Util.deep_copy(p)
          base['interior'] = { 'id' => 'cell_root', 'type' => 'leaf' }
          pa = base.merge('w' => la, 'd' => d)
          tf = (p['front'] || {})['t'].to_f
          ra = carcass(pa, 'door_x_min' => (p['front'] || {})['mount'] == 'inset' ? nil : d + tf)
          pb = base.merge('w' => lb - d, 'd' => d)
          rb = carcass(pb)
          panels = transform_panels(ra['panels'], [0.0, lb - d, 0.0], 0, 'A.') +
                   transform_panels(rb['panels'], [d, 0.0, 0.0], 90, 'B.')
          doors = panels.select { |pn| pn['role'] == 'door' }
          doors.each { |dd| dd['zone'] = dd['local_id'].split(':')[0..1].join(':') }
          if p['l']['orient'] == 'left'
            panels = mirror_panels(panels, la / 2.0)
            doors = panels.select { |pn| pn['role'] == 'door' }
          end
          { 'panels' => panels, 'cells' => [], 'dividers' => [], 'nodes' => {}, 'zones' => [], 'doors' => doors,
            'info' => { 'w' => la, 'd' => d, 'h' => p['h'].to_f, 't' => p['t'].to_f, 'lb' => lb, 'l' => true,
                        'y_back_inner' => ra['info']['y_back_inner'], 'inner_front' => 0.0 },
            'errors' => ra['errors'] + rb['errors'] }
        end

        def l_single(p)
          la = p['l']['la'].to_f; lb = p['l']['lb'].to_f; d = p['d'].to_f; h = p['h'].to_f
          t = p['t'].to_f; tb = p['tb'].to_f
          errors = []
          err(errors, 'L_SHORT_A', format('Nhánh A (%.0f) phải dài hơn chiều sâu chung %.0f mm + 150', la, d), 'field' => 'la') if la < d + 150
          err(errors, 'L_SHORT_B', format('Nhánh B (%.0f) phải dài hơn chiều sâu chung %.0f mm + 150', lb, d), 'field' => 'lb') if lb < d + 150
          err(errors, 'DIM_H', 'Cao quá nhỏ', 'field' => 'h') if h < 2 * t + C::MIN_CELL
          return empty(errors) if errors.any?
          lpoly = [[0.0, 0.0], [d, 0.0], [d, lb - d], [la, lb - d], [la, lb], [0.0, lb]]
          mk_l = lambda do |id, role, z0|
            {
              'id' => id, 'local_id' => id, 'role' => role, 'label' => "#{C::ROLE_LABELS[role]} chữ L", 'kind' => 'flat',
              't' => t, 'w' => la, 'h' => lb, 'frame' => G.frame([0.0, 0.0, z0], [1, 0, 0], [0, 1, 0], [0, 0, 1]),
              'outline' => G.poly_outline(lpoly), 'features' => [], 'l_shape' => true
            }
          end
          panels = [mk_l.call('top', 'top', h - t), mk_l.call('bottom', 'bottom', 0.0)]
          panels << box_panel('end_A', 'l_end', la - t, la, lb - d, lb, t, h - t, :x)
          panels << box_panel('end_B', 'l_end', 0.0, d, 0.0, t, t, h - t, :y)
          panels << box_panel('back_A', 'back', 0.0, la - t, lb - tb, lb, t, h - t, :y)
          panels << box_panel('back_B', 'back', 0.0, tb, t, lb - tb, t, h - t, :x)
          doors = []
          fr = p['front'] || {}
          if fr['enabled'] && fr['type'] == 'doors'
            eg = fr['edge_gap'].to_f; mg = fr['mid_gap'].to_f; tf = fr['t'].to_f
            ax0 = d + tf + eg; ax1 = la - eg
            na = (ax1 - ax0) > C::AUTO_TWO_DOORS_OVER ? 2 : 1
            na = fr['door_counts']['A'].to_i if fr['door_counts'] && fr['door_counts']['A'].to_i >= 1
            dw = (ax1 - ax0 - (na - 1) * mg) / na
            na.times do |i|
              a = ax0 + i * (dw + mg)
              doors << box_panel("door:A:#{i}", 'door', a, a + dw, lb - d - tf, lb - d, eg, h - eg, :y,
                                 'zone' => 'A', 'x0' => a, 'x1' => a + dw)
            end
            by0 = eg; by1 = lb - d - eg
            nb = (by1 - by0) > C::AUTO_TWO_DOORS_OVER ? 2 : 1
            nb = fr['door_counts']['B'].to_i if fr['door_counts'] && fr['door_counts']['B'].to_i >= 1
            dh = (by1 - by0 - (nb - 1) * mg) / nb
            nb.times do |i|
              a = by0 + i * (dh + mg)
              # Cánh nhánh B: pháp tuyến +x, mặt B (w = 0) tựa vào thùng.
              doors << box_panel("door:B:#{i}", 'door', d, d + tf, a, a + dh, eg, h - eg, :x,
                                 'zone' => 'B', 'x0' => a, 'x1' => a + dh)
            end
            panels.concat(doors)
          end
          if p['l']['orient'] == 'left'
            panels = mirror_panels(panels, la / 2.0)
            doors = panels.select { |pn| pn['role'] == 'door' }
          end
          { 'panels' => panels, 'cells' => [], 'dividers' => [], 'nodes' => {}, 'zones' => [], 'doors' => doors,
            'info' => { 'w' => la, 'd' => d, 'h' => h, 't' => t, 'lb' => lb, 'l' => true, 'y_back_inner' => lb - tb,
                        'inner_front' => 0.0 },
            'errors' => errors }
        end

        def empty(errors)
          { 'panels' => [], 'cells' => [], 'dividers' => [], 'nodes' => {}, 'zones' => [], 'doors' => [], 'info' => {}, 'errors' => errors }
        end

        # ----------------------------------------------------------- TỔNG HỢP
        # ctx: {'hinge_preset'=>..., 'cam_preset'=>...}
        def build(p, ctx = {})
          p = Util.deep_copy(p)
          r = case p['geometry']
              when 'carcass' then carcass(p)
              when 'l_two_box' then l_two_box(p)
              when 'l_single' then l_single(p)
              else empty([{ 'code' => 'GEOMETRY_UNSUPPORTED', 'level' => 'error', 'message' => "Loại hình học #{p['geometry']} không dựng thành module" }])
              end
          # Thùng ngăn kéo
          boxes = []
          (p['drawers'] || []).each do |dr|
            cell = r['cells'].find { |c| c['id'] == dr['cell'] }
            if cell.nil?
              r['errors'] << { 'code' => 'DRAWER_ORPHAN', 'level' => 'error', 'drawer' => dr['id'],
                               'message' => 'Thùng ngăn kéo mất khoang chứa (khoang đã bị gộp/xóa)' }
              next
            end
            pnls, errs, box = drawer_box_panels(dr, cell, r['info'])
            r['errors'].concat(errs)
            boxes << box.merge('id' => dr['id'], 'cell' => dr['cell'])
            r['panels'].concat(pnls.reject { |pn| (p['suppressed'] || []).include?(pn['local_id']) })
          end
          by_cell = boxes.group_by { |b| b['cell'] }
          by_cell.each_value do |list|
            list.sort_by { |b| b['z0'] }.each_cons(2) do |a, b|
              if a['z1'] > b['z0'] + TOL
                r['errors'] << { 'code' => 'DRAWER_COLLIDE', 'level' => 'error', 'drawer' => b['id'], 'message' => 'Hai thùng ngăn kéo chồng nhau' }
              end
            end
          end
          r['boxes'] = boxes
          # Bản lề
          hp = ctx['hinge_preset'] || C::HINGE_PRESET_DEMO
          hstate = p['hinges'] || {}
          if hstate['enabled'] && r['doors'].any?
            newmap = Hinges.reconcile(hstate['doors'], r['doors'], hstate['split_policy'] || 'keep_and_add')
            shelves = r['panels'].select { |pn| pn['role'] == 'shelf' }
            r['doors'].each do |door|
              data = newmap[door['local_id']]
              forb = forbidden_for(door, shelves, hp)
              feats, errs = Hinges.features_for(door, data, hp, forb)
              door['features'].concat(feats)
              errs.each { |e| r['errors'] << e.merge('level' => 'warning', 'part' => door['local_id']) }
            end
            hstate['doors'] = newmap
          end
          p['hinges'] = hstate
          # Cam
          jstate = p['joints'] || {}
          r['joints'] = []
          if jstate['enabled']
            cp = ctx['cam_preset'] || C::CAM_PRESET_DEMO
            ic = interior_center(r['info'])
            joints, issues = Joints.generate(r['panels'], cp, jstate['overrides'] || {}, ic)
            joints.each do |j|
              j['features'].each do |pid, feats|
                pn = r['panels'].find { |x| x['id'] == pid }
                pn['features'].concat(feats) if pn
              end
            end
            r['joints'] = joints
            issues.each { |i| r['errors'] << i.merge('level' => 'warning') }
          end
          name_panels!(r['panels'], p)
          # Thao tác gia công người dùng đã xóa trong Thuộc tính: không tự hồi sinh.
          supf = p['suppressed_features'] || []
          r['panels'].each { |pn| pn['features'].reject! { |f| supf.include?(f['id']) } } if supf.any?
          r['params'] = p
          r
        end

        # Tên tấm theo cách gọi của xưởng + ký hiệu tủ (ABF in nhãn theo tên nhóm).
        def name_panels!(panels, p)
          prefix = p['label'].to_s.strip
          door_zones = panels.select { |x| x['role'] == 'door' }.group_by { |x| x['zone'] }
          shelf_i = 0; part_i = 0
          panels.each do |pn|
            lid = pn['local_id'].to_s
            key = lid.sub(/\A[AB]\./, '')
            name = if pn['drawer']
                     C::PANEL_SUFFIX[lid.split(':').last] || pn['label']
                   elsif C::PANEL_NAMES[key]
                     branch = lid =~ /\A([AB])\./ ? " #{Regexp.last_match(1)}" : ''
                     C::PANEL_NAMES[key] + branch
                   elsif pn['role'] == 'door'
                     zs = door_zones[pn['zone']] || []
                     if zs.size == 2 then zs.index(pn).zero? ? 'Cánh Trái' : 'Cánh Phải'
                     elsif zs.size > 2 then "Cánh #{zs.index(pn) + 1}"
                     else 'Cánh'
                     end
                   elsif pn['role'] == 'drawer_face' then "Mặt Ngăn Kéo #{pn['face_index'].to_i + 1}"
                   elsif pn['role'] == 'shelf' then "Đợt #{shelf_i += 1}"
                   elsif pn['role'] == 'partition' then "Vách #{part_i += 1}"
                   else pn['label']
                   end
            pn['label'] = prefix.empty? ? name : "#{prefix} #{name}"
          end
        end

        def interior_center(info)
          return nil unless info['w']
          if info['l']
            [info['w'] / 2.0, info['lb'] / 2.0, info['h'] / 2.0]
          else
            [info['w'] / 2.0, info['y_back_inner'].to_f / 2.0, info['h'] / 2.0]
          end
        end

        # Khoảng cấm theo chiều cao cánh do đợt (tọa độ cánh v = z - đáy cánh).
        def forbidden_for(door, shelves, hp)
          z0 = door['frame']['o'][2]
          dx0 = door['x0']; dx1 = door['x1']
          shelves.each_with_object([]) do |sh, acc|
            bb = G.panel_aabb(sh)
            next if dx0 && dx1 && (bb[1][0] < dx0 - TOL || bb[0][0] > dx1 + TOL)
            acc << [bb[0][2] - z0 - hp['shelf_clearance'], bb[1][2] - z0 + hp['shelf_clearance']]
          end
        end
      end
    end
  end
end
