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
