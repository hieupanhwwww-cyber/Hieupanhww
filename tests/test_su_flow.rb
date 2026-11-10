# encoding: UTF-8
# Chạy luồng lớp SketchUp trên API GIẢ LẬP (tests/mock_sketchup.rb). Bắt lỗi tên hàm, luồng dữ liệu,
# operation lồng nhau. KHÔNG chứng minh hành vi hình học/undo trong SketchUp thật.
require 'minitest/autorun'
require 'tmpdir'
require 'json'
ENV['APPDATA'] = Dir.mktmpdir('hltm')
require_relative 'mock_sketchup'
require_relative '../hl_tumodule/main'

S = HungLoan::TuModule::SU
CORE = HungLoan::TuModule::Core

class TestSUFlow < Minitest::Test
  def setup
    Sketchup.reset_model!
    UI.messages.clear
    Dir.glob(File.join(ENV['APPDATA'], 'HungLoanTuModule', '*.json')).each { |f| File.delete(f) }
    S::Prefs.instance_variable_set(:@library, nil)
    S::Prefs.load_abf_ops
    S::Prefs.instance_variable_set(:@library, nil)
  end

  def teardown
    bad = UI.messages.select { |m| m.to_s.start_with?('Lỗi khi cập nhật') }
    assert_empty bad, 'lỗi Ruby bị nuốt trong messagebox'
  end

  def model; Sketchup.active_model; end
  def tpl(id) CORE::Templates.find(id) end
  def settings(id) CORE::Library.settings_for(S::Prefs.library, id) end

  def place(id, place = {})
    g = S::Manager.place_new(tpl(id), settings(id), { 'asm' => nil, 'pos' => [0.0, 0.0, 0.0], 'rot' => 0,
                                                       'origin_tf' => Geom::Transformation.new }.merge(place))
    assert g, "đặt #{id} thất bại: #{UI.messages.last}"
    g
  end

  def asm_of(g) S::Manager.asm_of(g) end
  def params(g) S::Store.params(g) end
  def rec(g) S::Manager.record(g, params(g)) end

  def test_place_and_render
    g = place('hl.khung_tu.v1')
    asm = asm_of(g)
    assert S::Store.assembly?(asm)
    pans = S::Store.panels_in(g)
    roles = pans.map { |p| p.get_attribute(S::Store::DICT, 'role') }
    %w[side top bottom back].each { |r| assert_includes roles, r }
    assert model.ops.count { |o| o[0] == :start } == 1, 'một thao tác đặt = một operation'
    assert_equal :commit, model.ops.last[0]
  end

  def test_stack_link_width_bidirectional_via_properties
    lo = place('hl.khung_tu.v1')
    asm = asm_of(lo)
    up = place('hl.cuc_tren.v1', 'asm' => asm, 'pos' => [0.0, 0.0, params(lo)['h']], 'rot' => 0,
                                 'link' => { 'type' => 'stack', 'lower' => params(lo)['id'] },
                                 'dims' => { 'w' => params(lo)['w'], 'd' => params(lo)['d'] })
    S::Props.apply_module(up, 'w' => '1100')
    assert_in_delta 1100.0, params(lo)['w'], 1e-6
    S::Props.apply_module(lo, 'd' => '600')
    assert_in_delta 600.0, params(up)['d'], 1e-6
    S::Props.apply_module(lo, 'h' => '1800')
    assert_in_delta 1800.0, rec(up)['pos'][2], 1e-6, 'cục trên nằm trên nóc cục dưới'
    # Move cục dưới → cục trên đi cùng
    lo.transformation = Geom::Transformation.new(S::Units.pt([300.0, 0, 0]))
    S::Actions.on_module_transformed(lo)
    assert_in_delta 300.0, rec(up)['pos'][0], 1e-6
  end

  def test_kitchen_pair
    lo = place('hl.tu_bep_duoi.v1')
    asm = asm_of(lo)
    lp = params(lo)
    up = place('hl.tu_bep_tren.v1', 'asm' => asm, 'pos' => [0.0, lp['d'] - 350.0, lp['h'] + 600.0], 'rot' => 0,
                                    'link' => { 'type' => 'kitchen', 'lower' => lp['id'] }, 'dims' => { 'w' => lp['w'] }, 'gap' => 600.0)
    S::Props.apply_module(lo, 'd' => '600')
    r = rec(up)
    assert_in_delta 600.0, r['pos'][1] + params(up)['d'], 1e-6, 'thẳng mặt sau'
    assert_in_delta 350.0, params(up)['d'], 1e-6
    z = r['pos'][2]
    S::Props.apply_module(lo, 'h' => '900')
    assert_in_delta z, rec(up)['pos'][2], 1e-6, 'giữ cao độ tủ trên'
    gaps = S::Store.asm_data(asm)['gaps']
    assert_in_delta 510.0, gaps.values.first, 1e-6
    S::Props.apply_module(lo, 'h' => '1600')
    assert(UI.messages.last.to_s.include?('giao tủ trên'), 'báo lỗi khi tủ dưới giao tủ trên')
    assert_in_delta 900.0, params(lo)['h'], 1e-6, 'thay đổi bị từ chối, giữ trạng thái hợp lệ'
  end

  def test_divider_doors_delete_and_scale
    g = place('hl.khung_tu.v1')
    S::Props.apply_module(g, 'front_enabled' => true, 'door_count:side_L|side_R' => '1')
    assert_equal 1, S::Store.panels_in(g).count { |p| p.get_attribute(S::Store::DICT, 'role') == 'door' }
    b = S::Manager.build(params(g))
    S::Actions.insert_divider(g, b['cells'][0]['id'], 'x', 450.0)
    assert_equal 2, S::Store.panels_in(g).count { |p| p.get_attribute(S::Store::DICT, 'role') == 'door' }, 'thêm vách → 2 cánh'
    part = S::Store.panels_in(g).find { |p| p.get_attribute(S::Store::DICT, 'role') == 'partition' }
    lid = part.get_attribute(S::Store::DICT, 'local_id')
    # Move vách 100 mm
    part.transformation = Geom::Transformation.new(S::Units.pt([100.0, 0, 0])) * part.transformation
    S::Actions.on_panel_transformed(part)
    dv = S::Manager.build(params(g))['dividers'].first
    assert_in_delta 550.0, dv['center'], 1e-6
    # Xóa vách native
    S::Actions.on_panels_removed(g, [lid])
    assert_equal 'leaf', params(g)['interior']['type']
    # Xóa hồi: không hồi sinh
    S::Actions.on_panels_removed(g, ['side_R'])
    assert_includes params(g)['suppressed'], 'side_R'
    S::Props.apply_module(g, 'h' => '2100')
    refute(S::Store.panels_in(g).any? { |p| p.get_attribute(S::Store::DICT, 'local_id') == 'side_R' })
    # Scale native module 1.5× chiều rộng
    w0 = params(g)['w']
    g.transformation = g.transformation * Geom::Transformation.scaling(1.5, 1, 1)
    S::Actions.on_module_transformed(g)
    assert_in_delta w0 * 1.5, params(g)['w'], 1e-6
    a = S::Units.axes_scale(g.transformation)
    assert_in_delta 1.0, a['sx'], 1e-9, 'transformation chuẩn hóa về scale 1, độ dày giữ trong hình học'
  end

  def test_assembly_scale_height_proportional
    lo = place('hl.khung_tu.v1')
    asm = asm_of(lo)
    up = place('hl.cuc_tren.v1', 'asm' => asm, 'pos' => [0.0, 0.0, 2000.0], 'rot' => 0,
                                 'link' => { 'type' => 'stack', 'lower' => params(lo)['id'] }, 'dims' => { 'w' => 900.0, 'd' => 580.0 })
    asm.transformation = asm.transformation * Geom::Transformation.scaling(1, 1, 1.2)
    S::Actions.on_assembly_transformed(asm)
    assert_in_delta 2400.0, params(lo)['h'], 1e-6
    assert_in_delta 600.0, params(up)['h'], 1e-6
    assert_in_delta 1.0, S::Units.axes_scale(asm.transformation)['sz'], 1e-9
  end

  def test_copy_gets_new_id
    g = place('hl.khung_tu.v1')
    asm = asm_of(g)
    cp = g.shallow_copy_into(asm.definition)
    asm.entities.items << cp
    assert_equal params(g)['id'], params(cp)['id']
    S::Props.apply_module(cp, 'w' => '700')
    refute_equal params(g)['id'], params(cp)['id'], 'bản copy có ID riêng'
    assert_in_delta 900.0, params(g)['w'], 1e-6, 'sửa bản copy không đổi bản gốc'
    refute_same g.definition, cp.definition
  end

  def test_drawers_hinges_cams_sections_export
    g = place('hl.khung_tu.v1', 'pos' => [0.0, 0.0, 0.0])
    S::Props.apply_module(g, 'top_joint' => 'inset', 'bottom_joint' => 'inset', 'w' => '634', 'front_enabled' => true)
    b = S::Manager.build(params(g))
    S::Actions.add_drawers(g, b['cells'][0]['id'], [100.0], 'height' => 150, 'rail_length' => 450, 'side_t' => 15, 'bottom_t' => 7)
    box = S::Manager.build(params(g))['boxes'][0]
    assert_in_delta 574.0, box['outer_w'], 1e-6
    model.selection.clear; model.selection.add(g)
    S::Actions.auto_hinges
    assert params(g)['hinges']['enabled']
    S::Actions.apply_joints(g => {})
    assert params(g)['joints']['enabled']
    asm = asm_of(g)
    rows, = S::Actions.scan_sections(asm)
    assert(rows.all? { |r| %w[ok covered not_real unresolved].include?(r['status']) })
    parts, joints, issues = S::Export.check(model)
    assert parts.size > 5
    assert(parts.any? { |p| p['features'].any? { |f| f['op'] == 'hinge_cup' } })
    errs = issues.select { |i| i['level'] == 'error' }
    assert_empty errs, errs.first(3).inspect
    refute_empty joints
    S::Export.cmd_snapshot
    snap = model.entities.find { |e| e.is_a?(Sketchup::Group) && e.get_attribute(S::Export::DICT, 'kind') == 'snapshot' }
    assert snap, UI.messages.last
    assert_equal parts.size, snap.entities.items.size
    S::Export.cmd_snapshot
    snaps = model.entities.select { |e| e.is_a?(Sketchup::Group) && e.valid? && e.get_attribute(S::Export::DICT, 'kind') == 'snapshot' }
    assert_equal 1, snaps.size, 'tạo lại không cộng dồn bản cũ'
    path = File.join(ENV['APPDATA'], 'out.json')
    $mock_save_path = path
    S::Export.cmd_export_files
    js = JSON.parse(File.read(path))
    assert_equal 'HLTM-MFG', js['format']
    assert File.exist?(path.sub('.json', '_thao_tac.csv'))
  end

  def test_dialogs_library_settings_properties
    S::LibraryDialog.show
    d = S::LibraryDialog.dialog
    r = d.js('init')
    assert r['ok']
    r = d.js('filter', 'type' => 'tu_bep_L')
    assert_equal 1, r['cards'].size
    r = d.js('folder_add', 'name' => 'Khách A', 'parent' => 'f_khung')
    fid = r['select']
    r = d.js('add_to_folder', 'folder' => fid, 'tid' => 'hl.tu_bep_tren.v1')
    assert r['ok']
    r = d.js('list', 'folder' => fid)
    assert_equal ['hl.tu_bep_tren.v1'], r['cards'].map { |c| c['id'] }
    d.js('gear', 'tid' => 'hl.tu_bep_tren.v1')
    sd = S::SettingsDialog.instance_variable_get(:@d)
    r = sd.js('init')
    assert_equal 'hl.tu_bep_tren.v1', r['tid']
    r = sd.js('save', 'tid' => 'hl.tu_bep_tren.v1', 'values' => r['values'].merge('d' => 'x'))
    refute r['ok']
    assert r['errors'].key?('d')
    r = sd.js('save', 'tid' => 'hl.khung_tu.v1', 'values' => {})
    refute r['ok'], 'chặn lưu nhầm mẫu khác'
    v = sd.js('init')['values']
    r = sd.js('save', 'tid' => 'hl.tu_bep_tren.v1', 'values' => v.merge('d' => 320))
    assert r['ok']
    assert_in_delta 320.0, CORE::Library.settings_for(S::Prefs.library, 'hl.tu_bep_tren.v1')['d'], 1e-9
    r = sd.js('restore', 'tid' => 'hl.tu_bep_tren.v1')
    assert_in_delta 350.0, r['values']['d'], 1e-9
    assert_in_delta 320.0, CORE::Library.settings_for(S::Prefs.library, 'hl.tu_bep_tren.v1')['d'], 1e-9, 'khôi phục chưa lưu'
    # Bản sao lưu: xuất rồi nhập thay toàn bộ
    $mock_save_path = File.join(ENV['APPDATA'], 'bk.json')
    d.js('export')
    S::Prefs.library = CORE::Library.default_config
    $mock_open_path = $mock_save_path
    r = d.js('import')
    assert r['ok']
    assert(S::Prefs.library['folders'].any? { |f| f['name'] == 'Khách A' })
    # Thuộc tính
    g = place('hl.tu_ngan_keo3.v1')
    model.selection.clear; model.selection.add(g)
    S::PropertiesDialog.show
    pd = S::PropertiesDialog.instance_variable_get(:@d)
    r = pd.js('init')
    assert_equal 'module', r['kind']
    r2 = pd.js('apply', 'target' => r['target'], 'values' => { 'front_enabled' => true, 'drawer_count' => '4', 'drawer_ratios' => '2,1,1,1' })
    assert r2['ok'], r2['error']
    faces = S::Store.panels_in(g).count { |p| p.get_attribute(S::Store::DICT, 'role') == 'drawer_face' }
    assert_equal 4, faces
    r3 = pd.js('apply', 'target' => 'mod:khac', 'values' => { 'h' => '500' })
    refute r3['ok'], 'không áp nháp sang đối tượng khác'
    pan = S::Store.panels_in(g).find { |p| p.get_attribute(S::Store::DICT, 'role') == 'side' }
    model.selection.clear; model.selection.add(pan)
    r = pd.js('init')
    assert_equal 'panel', r['kind']
  end

  def test_abf_cases_build_and_validate
    S::TestCases.build_all
    asms = model.entities.select { |e| S::Store.assembly?(e) }
    assert_equal 4, asms.size, UI.messages.last
    parts, joints, issues = S::Export.check(model)
    errs = issues.select { |i| i['level'] == 'error' }
    assert_empty errs, errs.first(3).inspect
    secs = parts.flat_map { |p| p['features'] }.select { |f| f['op'] == 'section' }
    assert_equal 1, secs.size, 'ca 3 có đúng một tiết diện'
    assert(parts.any? { |p| p['outline_mesh'].size == 6 }, 'nóc chữ L thật')
    assert(parts.count { |p| p['role'] == 'drawer_side' } >= 6)
    refute_empty joints
    $mock_save_path = File.join(ENV['APPDATA'], 'cases.json')
    S::Export.cmd_export_files
    assert File.exist?($mock_save_path)
  end

  def test_survey_writes_json_and_rolls_back
    dir = Dir.mktmpdir('skp')
    File.write(File.join(dir, 'a.skp'), 'x')
    $mock_dir = dir
    $mock_save_path = File.join(dir, 'ks.json')
    S::Commands.run('survey')
    js = JSON.parse(File.read($mock_save_path))
    assert_equal 'HLTM-SURVEY', js['format']
    f = js['files'][0]
    assert_nil f['error']
    assert_equal 1, f['nodes'].size
    assert_equal 1, f['nodes'][0]['loose']['faces']
    assert_equal 1, f['nodes'][0]['children'].size
    assert_equal :abort, model.ops.last[0], 'model đang mở không bị thay đổi'
  end

  def test_panel_machining_table_and_delete
    g = place('hl.khung_tu.v1')
    S::Props.apply_module(g, 'top_joint' => 'inset', 'bottom_joint' => 'inset', 'front_enabled' => true,
                             'door_count:side_L|side_R' => '1', 'hinges_enabled' => true, 'joints_enabled' => true)
    pan = lambda { |lid| S::Store.panels_in(g).find { |x| x.get_attribute(S::Store::DICT, 'local_id') == lid } }
    feats = lambda { |lid| S::Manager.build(params(g))['panels'].find { |x| x['local_id'] == lid }['features'] }
    desc = S::Props.panel(pan.call('top'))
    sec = desc['sections'].find { |x| x['title'].start_with?('Gia công CNC') }
    assert sec, 'tấm có bảng gia công'
    assert(sec['fields'].any? { |f| f['value'].to_s.include?('[ABF-D15]') })
    assert(sec['fields'].any? { |f| f['value'].to_s.include?('[ABF_SOI HAU]') })
    # Xóa một lỗ cam → xóa cả bộ liên kết của cạnh đó (không để lỗ mồ côi)
    cam = feats.call('top').find { |f| f['op'] == 'cam_housing' }
    S::Props.apply_panel(pan.call('top'), "del_feat:#{cam['id']}" => true)
    jid = cam['source']['joint']
    assert(feats.call('top').none? { |f| f.dig('source', 'joint') == jid })
    other = jid.split('>').last
    assert(feats.call(other).none? { |f| f.dig('source', 'joint') == jid }, 'lỗ chốt bên tấm kia cũng được dọn')
    # Xóa một lỗ cốc bản lề
    door = S::Store.panels_in(g).find { |x| x.get_attribute(S::Store::DICT, 'role') == 'door' }
    dl = door.get_attribute(S::Store::DICT, 'local_id')
    n0 = feats.call(dl).size
    S::Props.apply_panel(pan.call(dl), "del_feat:#{feats.call(dl).first['id']}" => true)
    assert_equal n0 - 1, feats.call(dl).size
    # Xóa rãnh hậu rồi khôi phục
    S::Props.apply_panel(pan.call('side_L'), 'del_feat:side_L:back_groove' => true)
    assert(feats.call('side_L').none? { |f| f['op'] == 'back_groove' })
    S::Props.apply_module(g, 'h' => '1900')
    assert(feats.call('side_L').none? { |f| f['op'] == 'back_groove' }, 'không tự hồi sinh')
    d2 = S::Props.panel(pan.call('side_L'))
    assert(d2['sections'].any? { |x| x['title'] == 'Thao tác đã xóa' })
    S::Props.apply_panel(pan.call('side_L'), 'restore_feat:side_L:back_groove' => true)
    assert(feats.call('side_L').any? { |f| f['op'] == 'back_groove' })
    _parts, _j, issues = S::Export.check(model)
    errs = issues.select { |i| i['level'] == 'error' }
    assert_empty errs, errs.first(3).inspect
    assert(model.layers['ABF_D35'], 'dấu lỗ cốc nằm trên tag ABF_D35')
    assert(model.layers['ABF_SOI HAU'])
  end

  def test_abf_style_marks_plinth_and_stretchers
    g = place('hl.khung_tu.v1')
    side = S::Store.panels_in(g).find { |x| x.get_attribute(S::Store::DICT, 'local_id') == 'side_L' }
    kids = side.entities.items.select { |e| e.is_a?(Sketchup::Group) }
    assert_equal ['_ABF_Intersect'], kids.map(&:name), 'rãnh hậu là nhóm _ABF_Intersect nằm ngay trong tấm (1 cấp)'
    assert_equal 'marks', kids[0].get_attribute(S::Store::DICT, 'kind')
    assert_equal 1, kids[0].entities.items.count { |e| e.is_a?(Sketchup::Face) }, 'dấu là MẶT trên mặt ván'
    assert_equal 1, side.entities.items.count { |e| e.is_a?(Sketchup::Face) }, 'khối tấm không bị khoét (chỉ 1 lần pushpull)'
    assert(S::Store.panels_in(g).any? { |x| x.get_attribute(S::Store::DICT, 'role') == 'plinth' }, 'khung tủ mặc định có len chân')
    desc = S::Props.module(g)
    sec = desc['sections'].find { |x| x['title'] == 'Len chân & xà' }
    assert_in_delta 50.0, sec['fields'].find { |f| f['key'] == 'plinth_h' }['value'], 1e-9
    S::Props.apply_module(g, 'plinth_h' => '120', 'plinth_back' => false, 'top_style' => 'stretchers', 'stretcher_w' => '90',
                             'top_joint' => 'inset', 'joints_enabled' => true)
    ids = S::Store.panels_in(g).map { |x| x.get_attribute(S::Store::DICT, 'local_id') }
    assert_includes ids, 'plinth_F'
    refute_includes ids, 'plinth_B'
    assert_includes ids, 'stretcher_F'
    refute_includes ids, 'top'
    assert_in_delta 120.0, params(g)['plinth']['h'], 1e-9
    S::Props.apply_module(g, 'plinth_h' => '5')
    assert_in_delta 120.0, params(g)['plinth']['h'], 1e-9, 'giá trị sai bị từ chối'
    S::Props.apply_module(g, 'plinth_h' => '0')
    refute(S::Store.panels_in(g).any? { |x| x.get_attribute(S::Store::DICT, 'role') == 'plinth' })
    _p, _j, issues = S::Export.check(model)
    assert_empty issues.select { |i| i['level'] == 'error' }
  end

  def test_general_settings_rename_layer_instance_and_regen
    g = place('hl.khung_tu.v1')
    S::Props.apply_module(g, 'top_joint' => 'inset', 'joints_enabled' => true)
    S::Commands.run('general')
    d = S::GeneralDialog.instance_variable_get(:@d)
    r = d.js('init')
    ops = r['ops'].map { |o| [o['key'], { 'layer' => o['layer'], 'instance' => o['instance'] }] }.to_h
    cam = r['cam'].map { |c| [c['key'], c['value']] }.to_h
    bad = d.js('save', 'ops' => ops.merge('back_groove' => { 'layer' => '', 'instance' => 'x' }), 'cam' => cam)
    refute bad['ok']
    assert bad['errors'].key?('back_groove.layer')
    ops['back_groove'] = { 'layer' => 'XUONG_RANH_HAU', 'instance' => 'RanhHau' }
    ops['cam_housing'] = { 'layer' => 'XUONG_CAM{D}', 'instance' => 'LoCam' }
    ok = d.js('save', 'ops' => ops, 'cam' => cam.merge('cam_depth' => '13'), 'regen' => true)
    assert ok['ok'], ok['error']
    side = S::Store.panels_in(g).find { |x| x.get_attribute(S::Store::DICT, 'local_id') == 'side_L' }
    names = side.entities.items.select { |e| e.is_a?(Sketchup::Group) }.map(&:name)
    assert_includes names, 'RanhHau', 'tủ đã đặt được cập nhật tên instance mới'
    assert model.layers['XUONG_RANH_HAU']
    top = S::Store.panels_in(g).find { |x| x.get_attribute(S::Store::DICT, 'local_id') == 'top' }
    cam_g = top.entities.items.find { |e| e.is_a?(Sketchup::Group) && e.name == 'LoCam' }
    assert cam_g
    assert_equal 'XUONG_CAM15', cam_g.layer
    parts, = S::Export.check(model)
    feats = parts.flat_map { |x| x['features'] }
    assert_includes feats.map { |f| f['abf_tag'] }, 'XUONG_RANH_HAU'
    assert_in_delta 13.0, feats.find { |f| f['op'] == 'cam_housing' }['depth'], 1e-9, 'thông số cam mới được áp dụng'
    # nhớ qua phiên
    CORE::AbfRules.ops = nil
    S::Prefs.load_abf_ops
    assert_equal 'XUONG_RANH_HAU', CORE::AbfRules.ops['back_groove']['layer']
  end

  def test_abf_native_objects_and_attributes
    g = place('hl.khung_tu.v1')
    S::Props.apply_module(g, 'top_joint' => 'inset', 'joints_enabled' => true, 'front_enabled' => true, 'hinges_enabled' => true)
    pg = lambda { |lid| S::Store.panels_in(g).find { |x| x.get_attribute(S::Store::DICT, 'local_id') == lid } }
    kids = lambda { |lid, name| pg.call(lid).entities.items.select { |e| e.is_a?(Sketchup::Group) && e.name == name } }
    abf = lambda { |e, k| e.get_attribute('ABF', k) }
    top = pg.call('top'); side = pg.call('side_L'); back = pg.call('back')
    cams = kids.call('top', '_ABF_minifixBolts')
    assert_equal 4, cams.size, 'mỗi cốc cam Ø15 là một nhóm riêng trên tấm mang cam'
    c0 = cams.find { |e| abf.call(e, 'minifix-group-a-id') == side.persistent_id }
    assert c0, 'cốc cam trỏ tới ID tấm nhận lỗ Ø5 (tấm A của ABF)'
    assert_equal true, abf.call(c0, 'is-minifix-part-b')
    assert_equal 'CAM_17MM', abf.call(c0, 'setting-name')
    assert_kind_of Geom::Vector3d, abf.call(c0, 'minifix-up-face-normal')
    assert_equal 'ABF-D15', c0.layer
    bases = kids.call('side_L', '_ABF_minifixPlasticBase')
    assert(bases.any? { |e| abf.call(e, 'minifix-group-b-id') == top.persistent_id && abf.call(e, 'is-minifix-part-a') == true })
    assert_equal 'ABF-D5', bases[0].layer
    sd = kids.call('top', '_ABF_sideDrill'); sdd = kids.call('top', '_ABF_sideDrillDepth')
    assert_equal cams.size, sd.size, 'số lỗ cạnh = số cốc cam trên cùng tấm (như dự án ABF thật)'
    assert_equal cams.size, sdd.size
    assert_empty kids.call('side_L', '_ABF_sideDrillDepth').select { |e| abf.call(e, 'minifix-group-a-id') == side.persistent_id }
    assert_equal 'ABF-DSIDE-8', sd[0].layer
    assert_includes cams.map(&:persistent_id), abf.call(sd[0], 'face-drill-group-id'), 'lỗ cạnh trỏ tới nhóm cốc cam Ø15'
    assert_equal true, abf.call(sdd[0], 'is-side-drill-depth')
    assert_includes [side.persistent_id, pg.call('side_R').persistent_id], abf.call(sdd[0], 'minifix-group-a-id')
    assert_equal 'Hồi Trái', side.name
    assert_equal 'Đình', top.name
    inter = kids.call('side_L', '_ABF_Intersect').first
    assert_equal back.persistent_id, abf.call(inter, 'intersect-group-b-id'), 'rãnh hậu trỏ tới tấm hậu'
    assert_equal true, abf.call(inter, 'is-intersect')
    assert_in_delta 2.0, abf.call(inter, 'intersect-x'), 1e-9
    assert_equal 'SOI ÂM 9MM - RÃNH HẬU', abf.call(inter, 'setting-name')
    assert_equal 'ABF_SOI HAU', inter.layer
    door = S::Store.panels_in(g).find { |x| x.get_attribute(S::Store::DICT, 'role') == 'door' }
    cups = door.entities.items.select { |e| e.is_a?(Sketchup::Group) && e.name == 'ABF_D35' }
    refute_empty cups
    assert_equal true, abf.call(cups[0], 'is-hinge-part-b')
    assert_equal 'BẢN LỀ A - Loại A', abf.call(cups[0], 'setting-name')
    # đổi tên setting trong Cài đặt chung → đối tượng mang tên mới
    S::Commands.run('general')
    d = S::GeneralDialog.instance_variable_get(:@d)
    r = d.js('init')
    ops = r['ops'].map { |o| [o['key'], { 'layer' => o['layer'], 'instance' => o['instance'] }] }.to_h
    cam = r['cam'].map { |c| [c['key'], c['value']] }.to_h
    sets = r['settings'].map { |x| [x['key'], x['value']] }.to_h
    ok = d.js('save', 'ops' => ops, 'cam' => cam, 'settings' => sets.merge('cam' => 'CAM_18MM'), 'regen' => true)
    assert ok['ok'], ok['error']
    nb = kids.call('top', '_ABF_minifixBolts').first
    assert_equal 'CAM_18MM', nb.get_attribute('ABF', 'setting-name')
    S::Export.cmd_snapshot
    snap = model.entities.find { |e| e.is_a?(Sketchup::Group) && e.get_attribute(S::Export::DICT, 'kind') == 'snapshot' }
    stop = snap.entities.items.find { |e| e.get_attribute(S::Export::DICT, 'part_id').to_s.end_with?('/top') }
    sb = stop.entities.items.find { |e| e.is_a?(Sketchup::Group) && e.name == '_ABF_minifixBolts' }
    assert sb, 'bản gia công cũng có đối tượng ABF'
    sside = snap.entities.items.find { |e| e.get_attribute(S::Export::DICT, 'part_id').to_s.end_with?('/side_L') || e.get_attribute(S::Export::DICT, 'part_id').to_s.end_with?('/side_R') }
    ids = snap.entities.items.map(&:persistent_id)
    assert_includes ids, sb.get_attribute('ABF', 'minifix-group-a-id'), 'ID đối tác trong bản gia công trỏ tới tấm của bản gia công'
    assert sside
  end

  def test_selftest_runs_and_cleans_up
    $mock_save_path = File.join(ENV['APPDATA'], 'st.json')
    n0 = model.entities.to_a.size
    S::SelfTest.run
    rep = File.read(S::Prefs.path('tu_kiem_tra.txt'), encoding: 'UTF-8')
    assert_match(/KẾT QUẢ: \d+ đạt, 0 lỗi/, rep, rep[0, 3000])
    assert_equal n0, model.entities.to_a.reject { |e| !e.valid? }.size, 'tự kiểm tra xóa sạch những gì đã thêm'
  end

  def test_selftest_reports_real_failures
    $mock_save_path = File.join(ENV['APPDATA'], 'st2.json')
    orig = S::Props.method(:apply_module)
    S::Props.define_singleton_method(:apply_module) { |*_a| raise NoMethodError, 'undefined method `entityID\' for Entities' }
    begin
      S::SelfTest.run
    ensure
      S::Props.define_singleton_method(:apply_module, orig)
    end
    rep = File.read(S::Prefs.path('tu_kiem_tra.txt'), encoding: 'UTF-8')
    assert_match(/LỖI\s+  mặt trước \+ cam/, rep)
    assert_match(/undefined method `entityID'/, rep)
    assert_match(/KẾT QUẢ: \d+ đạt, [1-9]\d* lỗi/, rep)
  end

  def test_safe_guard_logs_and_does_not_raise
    File.delete(S::Safe.log_path) if File.exist?(S::Safe.log_path)
    r = S::Safe.guard('thử nghiệm') { raise NoMethodError, 'undefined method foo' }
    assert_nil r
    assert_match(/undefined method foo/, UI.messages.last)
    assert_match(/thử nghiệm: NoMethodError/, File.read(S::Safe.log_path, encoding: 'UTF-8'))
    n = UI.messages.size
    S::Safe.guard('thử nghiệm') { raise 'lại lỗi' }
    assert_equal n, UI.messages.size, 'cùng một chỗ không báo lại trong 30 giây'
    # lỗi dữ liệu người dùng: chỉ thông báo, không ghi nhật ký lỗi
    assert_equal :x, S::Safe.guard('v', default: :x) { raise CORE::ValidationError, 'số sai' }
  end

  def test_tool_errors_are_contained
    klass = Class.new do
      def onMouseMove(*) raise 'rê lỗi' end
      def draw(_v) raise 'vẽ lỗi' end
      def onLButtonDown(*) raise 'click lỗi' end
      def onKeyDown(*) raise 'phím lỗi' end
      def enableVCB?; raise 'vcb lỗi' end
    end
    S::Safe.protect_tool(klass)
    t = klass.new
    model.select_tool(t)
    UI.messages.clear
    assert_nil t.onMouseMove(0, 1, 1, nil)
    assert_nil t.draw(nil)
    assert_nil t.onLButtonDown(0, 1, 1, nil)
    assert_equal false, t.onKeyDown(9, 0, 0, nil)
    assert_equal false, t.enableVCB?
    assert_nil model.tool, 'quá nhiều lỗi → công cụ tự tắt'
    assert(UI.messages.size <= 4, "không spam hộp thoại: #{UI.messages.size}")
  end

  def test_tools_construct
    S::Commands.start_place('hl.khung_tu.v1')
    assert_kind_of S::PlaceTool, model.tool
    S::Commands.start_place('hl.thung_ngan_keo.v1')
    assert_kind_of S::DrawerTool, model.tool
    S::Commands.run('partition'); assert_kind_of S::DividerTool, model.tool
    S::Commands.run('hinge_manual'); assert_kind_of S::HingeTool, model.tool
    g = place('hl.khung_tu.v1')
    model.selection.clear; model.selection.add(asm_of(g))
    S::Commands.run('cam'); assert_kind_of S::CamTool, model.tool
    S::Commands.run('sections'); assert_kind_of S::SectionTool, model.tool
    model.tool.onReturn(nil)
  end
end
