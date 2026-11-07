# encoding: UTF-8
# Biên đơn vị: lõi dùng mm; SketchUp lưu inch. Mọi chuyển đổi đi qua đây.
module HungLoan
  module TuModule
    module SU
      module Units
        MM = 25.4
        module_function

        def l(mm) mm.to_f / MM end
        def mm(len) len.to_f * MM end
        def pt(a) Geom::Point3d.new(a[0].to_f / MM, a[1].to_f / MM, (a[2] || 0).to_f / MM) end
        def vec(a) Geom::Vector3d.new(a[0].to_f, a[1].to_f, a[2].to_f) end
        def pt_mm(p) [p.x.to_f * MM, p.y.to_f * MM, p.z.to_f * MM] end

        # Khung tấm (mm) → Transformation SketchUp.
        def frame_tf(f)
          Geom::Transformation.axes(pt(f['o']), vec(f['u']), vec(f['v']), vec(f['n']))
        end

        # Đặt module trong hệ assembly: quay quanh Z (độ) rồi tịnh tiến (mm).
        def place_tf(pos, rot)
          Geom::Transformation.new(pt(pos)) * Geom::Transformation.rotation(ORIGIN, Z_AXIS, rot.to_f.degrees)
        end

        # Trục và hệ số scale của một Transformation (theo cột ma trận).
        def axes_scale(tf)
          a = tf.to_a
          x = [a[0], a[1], a[2]]; y = [a[4], a[5], a[6]]; z = [a[8], a[9], a[10]]
          len = ->(v) { Math.sqrt(v[0]**2 + v[1]**2 + v[2]**2) }
          { 'x' => x, 'y' => y, 'z' => z, 'sx' => len.call(x), 'sy' => len.call(y), 'sz' => len.call(z),
            'origin' => [a[12] * MM, a[13] * MM, a[14] * MM] }
        end

        def rot_of(tf)
          a = tf.to_a
          deg = Math.atan2(a[1], a[0]) * 180.0 / Math::PI
          ((deg / 90.0).round * 90) % 360
        end

        def parse_mm(text)
          s = text.to_s.strip.downcase.sub(/mm\z/, '').strip.tr(',', '.')
          return nil unless s =~ /\A-?\d+(\.\d+)?\z/
          s.to_f
        end
      end
    end
  end
end
