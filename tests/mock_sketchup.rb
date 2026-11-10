# encoding: UTF-8
$LOADED_FEATURES << "sketchup.rb" << "extensions.rb"
# GIẢ LẬP TỐI THIỂU SketchUp Ruby API để chạy thử luồng Ruby của plugin ngoài SketchUp.
# Chỉ phục vụ phát hiện lỗi tên hàm/luồng dữ liệu. KHÔNG thay thế kiểm thử trong SketchUp thật
# (pushpull/add_face/observer/HtmlDialog ở đây chỉ mô phỏng).
$mock_log = []

class Numeric
  def degrees; self * Math::PI / 180.0; end
  def mm; self / 25.4; end
end

module Geom
  class Vector3d
    attr_accessor :x, :y, :z
    def initialize(x = 0, y = 0, z = 0)
      x, y, z = x if x.is_a?(Array)
      @x, @y, @z = x.to_f, y.to_f, z.to_f
    end
    def to_a; [@x, @y, @z]; end
    def length; Math.sqrt(@x * @x + @y * @y + @z * @z); end
    def normalize; l = length; l.zero? ? dup : Vector3d.new(@x / l, @y / l, @z / l); end
    def normalize!; n = normalize; @x, @y, @z = n.x, n.y, n.z; self; end
    def dot(o); @x * o.x + @y * o.y + @z * o.z; end
    def angle_between(o); Math.acos([[dot(o) / (length * o.length), 1].min, -1].max); end
    def transform(t); t.apply_vec(self); end
  end

  class Point3d
    attr_accessor :x, :y, :z
    def initialize(x = 0, y = 0, z = 0)
      x, y, z = x if x.is_a?(Array)
      @x, @y, @z = x.to_f, y.to_f, z.to_f
    end
    def to_a; [@x, @y, @z]; end
    def transform(t); t.apply_pt(self); end
    def -(o); Vector3d.new(@x - o.x, @y - o.y, @z - o.z); end
  end

  class Transformation
    attr_reader :m
    def initialize(arg = nil)
      @m = [1.0, 0, 0, 0, 0, 1.0, 0, 0, 0, 0, 1.0, 0, 0, 0, 0, 1.0]
      if arg.is_a?(Array) && arg.size == 16 then @m = arg.map(&:to_f)
      elsif arg.is_a?(Point3d) || (arg.is_a?(Array) && arg.size == 3)
        p = arg.is_a?(Array) ? arg : arg.to_a
        @m[12], @m[13], @m[14] = p.map(&:to_f)
      end
    end
    def self.axes(o, x, y, z)
      new([x.x, x.y, x.z, 0, y.x, y.y, y.z, 0, z.x, z.y, z.z, 0, o.x, o.y, o.z, 1])
    end
    def self.rotation(_pt, axis, ang)
      c = Math.cos(ang); s = Math.sin(ang)
      raise 'mock: chỉ quay quanh Z' unless axis.z.abs > 0.99
      new([c, s, 0, 0, -s, c, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1])
    end
    def self.scaling(sx, sy, sz); new([sx, 0, 0, 0, 0, sy, 0, 0, 0, 0, sz, 0, 0, 0, 0, 1]); end
    def to_a; @m.dup; end
    def origin; Point3d.new(@m[12], @m[13], @m[14]); end
    def *(o)
      a = @m; b = o.m
      r = Array.new(16, 0.0)
      4.times { |c| 4.times { |rr| r[c * 4 + rr] = (0..3).sum { |k| a[k * 4 + rr] * b[c * 4 + k] } } }
      Transformation.new(r)
    end
    def apply_pt(p)
      a = @m
      Point3d.new(a[0] * p.x + a[4] * p.y + a[8] * p.z + a[12], a[1] * p.x + a[5] * p.y + a[9] * p.z + a[13], a[2] * p.x + a[6] * p.y + a[10] * p.z + a[14])
    end
    def apply_vec(v)
      a = @m
      Vector3d.new(a[0] * v.x + a[4] * v.y + a[8] * v.z, a[1] * v.x + a[5] * v.y + a[9] * v.z, a[2] * v.x + a[6] * v.y + a[10] * v.z)
    end
    def inverse
      a = @m
      r3 = [[a[0], a[4], a[8]], [a[1], a[5], a[9]], [a[2], a[6], a[10]]]
      det = r3[0][0] * (r3[1][1] * r3[2][2] - r3[1][2] * r3[2][1]) - r3[0][1] * (r3[1][0] * r3[2][2] - r3[1][2] * r3[2][0]) + r3[0][2] * (r3[1][0] * r3[2][1] - r3[1][1] * r3[2][0])
      inv = Array.new(3) { Array.new(3) }
      3.times { |i| 3.times { |j| inv[j][i] = (r3[(i + 1) % 3][(j + 1) % 3] * r3[(i + 2) % 3][(j + 2) % 3] - r3[(i + 1) % 3][(j + 2) % 3] * r3[(i + 2) % 3][(j + 1) % 3]) / det } }
      t = [a[12], a[13], a[14]]
      ti = (0..2).map { |i| -(inv[i][0] * t[0] + inv[i][1] * t[1] + inv[i][2] * t[2]) }
      Transformation.new([inv[0][0], inv[1][0], inv[2][0], 0, inv[0][1], inv[1][1], inv[2][1], 0, inv[0][2], inv[1][2], inv[2][2], 0, ti[0], ti[1], ti[2], 1])
    end
  end

  class BoundingBox
    def empty?; @pts.empty?; end
    def corner(i) m = max; Point3d.new(i & 1 == 0 ? 0 : m.x, i & 2 == 0 ? 0 : m.y, i & 4 == 0 ? 0 : m.z) end
    def initialize; @pts = []; end
    def add(p); @pts << p; self; end
    def max; Point3d.new(@pts.map(&:x).max || 0, @pts.map(&:y).max || 0, @pts.map(&:z).max || 0); end
  end
end

ORIGIN = Geom::Point3d.new(0, 0, 0)
Z_AXIS = Geom::Vector3d.new(0, 0, 1)
VK_LEFT = 37; VK_RIGHT = 39
TB_NEVER_SHOWN = -1
MB_MULTILINE = 3; MB_YESNO = 4; IDYES = 6
GL_LINES = 1; GL_LINE_STRIP = 2; GL_LINE_LOOP = 3

$file_loaded = {}
def file_loaded?(f) $file_loaded[f] end
def file_loaded(f) $file_loaded[f] = true end

module Sketchup
  @next_id = 1
  def self.next_id; @next_id += 1; end
  class Observer; end
  class EntityObserver; end
  class EntitiesObserver; end
  class SelectionObserver; end
  class ModelObserver; end
  class AppObserver; end

  class Entity
    attr_reader :entityID, :persistent_id
    attr_accessor :parent
    def initialize
      @entityID = Sketchup.next_id
      @persistent_id = Sketchup.next_id
      @attrs = {}
      @valid = true
    end
    def attribute_dictionaries; nil; end
    def hidden?; false; end
    def locked?; false; end
    def layer; nil; end
    def curve; nil; end
    def get_attribute(d, k, default = nil) (@attrs[d] || {}).fetch(k, default) end
    def set_attribute(d, k, v) (@attrs[d] ||= {})[k] = v.is_a?(Array) ? v.dup : v; v end
    def attrs_copy; Marshal.load(Marshal.dump(@attrs)); end
    def attrs=(a); @attrs = a; end
    def add_observer(_o) true end
    def valid?; @valid; end
    def erase!; @valid = false; end
    def model; Sketchup.active_model; end
  end

  class Face < Entity
    attr_reader :normal, :pts
    attr_accessor :pushed
    def initialize(pts)
      super()
      @pts = pts
      a = pts[0]; b = pts[1]; c = pts[2]
      v1 = [b.x - a.x, b.y - a.y, b.z - a.z]; v2 = [c.x - a.x, c.y - a.y, c.z - a.z]
      n = [v1[1] * v2[2] - v1[2] * v2[1], v1[2] * v2[0] - v1[0] * v2[2], v1[0] * v2[1] - v1[1] * v2[0]]
      @normal = Geom::Vector3d.new(*n).normalize
    end
    def reverse!; @normal = Geom::Vector3d.new(-@normal.x, -@normal.y, -@normal.z); self; end
    def pushpull(d) @pushed = d; $mock_log << [:pushpull, d]; nil end
    def area; 1.0; end
  end

  class Edge < Entity
    attr_accessor :soft, :smooth
    def faces; []; end
  end

  class Entities
    include Enumerable
    attr_reader :parent, :items
    def initialize(parent) @parent = parent; @items = [] end
    def each(&b) @items.each(&b) end
    def add_group(*_a) g = Group.new; g.parent = @parent; @items << g; g end
    def add_face(*pts)
      pts = pts.flatten
      return nil if pts.size < 3 || !pts.all? { |p| p.is_a?(Geom::Point3d) }
      f = Face.new(pts); @items << f; f
    end
    def add_circle(_c, _n, _r, n = 24) Array.new(n) { e = Edge.new; @items << e; e } end
    def add_edges(*pts) pts.flatten.each_cons(2).map { e = Edge.new; @items << e; e } end
    def add_cline(*_a) nil end
    def clear!; @items.each(&:erase!); @items = []; end
    def erase_entities(list) list.each { |e| e.erase!; @items.delete(e) } end
    def add_observer(_o) true end
  end

  class ComponentDefinition < Entity
    attr_reader :entities
    attr_accessor :instances_list
    def initialize; super; @entities = Entities.new(self); @instances_list = []; end
    def instances; @instances_list; end
    def name; 'def'; end
    def bounds; b = Geom::BoundingBox.new; b.add(Geom::Point3d.new(10, 20, 30)); b; end
    def count_instances; @instances_list.size; end
    def group?; true; end
  end

  class Group < Entity
    attr_accessor :name, :material, :layer, :definition
    attr_reader :transformation
    def initialize
      super
      @definition = ComponentDefinition.new
      @definition.instances_list << self
      @transformation = Geom::Transformation.new
      @name = ''
    end
    def entities; @definition.entities; end
    def transformation=(t) @transformation = t end
    def make_unique
      return self if @definition.count_instances <= 1
      @definition.instances_list.delete(self)
      @definition = deep_copy_definition(@definition)
      @definition.instances_list << self
      self
    end
    def deep_copy_definition(defn)
      nd = ComponentDefinition.new
      defn.entities.items.each do |e|
        next unless e.is_a?(Group)
        g = e.copy_into(nd)
        nd.entities.items << g
      end
      nd
    end
    # Mô phỏng copy/paste: nhóm mới, CHUNG definition, cùng attribute, persistent_id mới.
    def shallow_copy_into(defn)
      g = Group.allocate
      g.send(:initialize)
      g.definition.instances_list.delete(g)
      g.definition = @definition
      @definition.instances_list << g
      g.attrs = attrs_copy
      g.transformation = Geom::Transformation.new(@transformation.to_a)
      g.parent = defn
      g
    end
    def copy_into(defn)
      g = Group.new
      g.attrs = attrs_copy
      g.transformation = Geom::Transformation.new(@transformation.to_a)
      g.parent = defn
      g.name = @name
      g.material = @material
      entities.items.each { |e| g.entities.items << e.copy_into(g.definition) if e.is_a?(Group) }
      g
    end
  end

  class ComponentInstance < Group; end
  class ArcCurve < Entity; end

  class Layers
    def initialize; @h = {}; end
    def [](n) @h[n] end
    def add(n) @h[n] = n end
  end

  class Selection
    include Enumerable
    def initialize; @a = []; end
    def each(&b) @a.each(&b) end
    def clear; @a = []; end
    def add(*e) @a.concat(e.flatten) end
    def add_observer(_o) true end
    def model; Sketchup.active_model; end
  end

  class Model < Entity
    attr_reader :entities, :selection, :layers, :ops
    attr_accessor :active_path, :tool
    def initialize
      super
      @root = ComponentDefinition.new
      @entities = Entities.new(self)
      @selection = Selection.new
      @layers = Layers.new
      @ops = []
      @depth = 0
    end
    def active_entities; @entities; end
    def definitions; self; end
    def load(_path)
      d = ComponentDefinition.new
      g = d.entities.add_group
      g.entities.add_face(Geom::Point3d.new(0, 0, 0), Geom::Point3d.new(1, 0, 0), Geom::Point3d.new(1, 1, 0))
      g.entities.add_group
      d
    end
    def guid; "guid-#{object_id}"; end
    def edit_transform; Geom::Transformation.new; end
    def start_operation(name, *_a)
      raise "mock: start_operation lồng nhau (#{name})" if @depth > 0
      @depth += 1; @ops << [:start, name]
    end
    def commit_operation; @depth -= 1; @ops << [:commit]; end
    def abort_operation; @depth -= 1; @ops << [:abort]; end
    def select_tool(t) @tool = t end
    def path; ''; end
    def bounds; b = Geom::BoundingBox.new; b.add(ORIGIN); b; end
    def materials; {}; end
  end

  class Color
    def initialize(*a) @a = a end
  end

  class InputPoint
    def pick(*_a) true end
    def position; ORIGIN; end
    def display?; false; end
    def draw(_v) end
  end

  @model = Model.new
  def self.active_model; @model; end
  def self.reset_model!; @model = Model.new; end
  def self.status_text=(s) $mock_log << [:status, s] end
  def self.vcb_label=(s) end
  def self.version; 'mock'; end
  def self.vcb_value=(s) end
  def self.add_observer(_o) true end
  def self.register_extension(*_a) true end
end

class SketchupExtension
  attr_accessor :description, :version, :creator, :copyright
  def initialize(*_a) end
end

module UI
  @messages = []
  def self.messages; @messages; end
  def self.messagebox(m, *_a) @messages << m; IDYES end
  def self.start_timer(_t, _r = false) yield; 1 end
  def self.beep; end
  def self.menu(_n) Menu.new end
  def self.add_context_menu_handler(&b) @ctx = b end
  def self.savepanel(*_a) $mock_save_path end
  def self.openpanel(*_a) $mock_open_path end
  def self.inputbox(*_a) $mock_input end
  def self.select_directory(*_a) $mock_dir end
  class Menu
    def add_submenu(_n) Menu.new end
    def add_item(*_a) 1 end
    def add_separator; end
  end
  class Command
    attr_accessor :tooltip, :status_bar_text, :small_icon, :large_icon
    def initialize(_n, &b) @b = b end
  end
  class Toolbar
    def initialize(_n) end
    def add_item(_c) end
    def get_last_state; TB_NEVER_SHOWN; end
    def show; end
    def restore; end
  end
  class HtmlDialog
    STYLE_DIALOG = 1; STYLE_UTILITY = 2
    attr_reader :callbacks, :scripts
    def initialize(_o) @callbacks = {}; @scripts = []; @visible = false end
    def set_file(f) raise "mock: thiếu file #{f}" unless File.exist?(f) end
    def add_action_callback(n, &b) @callbacks[n] = b end
    def execute_script(s) @scripts << s end
    def show; @visible = true; end
    def visible?; @visible; end
    def close; @visible = false; end
    def bring_to_front; end
    def set_on_closed(&_b) end
    # Gọi giống JS: sketchup.req(JSON)
    def js(action, data = {})
      @callbacks['req'].call(nil, JSON.generate('seq' => 1, 'action' => action, 'data' => data))
      JSON.parse(@scripts.last[/HL\.\w+\((.*)\)\z/m, 1])
    end
  end
end
