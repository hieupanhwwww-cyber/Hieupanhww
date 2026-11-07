# encoding: UTF-8
# Tiết diện giao nhau hàng loạt: tìm cặp tấm XUYÊN thật (không chỉ hộp bao chồng), chọn tấm nhận
# theo bảng ưu tiên vai trò (cấu hình), tính đường bao vùng giao trên mặt tấm nhận và độ sâu.
require_relative 'geom'
require_relative 'joints'
require_relative 'config'

module HungLoan
  module TuModule
    module Core
      module Sections
        G = Geom
        module_function

        def rect_like?(panel)
          G.arc_count(panel['outline']).zero? && panel['outline'].size == 4
        end

        # rules: {'priority'=>{role=>n}, 'receiver_override'=>{pair_key=>panel_id}}
        def scan(panels, rules = {})
          prio = Config::SECTION_RECEIVER_PRIORITY.merge(rules['priority'] || {})
          over = rules['receiver_override'] || {}
          rows = []
          flat = panels.reject { |p| p['kind'] == 'bent' }
          Joints.candidate_pairs(flat).each do |pa, ba, pb, bb|
            rel = Joints.classify(pa, ba, pb, bb)
            next unless rel['kind'] == 'penetration'
            a, b = [pa, pb].sort_by { |p| p['id'] }
            key = "#{a['id']}~#{b['id']}"
            row = { 'key' => key, 'a' => a['id'], 'b' => b['id'], 'roles' => [a['role'], b['role']] }
            rid = over[key]
            receiver = if rid
                         [a, b].find { |p| p['id'] == rid }
                       else
                         pa_ = prio[a['role']].to_i; pb_ = prio[b['role']].to_i
                         if pa_ == pb_ then nil
                         else pa_ > pb_ ? a : b
                         end
                       end
            if receiver.nil?
              rows << row.merge('status' => 'unresolved', 'message' => 'Không xác định được tấm nhận (cùng mức ưu tiên). Chọn tấm nhận trong bảng.')
              next
            end
            other = receiver.equal?(a) ? b : a
            region = region_on(receiver, other)
            back_check = region_on(other, receiver)
            if region['area'] <= 0.01 || back_check['area'] <= 0.01
              rows << row.merge('status' => 'not_real', 'receiver' => receiver['id'],
                                'message' => 'Hộp bao chồng nhưng tấm không thực sự giao')
              next
            end
            covered = (receiver['features'] || []).any? do |f|
              f['type'] == 'groove' && f['rect'] && region['bbox'] &&
                f['rect'][0] <= region['bbox'][0] + TOL && f['rect'][1] <= region['bbox'][1] + TOL &&
                f['rect'][2] >= region['bbox'][2] - TOL && f['rect'][3] >= region['bbox'][3] - TOL &&
                f['face'] == region['face'] && f['depth'] >= region['depth'] - TOL
            end
            rows << row.merge(
              'status' => covered ? 'covered' : 'ok', 'receiver' => receiver['id'], 'other' => other['id'],
              'face' => region['face'], 'depth' => region['depth'], 'through' => region['through'],
              'area' => region['area'], 'pieces' => region['pieces'], 'bbox' => region['bbox'], 'approx' => region['approx'],
              'mark' => region['through'] ? 'cutout' : 'pocket',
              'message' => covered ? 'Đã có rãnh soi bao phủ' : nil
            )
          end
          rows
        end

        def region_on(rec, oth)
          rb = G.panel_aabb(rec); ob = G.panel_aabb(oth)
          mn = (0..2).map { |k| [rb[0][k], ob[0][k]].max }
          mx = (0..2).map { |k| [rb[1][k], ob[1][k]].min }
          corners = [mn[0], mx[0]].product([mn[1], mx[1]], [mn[2], mx[2]]).map { |c| G.w2f(rec['frame'], c) }
          u0 = corners.map { |c| c[0] }.min; u1 = corners.map { |c| c[0] }.max
          v0 = corners.map { |c| c[1] }.min; v1 = corners.map { |c| c[1] }.max
          w0 = corners.map { |c| c[2] }.min; w1 = corners.map { |c| c[2] }.max
          w0 = [w0, 0.0].max; w1 = [w1, rec['t']].min
          rpoly = G.tessellate(rec['outline'], Config::ARC_SEG_PER_QUARTER)
          base = G.clip_rect(rpoly, u0, v0, u1, v1)
          approx = false
          pieces = [base]
          on = G.dir_w2f(rec['frame'], oth['frame']['n'])
          parallel = (on[2].abs - 1.0).abs < 1e-6
          if parallel && !rect_like?(oth)
            opoly = G.tessellate(oth['outline'], Config::ARC_SEG_PER_QUARTER).map do |p|
              w = G.f2w(oth['frame'], [p[0], p[1], 0.0])
              l = G.w2f(rec['frame'], w)
              [l[0], l[1]]
            end
            pieces = G.triangulate(opoly).map { |tri| G.clip_convex(base, tri) }.reject { |pc| pc.size < 3 }
          elsif !rect_like?(oth)
            approx = true
          end
          area = pieces.sum { |pc| G.polygon_area(pc).abs }
          face = (w0 <= TOL) ? 'B' : 'A'
          depth = w1 - w0
          all = pieces.flatten(1)
          bbox = all.empty? ? nil : G.bbox2(all)
          { 'pieces' => pieces, 'area' => area, 'face' => face, 'depth' => depth,
            'through' => depth >= rec['t'] - TOL, 'bbox' => bbox, 'approx' => approx }
        end

        # Biến kết quả quét đã duyệt thành feature trên tấm nhận.
        def feature_from(row)
          {
            'id' => "sec:#{row['key']}", 'type' => 'pocket', 'op' => 'section', 'face' => row['face'],
            'outline' => row['pieces'], 'depth' => row['depth'], 'through' => row['through'],
            'rect' => row['bbox'], 'approx' => row['approx'],
            'source' => { 'kind' => 'section', 'pair' => row['key'], 'other' => row['other'], 'mark' => row['mark'] }
          }
        end
      end
    end
  end
end
