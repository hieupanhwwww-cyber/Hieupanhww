# encoding: UTF-8
# Công cụ tương tác trên view GIẢ LẬP: rê, Tab, gõ số + Enter, click. Không thay kiểm thử host.
require 'minitest/autorun'
require 'tmpdir'
ENV['APPDATA'] = Dir.mktmpdir('hltm')
require_relative 'mock_sketchup'
require_relative '../hl_tumodule/main'

S = HungLoan::TuModule::SU unless defined?(S)
CORE = HungLoan::TuModule::Core unless defined?(CORE)

class MockPH
  def initialize(path) @path = path end
  def do_pick(*_a) true end
  def count; @path ? 1 : 0; end
  def path_at(_i) @path end
end

class MockView
  attr_accessor :path, :ray
  def pick_helper; MockPH.new(@path); end
  def pickray(_x, _y) @ray end
  def screen_coords(p) Geom::Point3d.new(p.x * 10, p.y * 10, 0) end
  def method_missing(_n, *_a) nil end
  def respond_to_missing?(*_a) true end
end

class TestSUTools < Minitest::Test
  def setup
    Sketchup.reset_model!
    UI.messages.clear
    Dir.glob(File.join(ENV['APPDATA'], 'HungLoanTuModule', '*.json')).each { |f| File.delete(f) }
    S::Prefs.instance_variable_set(:@library, nil)
    S::Prefs.load_abf_ops
  end

  def model; Sketchup.active_model; end
  def mm(*a) S::Units.pt(a) end

  def place(id, extra = {})
    t = CORE::Templates.find(id)
    S::Manager.place_new(t, CORE::Library.settings_for(S::Prefs.library, id),
                         { 'asm' => nil, 'pos' => [0.0, 0.0, 0.0], 'rot' => 0, 'origin_tf' => Geom::Transformation.new }.merge(extra))
  end

  def front_ray(x, z) [mm(x, -1000, z), Geom::Vector3d.new(0, 1, 0)] end

  def test_divider_tool_tab_type_enter
    g = place('hl.khung_tu.v1')
    asm = S::Manager.asm_of(g)
    v = MockView.new
    v.path = [asm, g]
    v.ray = front_ray(450, 1000)
    tool = S::DividerTool.new('x')
    tool.activate
    tool.onMouseMove(0, 10, 10, v)
    tool.onKeyDown(9, false, 0, v) # Tab → mặt phải
    tool.onKeyDown(51, false, 0, v) # bắt đầu gõ số → khóa mốc
    v.ray = front_ray(800, 1000) # chuột chạy sang phải không ghi đè mốc đã khóa
    tool.onMouseMove(0, 50, 10, v)
    tool.draw(v)
    tool.onUserText('300', v)
    dv = S::Manager.build(S::Store.params(g))['dividers'].first
    assert dv, UI.messages.last
    assert_in_delta 17 + 300 - 8.5, dv['center'], 1e-6, 'điểm bám mặt phải cách mặt trong trái 300 mm'
  end

  def test_shelf_tool_click_and_drawer_tool
    g = place('hl.khung_tu.v1')
    S::Props.apply_module(g, 'w' => '634')
    asm = S::Manager.asm_of(g)
    v = MockView.new
    v.path = [asm, g]
    v.ray = front_ray(300, 400)
    t = S::DividerTool.new('z')
    t.onMouseMove(0, 1, 1, v)
    t.onLButtonDown(0, 1, 1, v)
    sh = S::Manager.build(S::Store.params(g))['dividers'].find { |d| d['axis'] == 'z' }
    assert_in_delta 400.0, sh['center'], 1e-6
    v.ray = front_ray(300, 100)
    s = CORE::Library.settings_for(S::Prefs.library, 'hl.thung_ngan_keo.v1')
    dt = S::DrawerTool.new(s, 'single')
    dt.onMouseMove(0, 1, 1, v)
    dt.draw(v)
    dt.onUserText('20', v)
    b = S::Manager.build(S::Store.params(g))
    box = b['boxes'].first
    assert box, UI.messages.last
    assert_in_delta 600.0 - 26.0, box['outer_w'], 1e-6
    assert_in_delta 50.0 + 17.0 + 20.0, box['z0'], 1e-6, 'đo từ mặt trong đáy khoang (đáy nằm trên len chân 50)'
  end

  def test_place_tool_free_and_stack_snap
    tool = S::PlaceTool.new(CORE::Templates.find('hl.khung_tu.v1'), CORE::Library.settings_for(S::Prefs.library, 'hl.khung_tu.v1'))
    v = MockView.new
    tool.onMouseMove(0, 5, 5, v)
    tool.onKeyDown(9, false, 0, v)
    tool.draw(v)
    tool.onLButtonDown(0, 5, 5, v)
    assert_nil model.tool, 'đặt xong kết thúc lệnh'
    asm = model.entities.find { |e| S::Store.assembly?(e) }
    lo = S::Store.modules_in(asm).first
    up_tpl = CORE::Templates.find('hl.cuc_tren.v1')
    t2 = S::PlaceTool.new(up_tpl, CORE::Library.settings_for(S::Prefs.library, 'hl.cuc_tren.v1'))
    v.path = [asm, lo]
    v.ray = front_ray(100, 1000)
    t2.onMouseMove(0, 5, 5, v)
    t2.draw(v)
    t2.onLButtonDown(0, 5, 5, v)
    mods = S::Store.modules_in(asm)
    assert_equal 2, mods.size
    links = S::Store.asm_data(asm)['links']
    assert_equal 'stack', links.first['type']
    up = mods.find { |m| S::Store.params(m)['template_id'] == 'hl.cuc_tren.v1' }
    assert_in_delta 2000.0, S::Manager.record(up, S::Store.params(up))['pos'][2], 1e-6
  end

  def test_hinge_tool_click_on_door
    g = place('hl.khung_tu.v1')
    S::Props.apply_module(g, 'front_enabled' => true, 'door_count:side_L|side_R' => '1', 'hinges_enabled' => true)
    asm = S::Manager.asm_of(g)
    door = S::Store.panels_in(g).find { |p| p.get_attribute(S::Store::DICT, 'role') == 'door' }
    v = MockView.new
    v.path = [asm, g, door]
    v.ray = front_ray(100, 700)
    ht = S::HingeTool.new
    ht.onMouseMove(0, 1, 1, v)
    ht.draw(v)
    ht.onLButtonDown(0, 1, 1, v)
    p = S::Store.params(g)
    d = p['hinges']['doors'].values.first
    assert_equal 'manual', d['mode']
    assert(d['manual'].any? { |e| (e['dist'] - (700 - 2)).abs < 1 || (e['anchor'] == 'top') })
  end
end
