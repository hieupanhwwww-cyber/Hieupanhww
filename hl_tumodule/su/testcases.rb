# encoding: UTF-8
# Dựng bộ ca kiểm thử bàn giao ABF/Nesting (mục 10D-C): tấm thường, chữ L, cam/chốt, cánh có lỗ cốc,
# hậu soi rãnh, cặp có tiết diện, bộ tủ xoay. Sau đó dùng "Tạo bản gia công" và "Xuất dữ liệu gia công".
module HungLoan
  module TuModule
    module SU
      module TestCases
        C = Core
        U = Units
        M = Manager
        module_function

        def place(id, origin_mm, rot = 0, extra = {})
          tpl = C::Templates.find(id)
          s = C::Templates.find(id)['defaults'].dup
          vals, = C::Params.clean_settings(tpl, s)
          tf = U.place_tf(origin_mm, rot)
          M.place_new(tpl, vals, { 'asm' => nil, 'pos' => [0.0, 0.0, 0.0], 'rot' => 0, 'origin_tf' => tf }.merge(extra))
        end

        def build_all
          model = Sketchup.active_model
          r = Safe.msgbox("Dựng bộ ca kiểm thử ABF trong model hiện tại (cách gốc tọa độ theo trục Y âm)?", MB_YESNO)
          return unless r == IDYES
          made = []
          # Ca 1: khung tủ nóc/đáy lọt, hậu soi rãnh, 2 cánh + lỗ cốc, cam Minifix
          g1 = place('hl.khung_tu.v1', [0.0, -3000.0, 0.0])
          Props.apply_module(g1, 'top_joint' => 'inset', 'bottom_joint' => 'inset', 'back_mode' => 'groove', 'h' => '1200',
                                 'front_enabled' => true, 'hinges_enabled' => true, 'joints_enabled' => true)
          b = M.build(Store.params(g1))
          Actions.insert_divider(g1, b['cells'][0]['id'], 'z', 600.0)
          made << 'Ca 1: khung tủ 900×580×1200, nóc/đáy lọt, hậu soi rãnh, 1 đợt, 2 cánh + lỗ cốc, cam/chốt'
          # Ca 2: tủ chữ L một thùng (nóc/đáy chữ L thật) + cam
          g2 = place('hl.tu_L_mot_thung.v1', [1500.0, -3000.0, 0.0])
          Props.apply_module(g2, 'joints_enabled' => true)
          made << 'Ca 2: tủ chữ L một thùng 1600×1200×800 (nóc/đáy chữ L)'
          # Ca 3: bộ tủ XOAY 90° + tủ hông ép xuyên 7 mm → tiết diện
          g3 = place('hl.khung_tu.v1', [4500.0, -3000.0, 0.0], 90)
          Props.apply_module(g3, 'h' => '900', 'back_mode' => 'inset')
          asm3 = M.asm_of(g3)
          side = M.place_new(C::Templates.find('hl.tu_hong.v1'), C::Library.original_settings('hl.tu_hong.v1'),
                             { 'asm' => asm3, 'pos' => [893.0, 0.0, 0.0], 'rot' => 0, 'dims' => { 'h' => 900.0 } })
          if side
            sp = Store.params(side); mp = Store.params(g3)
            key = ["#{mp['id']}/side_R", "#{sp['id']}/side_L"].sort.join('~')
            Actions.mark_sections(asm3, [key], key => "#{mp['id']}/side_R")
          end
          made << 'Ca 3: bộ tủ xoay 90°, tủ hông xuyên 7 mm vào hồi phải → 1 tiết diện (tấm nhận: hồi phải tủ chính)'
          # Ca 4: ngăn kéo — mặt phẳng + khe 25 mm, cả cụm thùng ray bi 450
          g4 = place('hl.tu_ngan_keo3.v1', [0.0, -5000.0, 0.0])
          Props.apply_module(g4, 'front_enabled' => true)
          b4 = M.build(Store.params(g4))
          bt = C::Library.original_settings('hl.thung_ngan_keo.v1')
          box = { 'height' => bt['box_height'], 'rail_length' => 450.0, 'side_t' => bt['box_side_t'], 'bottom_t' => bt['box_bottom_t'], 'cluster_count' => 3 }
          list, errs = C::Builder.cluster_layout(Store.params(g4), b4['cells'][0], b4['info'], box)
          Actions.add_drawers(g4, b4['cells'][0]['id'], list, box) if errs.empty?
          made << 'Ca 4: tủ 3 ngăn kéo, mặt phẳng khe 25 mm, cụm 3 thùng ray bi 450'
          model.selection.clear
          Safe.msgbox("Đã dựng:\n• #{made.join("\n• ")}\n\nTiếp theo: Extensions › #{C::Config::DISPLAY_NAME} › Tạo bản gia công, rồi nạp vào ABF/Nesting và đối chiếu theo docs/ABF_HANDOFF.md.", MB_MULTILINE)
        end
      end
    end
  end
end
