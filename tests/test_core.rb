# encoding: UTF-8
# Kiểm thử thuần Ruby cho lõi (không cần SketchUp): ruby -Itests tests/test_core.rb
require 'minitest/autorun'
$LOAD_PATH.unshift File.expand_path('../hl_tumodule', __dir__)
require 'core/util'
require 'core/config'
require 'core/geom'
require 'core/templates'
require 'core/params'
require 'core/interior'
require 'core/hinges'
require 'core/joints'
require 'core/builder'
require 'core/solver'
require 'core/sections'
require 'core/mfg'
require 'core/library'
require 'core/abf_adapter'
require 'core/abf_rules'

include HungLoan::TuModule::Core

module H
  module_function

  def params(tid, over = {})
    tpl = Templates.find(tid)
    base = tpl['fields'].any? { |f| f['key'] == 'plinth_h' } ? { 'plinth_h' => 0, 'top_style' => 'panel' } : {}
    vals, errs = Params.clean_settings(tpl, tpl['defaults'].merge(base).merge(over))
    raise errs.inspect if errs.any?
    Params.build(tpl, vals, 'm1')
  end

  def by(r, lid)
    r['panels'].find { |p| p['local_id'] == lid }
  end

  def box(p) Geom.panel_aabb(p) end

  # Các cặp tấm chồng thể tích thực (ngoại trừ hậu lọt vào rãnh đã soi).
  def overlaps(panels, allow_groove: true)
    out = []
    flat = panels.reject { |p| p['kind'] == 'bent' }
    flat.combination(2).each do |a, b|
      ba = box(a); bb = box(b)
      ov = (0..2).map { |k| [ba[1][k], bb[1][k]].min - [ba[0][k], bb[0][k]].max }
      next unless ov.all? { |o| o > 0.01 }
      rows = Sections.scan([a, b])
      next if rows.all? { |r| r['status'] == 'not_real' }
      next if allow_groove && rows.all? { |r| r['status'] == 'covered' }
      out << [a['local_id'], b['local_id'], ov]
    end
    out
  end
end

class TestCarcass < Minitest::Test
  def test_four_top_bottom_combos_keep_total_height_and_thickness
    %w[inset overlay].product(%w[inset overlay]).each do |tj, bj|
      p = H.params('hl.khung_tu.v1', 'top_joint' => tj, 'bottom_joint' => bj, 'h' => 2000, 't' => 17)
      r = Builder.build(p)
      assert_empty r['errors'], "#{tj}/#{bj}: #{r['errors']}"
      zs = r['panels'].reject { |q| q['role'] == 'back' }.flat_map { |q| b = H.box(q); [b[0][2], b[1][2]] }
      assert_in_delta 0.0, zs.min, 1e-6
      assert_in_delta 2000.0, zs.max, 1e-6, "tổng cao giữ nguyên #{tj}/#{bj}"
      side = H.by(r, 'side_L')
      exp = 2000 - (tj == 'overlay' ? 17 : 0) - (bj == 'overlay' ? 17 : 0)
      assert_in_delta exp, side['h'], 1e-6
      r['panels'].each { |q| assert_in_delta 17.0, q['t'], 1e-6 unless %w[back].include?(q['role']) }
      top = H.by(r, 'top')
      assert_in_delta(tj == 'overlay' ? 900.0 : 866.0, top['w'], 1e-6)
      assert_empty H.overlaps(r['panels']), "không chồng thể tích #{tj}/#{bj}"
    end
  end

  def test_back_modes
    %w[overlay inset groove].each do |m|
      p = H.params('hl.khung_tu.v1', 'back_mode' => m)
      r = Builder.build(p)
      assert_empty r['errors'], m
      back = H.by(r, 'back')
      assert back, m
      assert_empty H.overlaps(r['panels']), "hậu #{m} không xuyên tấm khác (ngoài rãnh)"
      if m == 'groove'
        side = H.by(r, 'side_L')
        g = side['features'].find { |f| f['op'] == 'back_groove' }
        assert g, 'hồi có rãnh soi'
        assert_equal 'A', g['face']
        assert_in_delta 8.0, g['depth'], 1e-6
        rows = Sections.scan([back, side])
        assert_equal 'covered', rows[0]['status'], 'hậu ăn vào rãnh đã soi'
      end
    end
  end

  def test_per_column_back_not_split_by_shelves
    p = H.params('hl.khung_tu.v1', 'back_mode' => 'inset', 'back_scope' => 'per_column')
    r = Builder.build(p)
    cell = r['cells'][0]
    p['interior'] = Interior.insert_divider(p['interior'], r['nodes'], cell['id'], 'x', 450.0, 17.0, 'div_v')
    r = Builder.build(p)
    left = r['cells'].min_by { |c| c['x0'] }
    p['interior'] = Interior.insert_divider(p['interior'], r['nodes'], left['id'], 'z', 1000.0, 17.0, 'div_s1')
    r = Builder.build(p)
    left = r['cells'].select { |c| c['x0'] < 100 }.max_by { |c| c['z0'] }
    p['interior'] = Interior.insert_divider(p['interior'], r['nodes'], left['id'], 'z', 1500.0, 17.0, 'div_s2')
    r = Builder.build(p)
    assert_empty r['errors']
    backs = r['panels'].select { |q| q['role'] == 'back' }
    assert_equal 2, backs.size, 'một tấm hậu suốt cho mỗi khoang đứng, không chia theo đợt'
    assert_empty H.overlaps(r['panels'])
  end

  def test_groove_per_column_too_thin_is_reported
    p = H.params('hl.khung_tu.v1', 'back_mode' => 'groove', 'back_scope' => 'per_column', 'groove_depth' => 8)
    r = Builder.build(p)
    p['interior'] = Interior.insert_divider(p['interior'], r['nodes'], r['cells'][0]['id'], 'x', 450.0, 17.0, 'dv')
    r = Builder.build(p)
    assert r['errors'].any? { |e| e['code'] == 'GROOVE_PARTITION' }
  end
end

class TestDividers < Minitest::Test
  def setup
    @p = H.params('hl.khung_tu.v1', 'w' => 1000, 'h' => 2000, 'back_mode' => 'inset')
    @r = Builder.build(@p)
  end

  def test_shelf_copy_clear_distance
    c = @r['cells'][0]
    @p['interior'] = Interior.insert_divider(@p['interior'], @r['nodes'], c['id'], 'z', 300.0, 17.0, 's1')
    r = Builder.build(@p)
    tree, ids = Interior.copy_divider(@p['interior'], r['nodes'], 's1', 2, 400.0)
    @p['interior'] = tree
    r = Builder.build(@p)
    centers = r['dividers'].select { |d| d['axis'] == 'z' }.map { |d| d['center'] }.sort
    assert_equal 3, centers.size
    assert_in_delta 417.0, centers[1] - centers[0], 1e-6
    assert_in_delta 417.0, centers[2] - centers[1], 1e-6
    lo_hi = r['dividers'].select { |d| d['axis'] == 'z' }.sort_by { |d| d['lo'] }
    assert_in_delta 400.0, lo_hi[1]['lo'] - lo_hi[0]['hi'], 1e-6, 'lọt lòng 400'
    assert_equal 2, ids.uniq.size
  end

  def test_copy_rejects_when_no_room
    c = @r['cells'][0]
    @p['interior'] = Interior.insert_divider(@p['interior'], @r['nodes'], c['id'], 'z', 1800.0, 17.0, 's1')
    r = Builder.build(@p)
    assert_raises(ValidationError) { Interior.copy_divider(@p['interior'], r['nodes'], 's1', 3, 400.0) }
  end

  def test_shelf_stops_before_back_and_ratio_on_resize
    c = @r['cells'][0]
    @p['interior'] = Interior.insert_divider(@p['interior'], @r['nodes'], c['id'], 'x', 400.0, 17.0, 'v1')
    r = Builder.build(@p)
    sh = r['panels'].find { |q| q['role'] == 'partition' }
    bb = H.box(sh)
    assert_in_delta r['info']['y_back_inner'], bb[1][1], 1e-6
    ratio_before = (400.0 - 17) / (1000 - 34)
    @p['w'] = 1500.0
    r2 = Builder.build(@p)
    dv = r2['dividers'][0]
    assert_in_delta 17 + ratio_before * (1500 - 34), dv['center'], 1e-6
    assert_in_delta 17.0, dv['hi'] - dv['lo'], 1e-9, 'độ dày giữ nguyên'
  end

  def test_remove_partition_merges_cells
    c = @r['cells'][0]
    @p['interior'] = Interior.insert_divider(@p['interior'], @r['nodes'], c['id'], 'x', 500.0, 17.0, 'v1')
    tree, = Interior.remove_divider(@p['interior'], 'v1')
    assert_equal 'leaf', tree['type']
  end
end

class TestFronts < Minitest::Test
  def test_doors_split_merge_follow_partition_center
    p = H.params('hl.khung_tu.v1', 'w' => 1000, 'front_mount' => 'overlay')
    p['front']['enabled'] = true
    p['front']['door_counts'] = {}
    r = Builder.build(p)
    assert_equal 2, r['doors'].size, 'rộng 1000 > 600 → mặc định 2 cánh'
    p['front']['door_counts'] = { 'side_L|side_R' => 1 }
    r = Builder.build(p)
    assert_equal 1, r['doors'].size
    p['interior'] = Interior.insert_divider(p['interior'], r['nodes'], r['cells'][0]['id'], 'x', 420.0, 17.0, 'v1')
    r = Builder.build(p)
    assert_equal 2, r['doors'].size, 'thêm vách → tự chia hai cánh'
    d0, d1 = r['doors'].sort_by { |d| d['x0'] }
    center = (d0['x1'] + d1['x0']) / 2.0
    assert_in_delta 420.0, center, 1e-6, 'khe bám tim vách'
    p['interior'] = Interior.move_divider(p['interior'], r['nodes'], 'v1', 600.0)
    r = Builder.build(p)
    d0, d1 = r['doors'].sort_by { |d| d['x0'] }
    assert_in_delta 600.0, (d0['x1'] + d1['x0']) / 2.0, 1e-6, 'move vách → khe dịch theo'
    tree, = Interior.remove_divider(p['interior'], 'v1')
    p['interior'] = tree
    r = Builder.build(p)
    assert_equal 1, r['doors'].size, 'xóa vách → gộp một cánh (theo số cánh khoang đã đặt)'
    ids = r['doors'].map { |d| d['local_id'] }
    assert_equal ids.uniq, ids
  end

  def test_drawer_faces_flat_with_25mm_handle_gap_each
    p = H.params('hl.tu_ngan_keo3.v1', 'h' => 720, 'drawer_count' => 3, 'drawer_ratios' => '1,1,1')
    p['front']['enabled'] = true
    r = Builder.build(p)
    assert_empty r['errors']
    faces = r['panels'].select { |q| q['role'] == 'drawer_face' }.sort_by { |q| q['frame']['o'][2] }
    assert_equal 3, faces.size
    faces.each do |f|
      assert_equal 4, f['outline'].size, 'mặt phẳng, không vát'
      assert_in_delta 25.0, f['gap_top'][1] - f['gap_top'][0], 1e-6
    end
    top = faces.last
    assert_in_delta 720.0 - 25.0, top['frame']['o'][2] + top['h'], 1e-6, 'mặt trên cùng cũng có khe 25'
    assert faces.last['frame']['o'][2] + faces.last['h'] <= 720.0
    assert faces.first['frame']['o'][2] >= 0
  end

  def test_rebuild_is_idempotent
    p = H.params('hl.khung_tu.v1')
    p['front']['enabled'] = true
    a = Builder.build(p)['panels'].map { |q| q['id'] }
    b = Builder.build(Builder.build(p)['params'])['panels'].map { |q| q['id'] }
    assert_equal a, b
  end
end

class TestDrawers < Minitest::Test
  def setup
    @p = H.params('hl.khung_tu.v1', 'w' => 634, 'd' => 500, 'h' => 900, 'back_mode' => 'inset', 'back_setback' => 15)
    @r = Builder.build(@p)
    @cell = @r['cells'][0]
  end

  def drawer(rail, bottom = 0, h = 150)
    { 'id' => 'dr1', 'cell' => @cell['id'], 'bottom' => bottom, 'height' => h, 'rail_length' => rail,
      'clearance' => Config::RAIL_SIDE_CLEARANCE, 'side_t' => 15.0, 'bottom_t' => 7.0 }
  end

  def test_width_minus_26_and_depth_equals_rail
    assert_in_delta 600.0, @cell['x1'] - @cell['x0'], 1e-6
    @p['drawers'] = [drawer(450)]
    r = Builder.build(@p)
    assert_empty r['errors']
    b = r['boxes'][0]
    assert_in_delta 574.0, b['outer_w'], 1e-6
    assert_in_delta 450.0, b['depth'], 1e-6
    assert_in_delta 150.0, b['z1'] - b['z0'], 1e-6
    sides = r['panels'].select { |q| q['role'] == 'drawer_side' }
    sides.each { |s| assert_in_delta 15.0, s['t'], 1e-9 }
  end

  def test_rail_too_long_reported_not_changed
    @p['drawers'] = [drawer(550)]
    r = Builder.build(@p)
    e = r['errors'].find { |x| x['code'] == 'DRAWER_RAIL_LONG' }
    assert e
    assert_in_delta 550.0, r['boxes'][0]['depth'], 1e-6, 'không âm thầm đổi ray'
  end

  def test_anchor_tab_positions
    assert_in_delta 100.0, Builder.drawer_bottom_from_anchor('bottom', 100, 150), 1e-9
    assert_in_delta 25.0, Builder.drawer_bottom_from_anchor('center', 100, 150), 1e-9
    assert_in_delta(-50.0, Builder.drawer_bottom_from_anchor('top', 100, 150), 1e-9)
  end

  def test_cluster_with_drawer_faces
    p = H.params('hl.tu_ngan_keo3.v1', 'h' => 720)
    r = Builder.build(p)
    list, errs = Builder.cluster_layout(p, r['cells'][0], r['info'], 'height' => 150, 'cluster_count' => 3)
    assert_equal 3, list.size
    assert_empty errs
  end
end

class TestHinges < Minitest::Test
  def test_counts_and_shelf_avoidance
    hp = Config::HINGE_PRESET_DEMO
    assert_equal 2, Hinges.count_for(700, hp)
    assert_equal 3, Hinges.count_for(1200, hp)
    pos, errs = Hinges.auto_positions(1200, hp, [[560.0, 640.0]])
    assert_empty errs
    mid = pos[1]
    assert mid['shifted']
    assert(mid['v'] <= 560.0 || mid['v'] >= 640.0)
  end

  def test_no_valid_position_reported
    hp = Config::HINGE_PRESET_DEMO
    _, errs = Hinges.auto_positions(700, hp, [[0.0, 700.0]])
    assert_equal 2, errs.size
  end

  def test_manual_modes_on_resize
    hp = Config::HINGE_PRESET_DEMO
    e = Hinges.manual_entry(150.0, 1000.0)
    keep, = Hinges.manual_positions([e], 1200.0, 'keep_edge', hp, [])
    prop, = Hinges.manual_positions([e], 1200.0, 'proportional', hp, [])
    assert_in_delta 150.0, keep[0]['v'], 1e-9
    assert_in_delta 180.0, prop[0]['v'], 1e-9
  end

  def test_door_hinge_features_on_door_only_and_split_policies
    p = H.params('hl.khung_tu.v1', 'w' => 1000, 'h' => 2000)
    p['front']['enabled'] = true
    p['front']['door_counts'] = { 'side_L|side_R' => 1 }
    p['hinges']['enabled'] = true
    r = Builder.build(p)
    door = r['doors'][0]
    hf = door['features'].select { |f| f['op'] == 'hinge_cup' }
    assert_equal 4, hf.size
    assert(r['panels'].reject { |q| q['role'] == 'door' }.none? { |q| q['features'].any? { |f| f['op'] == 'hinge_cup' } })
    hf.each { |f| assert_equal 'B', f['face']; assert_in_delta 35.0, f['diameter'], 1e-9 }
    p2 = r['params']
    p2['hinges']['doors'].values.first['mode'] = 'manual'
    p2['hinges']['doors'].values.first['manual'] = [Hinges.manual_entry(300.0, door['h'])]
    p2['interior'] = Interior.insert_divider(p2['interior'], r['nodes'], r['cells'][0]['id'], 'x', 500.0, 17.0, 'v')
    p2['hinges']['split_policy'] = 'keep_and_add'
    r2 = Builder.build(p2)
    left = r2['doors'].min_by { |d| d['x0'] }
    right = r2['doors'].max_by { |d| d['x0'] }
    assert_equal 'manual', r2['params']['hinges']['doors'][left['local_id']]['mode'], 'giữ bản lề còn phù hợp'
    assert_equal 'auto', r2['params']['hinges']['doors'][right['local_id']]['mode'], 'bổ sung cho cánh mới'
    p2['hinges']['split_policy'] = 'recompute_all'
    p2['hinges']['doors'] = r['params']['hinges']['doors']
    r3 = Builder.build(p2)
    assert(r3['params']['hinges']['doors'].values_at(left['local_id'], right['local_id']).all? { |d| d['mode'] == 'auto' })
    ids = r3['doors'].flat_map { |d| d['features'].map { |f| f['id'] } }
    assert_equal ids.uniq, ids
  end
end

class TestSolver < Minitest::Test
  def mods
    {
      'lo' => { 'w' => 900.0, 'd' => 580.0, 'h' => 2000.0, 'pos' => [0.0, 0.0, 0.0], 'rot' => 0 },
      'up' => { 'w' => 900.0, 'd' => 580.0, 'h' => 500.0, 'pos' => [0.0, 0.0, 2000.0], 'rot' => 0 }
    }
  end

  def test_stack_bidirectional_and_independent_height
    links = [{ 'id' => 'L1', 'type' => 'stack', 'lower' => 'lo', 'upper' => 'up' }]
    r = Solver.solve(mods, links, 'up' => { 'w' => 1000.0 })
    assert_in_delta 1000.0, r['mods']['lo']['w'], 1e-9
    r = Solver.solve(mods, links, 'lo' => { 'd' => 600.0 })
    assert_in_delta 600.0, r['mods']['up']['d'], 1e-9
    r = Solver.solve(mods, links, 'up' => { 'h' => 700.0 })
    assert_in_delta 2000.0, r['mods']['lo']['h'], 1e-9
    assert_in_delta 2700.0, r['mods']['up']['pos'][2] + r['mods']['up']['h'], 1e-9, 'tổng cao tăng 200'
    r = Solver.solve(mods, links, 'lo' => { 'h' => 1800.0 })
    assert_in_delta 1800.0, r['mods']['up']['pos'][2], 1e-9, 'nóc dưới và đáy trên tiếp xúc'
  end

  def test_scale_whole_set_proportional
    links = [{ 'id' => 'L1', 'type' => 'stack', 'lower' => 'lo', 'upper' => 'up' }]
    r = Solver.scale_assembly(mods, links, 1.0, 1.0, 2.0)
    assert_in_delta 4000.0, r['mods']['lo']['h'], 1e-9
    assert_in_delta 1000.0, r['mods']['up']['h'], 1e-9
    assert_in_delta 4000.0, r['mods']['up']['pos'][2], 1e-9
  end

  def test_drag_lower_moves_upper
    links = [{ 'id' => 'L1', 'type' => 'stack', 'lower' => 'lo', 'upper' => 'up' }]
    m, moved = Solver.drag(mods, links, 'lo', [100.0, 0.0, 0.0])
    assert_equal ['up'], moved
    assert_in_delta 100.0, m['up']['pos'][0], 1e-9
  end

  def kmods
    {
      'lo' => { 'w' => 800.0, 'd' => 560.0, 'h' => 810.0, 'pos' => [0.0, 0.0, 0.0], 'rot' => 0 },
      'up' => { 'w' => 800.0, 'd' => 350.0, 'h' => 700.0, 'pos' => [0.0, 210.0, 1410.0], 'rot' => 0 }
    }
  end

  def test_kitchen_width_only_back_aligned_height_kept
    links = [{ 'id' => 'K', 'type' => 'kitchen', 'lower' => 'lo', 'upper' => 'up' }]
    r = Solver.solve(kmods, links, 'up' => { 'w' => 900.0 })
    assert_in_delta 900.0, r['mods']['lo']['w'], 1e-9
    r = Solver.solve(kmods, links, 'lo' => { 'd' => 600.0 })
    up = r['mods']['up']
    assert_in_delta 350.0, up['d'], 1e-9, 'sâu tủ trên độc lập'
    assert_in_delta 600.0, up['pos'][1] + up['d'], 1e-9, 'mặt sau thẳng'
    assert_in_delta 1410.0, up['pos'][2], 1e-9
    r = Solver.solve(kmods, links, 'lo' => { 'h' => 900.0 })
    assert_in_delta 1410.0, r['mods']['up']['pos'][2], 1e-9, 'giữ cao độ tủ trên'
    assert_in_delta 510.0, r['gaps']['K'], 1e-9, 'khoảng hở tính lại'
    r = Solver.solve(kmods, links, 'lo' => { 'h' => 1500.0 })
    assert(r['errors'].any? { |e| e['code'] == 'KITCHEN_GAP_NEGATIVE' })
  end

  def test_rotated_kitchen_back_alignment
    m = kmods
    m['lo']['rot'] = 90; m['up']['rot'] = 90
    links = [{ 'id' => 'K', 'type' => 'kitchen', 'lower' => 'lo', 'upper' => 'up' }]
    r = Solver.solve(m, links, 'lo' => { 'd' => 600.0 })
    assert_in_delta(-250.0, r['mods']['up']['pos'][0], 1e-9)
  end
end

class TestLShape < Minitest::Test
  def test_two_box_lengths_from_outer_back_corner_no_overlap
    p = H.params('hl.tu_bep_L.v1', 'la' => 2400, 'lb' => 1800, 'd' => 560)
    r = Builder.build(p)
    assert_empty r['errors']
    boxes = r['panels'].map { |q| H.box(q) }
    xs = boxes.flat_map { |b| [b[0][0], b[1][0]] }; ys = boxes.flat_map { |b| [b[0][1], b[1][1]] }
    assert_in_delta 2400.0, xs.max - xs.min, 1e-6
    assert_in_delta 1800.0, ys.max - ys.min, 1e-6
    assert_empty H.overlaps(r['panels'])
    p['d'] = 600.0
    r = Builder.build(p)
    a_side = H.by(r, 'A.side_L'); b_side = H.by(r, 'B.side_L')
    assert_in_delta H.box(a_side)[1][1] - H.box(a_side)[0][1], H.box(b_side)[1][0] - H.box(b_side)[0][0], 1e-6, 'chiều sâu chung'
  end

  def test_two_box_with_doors_no_overlap_and_mirror
    %w[right left].each do |o|
      p = H.params('hl.tu_bep_L.v1', 'l_orient' => o)
      p['front']['enabled'] = true
      r = Builder.build(p)
      assert_empty r['errors'], o
      assert r['doors'].size >= 2
      assert_empty H.overlaps(r['panels']), "cánh chữ L không chồng (#{o})"
    end
  end

  def test_single_box_true_L_top
    p = H.params('hl.tu_L_mot_thung.v1')
    p['front']['enabled'] = true
    r = Builder.build(p)
    assert_empty r['errors']
    top = H.by(r, 'top')
    assert_equal 6, top['outline'].size, 'nóc chữ L thật (6 đỉnh), không ghép hai hình chữ nhật'
    assert_empty H.overlaps(r['panels'])
    assert_empty Mfg.validate(Mfg.parts(r['panels'])).select { |i| i['level'] == 'error' }
  end
end

class TestRound < Minitest::Test
  def test_radius_kept_after_resize_and_limit
    p = H.params('hl.tu_dau_bo.v1', 'end_round' => 100)
    r = Builder.build(p)
    assert_empty r['errors']
    top = H.by(r, 'top')
    arc = top['outline'].find { |s| s['t'] == 'A' }
    assert_in_delta 100.0, arc['r'], 1e-9
    assert_empty H.overlaps(r['panels'])
    p['w'] = 800.0; p['h'] = 1600.0
    r = Builder.build(p)
    arc = H.by(r, 'top')['outline'].find { |s| s['t'] == 'A' }
    assert_in_delta 100.0, arc['r'], 1e-9, 'giữ R khi đổi kích thước'
    assert_in_delta 17.0, H.by(r, 'top')['t'], 1e-9
    p['d'] = 140.0
    r = Builder.build(p)
    assert(r['errors'].any? { |e| e['code'] == 'END_R_BIG' }, 'báo giới hạn, không âm thầm đổi R')
    pts = Geom.tessellate(arc ? [{ 't' => 'L', 'p' => [0, 0] }, arc] : [], Config::ARC_SEG_PER_QUARTER)
    assert pts.size <= Config::ARC_SEG_PER_QUARTER + 2, 'giới hạn số đoạn cung'
  end

  def test_bent_panel_reported_unsupported_for_mfg
    p = H.params('hl.tu_dau_bo.v1', 'end_round' => 100)
    r = Builder.build(p)
    iss = Mfg.validate(Mfg.parts(r['panels']))
    assert(iss.any? { |i| i['code'] == 'UNSUPPORTED_BENT' })
  end
end

class TestCamAndMfg < Minitest::Test
  def built
    p = H.params('hl.khung_tu.v1', 'top_joint' => 'inset', 'bottom_joint' => 'inset', 'back_mode' => 'groove')
    p['joints']['enabled'] = true
    Builder.build(p)
  end

  def test_cam_pairs_on_two_panels_aligned
    r = built
    j = r['joints'].find { |x| x['a'] == 'top' && x['b'] == 'side_L' }
    assert j, 'nóc lọt tựa mặt trong hồi trái'
    assert_equal 2, j['positions'].size
    top = H.by(r, 'top'); side = H.by(r, 'side_L')
    assert_equal 4, top['features'].count { |f| f.dig('source', 'joint') == j['id'] }
    assert_equal 2, side['features'].count { |f| f.dig('source', 'joint') == j['id'] }
    assert(r['joints'].none? { |x| [x['a'], x['b']].include?('back') }, 'không đặt cam cho hậu')
    parts = Mfg.parts(r['panels'])
    iss = Mfg.validate(parts, r['joints'])
    errs = iss.select { |i| i['level'] == 'error' }
    assert_empty errs, errs.inspect
    assert(iss.any? { |i| i['code'] == 'DEMO_PRESET' }, 'preset demo được gắn cảnh báo')
    edge = top['features'].find { |f| f['op'] == 'cam_edge_hole' }
    assert edge['face'].start_with?('E:')
    assert edge['depth'] > top['t'], 'khoan cạnh sâu hơn độ dày nhưng hợp lệ trong stock'
  end

  def test_bbox_contact_not_cam_when_face_face
    r = built
    assert(r['joints'].none? { |x| x['a'] == 'side_L' && x['b'] == 'side_R' })
  end

  def test_overrides_flip_delete_manual
    p = H.params('hl.khung_tu.v1', 'top_joint' => 'inset', 'bottom_joint' => 'inset')
    p['joints']['enabled'] = true
    p['joints']['overrides'] = { 'top>side_L' => { 'flip' => true, 'positions' => [{ 'anchor' => 'start', 'dist' => 80 }] },
                                 'top>side_R' => { 'deleted' => true } }
    r = Builder.build(p)
    j = r['joints'].find { |x| x['id'] == 'top>side_L' }
    assert_equal 1, j['positions'].size
    assert_in_delta j['line'][0] + 80, j['positions'][0], 1e-9
    jr = r['joints'].find { |x| x['id'] == 'top>side_R' }
    assert jr['deleted']
    assert_empty H.by(r, 'side_R')['features'].select { |f| f.dig('source', 'joint') == 'top>side_R' }
    p['w'] = 1200.0
    r2 = Builder.build(p)
    j2 = r2['joints'].find { |x| x['id'] == 'top>side_L' }
    assert_in_delta j2['line'][0] + 80, j2['positions'][0], 1e-9, 'giữ điểm chỉnh riêng khi đổi kích thước'
    cam = H.by(r2, 'top')['features'].find { |f| f['op'] == 'cam_housing' }
    assert_in_delta 15.0, cam['diameter'], 1e-9
  end

  def test_validation_codes
    r = built
    parts = Mfg.parts(r['panels'])
    pt = parts.find { |x| x['id'] == 'side_L' }
    pt['features'] << { 'id' => 'bad1', 'type' => 'drill', 'op' => 'x', 'face' => 'A', 'pos' => [2.0, 2.0, 17.0],
                        'dir' => [0, 0, 1], 'diameter' => 8, 'depth' => 20 }
    iss = Mfg.validate(parts, r['joints'] + [{ 'id' => 'ghost', 'a' => 'nope', 'b' => 'side_L', 'positions' => [] }])
    codes = iss.map { |i| i['code'] }
    %w[WRONG_FACE_DIR DEPTH_EXCEEDS_STOCK OUT_OF_AREA ORPHAN_JOINT].each { |c| assert_includes codes, c }
    assert(iss.all? { |i| i.key?('part') })
  end

  def test_export_and_abf_plan_status
    r = built
    parts = Mfg.parts(r['panels'])
    iss = Mfg.validate(parts, r['joints'])
    js = JSON.parse(Mfg.to_json(parts, iss))
    assert_equal false, js['status']['target_compat_verified']
    plan = AbfAdapter.plan(parts, iss)
    assert_equal 'chua_kiem_chung', plan['status']
    assert_equal parts.size, plan['items'].size
    assert Mfg.to_csv_ops(parts).lines.size > 1
  end
end

class TestSections < Minitest::Test
  def mk(id, role, x0, x1, y0, y1, z0, z1, o)
    Builder.box_panel(id, role, x0, x1, y0, y1, z0, z1, o)
  end

  def test_real_penetration_marked_on_receiver
    side = mk('s', 'side', 0, 17, 0, 500, 0, 800, :x)
    shelf = mk('h', 'shelf', 10, 400, 0, 480, 300, 317, :z)
    rows = Sections.scan([side, shelf])
    assert_equal 1, rows.size
    r = rows[0]
    assert_equal 'ok', r['status']
    assert_equal 's', r['receiver']
    assert_in_delta 7.0, r['depth'], 1e-6
    f = Sections.feature_from(r)
    assert_equal 'pocket', f['type']
  end

  def test_bbox_overlap_but_not_real_with_L
    p = H.params('hl.tu_L_mot_thung.v1', 'la' => 1600, 'lb' => 1200, 'd' => 400)
    r = Builder.build(p)
    top = H.by(r, 'top')
    ghost = mk('g', 'side', 800, 817, 100, 600, 700, 790, :x) # nằm ở khoảng trống chữ L, xuyên hộp bao của nóc
    rows = Sections.scan([top, ghost])
    assert_equal 'not_real', rows[0]['status']
  end

  def test_unresolved_receiver_same_priority
    a = mk('a', 'side', 0, 17, 0, 500, 0, 800, :x)
    b = mk('b', 'side', 10, 27, 0, 500, 0, 800, :x)
    rows = Sections.scan([a, b])
    assert_equal 'unresolved', rows[0]['status']
    rows = Sections.scan([a, b], 'receiver_override' => { 'a~b' => 'a' })
    assert_equal 'ok', rows[0]['status']
  end
end

class TestLibrary < Minitest::Test
  def test_multi_folder_shared_settings_and_global_filter
    cfg = Library.default_config
    tid = 'hl.tu_bep_L.v1'
    homes = cfg['links'].select { |l| l['template'] == tid }.map { |l| l['folder'] }
    assert_equal 2, homes.size
    cfg, errs = Library.save_settings(cfg, tid, Library.settings_for(cfg, tid).merge('d' => 600))
    assert_empty errs
    homes.each { |f| assert(Library.list_folder(cfg, f).any? { |c| c['id'] == tid && c['customized'] }) }
    assert_equal 1, Library.filter_type(cfg, 'tu_bep_L').size, 'một kết quả mỗi ID mẫu'
    other = Library.settings_for(cfg, 'hl.khung_tu.v1')
    assert_in_delta 900.0, other['w'], 1e-9, 'mẫu khác không đổi'
    cfg2 = Library.add_to_folder(cfg, 'f_khung', tid)
    cfg2 = Library.add_to_folder(cfg2, 'f_khung', tid)
    assert_equal 1, cfg2['links'].count { |l| l['folder'] == 'f_khung' && l['template'] == tid }, 'thêm lặp không trùng'
    cfg3 = Library.remove_from_folder(cfg2, 'f_khung', tid)
    assert_equal homes.sort, cfg3['links'].select { |l| l['template'] == tid }.map { |l| l['folder'] }.sort
    assert_in_delta 600.0, Library.settings_for(cfg3, tid)['d'], 1e-9
    assert_raises(ValidationError) { Library.remove_from_folder(cfg3, '__all__', tid) }
  end

  def test_settings_validation_and_restore
    cfg = Library.default_config
    tid = 'hl.khung_tu.v1'
    c2, errs = Library.save_settings(cfg, tid, 'w' => 'abc')
    assert errs.key?('w')
    assert_same cfg, c2
    c3, = Library.save_settings(cfg, tid, Library.settings_for(cfg, tid).merge('w' => 1200))
    assert_in_delta 900.0, Library.original_settings(tid)['w'], 1e-9
    assert_in_delta 1200.0, Library.settings_for(c3, tid)['w'], 1e-9
    c4, = Library.save_settings(c3, tid, Library.settings_for(c3, tid).merge('w' => 1300))
    assert_in_delta 1300.0, Library.settings_for(c4, tid)['w'], 1e-9, 'lưu lần nữa thay bộ trước'
  end

  def test_backup_replace_and_invalid_keeps
    cfg = Library.default_config
    cfg, sub = Library.add_folder(cfg, 'Khách A', 'f_khung')
    cfg = Library.add_to_folder(cfg, sub, 'hl.cuc_tren.v1')
    cfg, = Library.save_settings(cfg, 'hl.cuc_tren.v1', Library.settings_for(cfg, 'hl.cuc_tren.v1').merge('h' => 650))
    text = Library.export_backup(cfg, '1.0.0')
    other = Library.default_config
    other, = Library.save_settings(other, 'hl.khung_tu.v1', Library.settings_for(other, 'hl.khung_tu.v1').merge('w' => 777))
    imported = Library.import_backup(text)
    assert_equal cfg['folders'], imported['folders']
    assert_equal cfg['links'].sort_by(&:to_a), imported['links'].sort_by(&:to_a)
    refute imported['settings'].key?('hl.khung_tu.v1'), 'thay toàn bộ, không gộp'
    assert_in_delta 650.0, imported['settings']['hl.cuc_tren.v1']['h'], 1e-9
    bad = JSON.parse(text); bad['links'] << { 'folder' => 'khong_co', 'template' => 'hl.cuc_tren.v1' }
    assert_raises(ValidationError) { Library.import_backup(JSON.generate(bad)) }
    bad2 = JSON.parse(text); bad2['settings']['hl.cuc_tren.v1']['h'] = -5
    assert_raises(ValidationError) { Library.import_backup(JSON.generate(bad2)) }
    assert_raises(ValidationError) { Library.import_backup('{không phải json') }
  end

  def test_all_catalog_templates_build_clean
    Templates.supported.each do |t|
      next if t['geometry'] == 'drawer_box'
      p = H.params(t['id'])
      p['front']['enabled'] = true unless t['front_rule'] == 'open'
      r = Builder.build(p)
      assert_empty r['errors'], "#{t['id']}: #{r['errors']}"
      assert_empty H.overlaps(r['panels']), t['id']
    end
  end
end

class TestAbfRules < Minitest::Test
  def test_tags_follow_observed_shop_convention
    assert_equal 'ABF_D35', AbfRules.tag_for('type' => 'drill', 'op' => 'hinge_cup', 'diameter' => 35.0, 'depth' => 12.5)
    assert_equal 'ABF_D15', AbfRules.tag_for('type' => 'drill', 'op' => 'cam_housing', 'diameter' => 15.0)
    assert_equal 'ABF_RANH_HAU', AbfRules.tag_for('type' => 'groove', 'op' => 'back_groove', 'depth' => 8.0)
    assert_equal 'ABF_POCKET_Z7', AbfRules.tag_for('type' => 'pocket', 'op' => 'section', 'depth' => 7.0, 'through' => false)
    assert_equal 'ABF_CatTrong', AbfRules.tag_for('type' => 'pocket', 'op' => 'section', 'depth' => 17.0, 'through' => true)
  end

  def test_parts_and_csv_carry_abf_tag
    p = H.params('hl.khung_tu.v1', 'top_joint' => 'inset', 'bottom_joint' => 'inset')
    p['joints']['enabled'] = true
    r = Builder.build(p)
    parts = Mfg.parts(r['panels'])
    feats = parts.flat_map { |x| x['features'] }
    assert(feats.all? { |f| f['abf_tag'].to_s.start_with?('ABF_') })
    assert_includes feats.map { |f| f['abf_tag'] }, 'ABF_RANH_HAU'
    assert_includes Mfg.to_csv_ops(parts).lines.first, 'tag_abf'
    assert_match(/Ø15 sâu 12.5 mm/, AbfRules.describe(feats.find { |f| f['op'] == 'cam_housing' }))
  end

  def test_suppressed_feature_not_regenerated
    p = H.params('hl.khung_tu.v1', 'back_mode' => 'groove')
    p['suppressed_features'] = ['side_L:back_groove']
    r = Builder.build(p)
    assert_empty H.by(r, 'side_L')['features']
    refute_empty H.by(r, 'side_R')['features']
    r2 = Builder.build(r['params'].merge('w' => 1000.0))
    assert_empty H.by(r2, 'side_L')['features'], 'đổi kích thước không hồi sinh thao tác đã xóa'
  end
end

class TestPlinthStretcher < Minitest::Test
  def test_plinth_raises_bottom_keeps_total_height
    p = H.params('hl.khung_tu.v1', 'plinth_h' => 80, 'plinth_setback' => 50, 'h' => 2000, 'bottom_joint' => 'overlay')
    p['front']['enabled'] = true
    r = Builder.build(p)
    assert_empty r['errors']
    bot = H.by(r, 'bottom')
    assert_in_delta 80.0, bot['frame']['o'][2], 1e-9, 'đáy nằm trên len chân'
    assert_in_delta 866.0, bot['w'], 1e-9, 'có chân → đáy lọt giữa hai hồi'
    pf = H.by(r, 'plinth_F'); pb = H.by(r, 'plinth_B')
    assert pf && pb
    assert_in_delta 80.0, pf['h'], 1e-9
    assert_in_delta 50.0, H.box(pf)[0][1], 1e-9, 'lùi len chân trước'
    zs = r['panels'].flat_map { |q| b = H.box(q); [b[0][2], b[1][2]] }
    assert_in_delta 0.0, zs.min, 1e-9
    assert_in_delta 2000.0, zs.max, 1e-9
    assert_in_delta 97.0, r['cells'][0]['z0'], 1e-9
    door = r['doors'].first
    assert_in_delta 82.0, door['frame']['o'][2], 1e-9, 'cánh phủ bắt đầu trên len chân'
    assert_empty H.overlaps(r['panels'])
    p['plinth']['h'] = 0.0
    assert_nil H.by(Builder.build(p), 'plinth_F')
  end

  def test_stretchers_replace_top
    p = H.params('hl.tu_bep_duoi.v1', 'top_style' => 'stretchers', 'stretcher_w' => 100, 'plinth_h' => 100, 'back_mode' => 'groove')
    p['joints']['enabled'] = true
    r = Builder.build(p)
    assert_empty r['errors'].select { |e| e['level'] == 'error' }
    assert_nil H.by(r, 'top')
    sf = H.by(r, 'stretcher_F'); sb = H.by(r, 'stretcher_B')
    assert_in_delta 100.0, sf['h'], 1e-9
    assert_in_delta 766.0, sf['w'], 1e-9
    assert(sb['features'].any? { |f| f['op'] == 'back_groove' }, 'xà sau nhận rãnh hậu')
    assert_in_delta 810.0, H.by(r, 'side_L')['h'], 1e-9, 'hồi suốt chiều cao'
    assert_empty H.overlaps(r['panels'])
    assert(r['joints'].any? { |j| j['a'] == 'stretcher_F' }, 'xà có liên kết cam vào hồi')
    errs = Mfg.validate(Mfg.parts(r['panels']), r['joints']).select { |i| i['level'] == 'error' }
    assert_empty errs, errs.first(3).inspect
  end

  def test_groove_not_carved_by_default
    r = Builder.build(H.params('hl.khung_tu.v1', 'back_mode' => 'groove'))
    g = H.by(r, 'side_L')['features'].find { |f| f['op'] == 'back_groove' }
    assert_equal false, g['carve'], 'mặc định không khoét mesh để ABF nhận tấm'
  end

  def test_catalog_defaults_with_plinth_build_clean
    %w[hl.khung_tu.v1 hl.tu_bep_duoi.v1 hl.tu_bep_L.v1].each do |id|
      tpl = Templates.find(id)
      vals, errs = Params.clean_settings(tpl, tpl['defaults'])
      assert_empty errs
      p = Params.build(tpl, vals, 'm')
      p['front']['enabled'] = true
      r = Builder.build(p)
      assert_empty r['errors'].select { |e| e['level'] == 'error' }, id
      assert_empty H.overlaps(r['panels']), id
      assert(r['panels'].any? { |q| q['role'] == 'plinth' }, id)
    end
  end
end

class TestAbfOpsConfig < Minitest::Test
  def teardown; AbfRules.ops = nil; end

  def test_rename_layer_and_instance
    cfg, errs = AbfRules.clean_ops('cam_housing' => { 'layer' => 'CAM_{D}_Z{Z}', 'instance' => 'LoCam' },
                                   'back_groove' => { 'layer' => 'RANH_HAU_7', 'instance' => 'RanhHau' })
    assert_empty errs
    AbfRules.ops = cfg
    f = { 'type' => 'drill', 'op' => 'cam_housing', 'diameter' => 15.0, 'depth' => 12.5 }
    assert_equal 'CAM_15_Z12.5', AbfRules.tag_for(f)
    assert_equal 'LoCam', AbfRules.instance_for(f)
    g = { 'type' => 'groove', 'op' => 'back_groove', 'depth' => 8.0 }
    assert_equal 'RANH_HAU_7', AbfRules.tag_for(g)
    assert_equal 'RanhHau', AbfRules.instance_for(g)
    assert_equal 'ABF_D35', AbfRules.tag_for('type' => 'drill', 'op' => 'hinge_cup', 'diameter' => 35.0), 'mục không sửa giữ mặc định'
  end

  def test_invalid_names_rejected
    _, errs = AbfRules.clean_ops('back_groove' => { 'layer' => '  ', 'instance' => 'a/b' }, 'cam_bolt' => { 'layer' => 'X{Q}', 'instance' => 'ok' })
    assert errs.key?('back_groove.layer')
    assert errs.key?('back_groove.instance')
    assert errs.key?('cam_bolt.layer')
  end
end
