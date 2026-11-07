# Schema dữ liệu & luồng cập nhật — Tủ Module 1.0.0 (schema_version 1)

Đơn vị biên dữ liệu: **mm**. SketchUp lưu inch; chuyển đổi duy nhất tại `su/units.rb`.

## 1. Lưu trong model (attribute dictionary `HungLoan_TuModule`)

| Thực thể | Khóa | Nội dung |
|---|---|---|
| Bộ tủ (Group) | `kind=assembly`, `id`, `pid`, `tf`, `data` (JSON) | `data.links[]`: `{id, type: stack\|kitchen, lower, upper}`; `data.sections`: `{marked{pair_key}, receiver_override{pair_key: panel_id}}`; `data.gaps{link_id: mm}` |
| Module (Group) | `kind=module`, `id`, `pid`, `tf`, `rot`, `schema`, `sec_sig`, `params` (JSON) | Tham số instance — **nguồn tái sinh duy nhất** (mục 2) |
| Tấm (Group) | `kind=panel`, `id = module_id/local_id`, `local_id`, `role`, `module_id`, `tf` | Hình hiển thị sinh từ `params`; không đọc ngược mesh |
| Dấu gia công (Group con của tấm) | `kind=marks` | Vòng tròn lỗ, đường bao tiết diện — sinh từ feature |
| Bản gia công (Group) | dict `HungLoan_MFG`: `kind=snapshot`, `status`; mỗi tấm: `part_id`, `role`, `thickness_mm`, `ops` (JSON), `units` | Bàn giao ABF/Nesting |

`pid` = `persistent_id` lúc ghi; khác `persistent_id` hiện tại ⇒ đối tượng là bản copy ⇒ cấp ID mới và ánh xạ lại liên kết/tiết diện (`Manager.normalize!`).

## 2. Tham số module (`params`)

```
schema, id, template_id, template_name, module_type, geometry (carcass|l_two_box|l_single), link_role
w, d, h, t, tb                      # rộng/sâu/cao, độ dày ván, độ dày hậu
top_joint, bottom_joint             # inset | overlay (độc lập)
back {mode: overlay|inset|groove, scope: whole|per_column, setback, groove_depth, groove_tol, groove_clear}
round {corner_r, end_r, end_side}
interior                            # cây khoang: leaf {id} | split {id, axis x|z, dividers[{id, ratio, t}], children[]}
front {type: doors|drawers|open, enabled, mount, t, edge_gap, mid_gap, door_counts{zone_key:n},
       drawer_count, drawer_ratios[], handle_gap=25}
hinges {enabled, preset, split_policy, doors{door_local_id: {side, mode auto|manual, manual[{anchor,dist,ratio}], on_resize, x0, x1}}}
drawers[] {id, cell, bottom, height, rail_length, rail_type=ball_side, clearance=13, side_t, bottom_t, mode}
joints {enabled, preset, overrides{joint_key: {flip, deleted, positions[{anchor,dist}]}}}
suppressed[]                        # tấm người dùng đã xóa bằng Delete — không hồi sinh
l {la, lb, orient}                  # chữ L: chiều dài tổng từ góc ngoài phía sau
upper_gap                           # tủ bếp trên: khoảng hở nhập lúc đặt
```

## 3. Chi tiết tấm (part) và feature — lõi sản xuất (`core/mfg.rb`)

```
part {id, role, label, module_id, assembly_id, material, grain, kind: flat|bent, thickness,
      frame {o, u, v, n}  # hệ thế giới khi xuất; u,v trong mặt tấm, n pháp tuyến; mặt A: w = t, mặt B: w = 0
      outline[]           # đoạn {t:L,p:[u,v]} và cung {t:A,c,r,a0,a1} — giữ cung trong dữ liệu
      outline_points[]    # đa giác chia đoạn (chỉ để hiển thị/kiểm tra)
      stock {w,h,t}, features[]}

feature {id, type: drill|groove|pocket, op, face: A|B|E:u0|E:u1|E:v0|E:v1,
         pos [u,v,w] (local), dir [du,dv,dw] (local, hướng đi vào vật liệu),
         diameter, depth, through, rect [u0,v0,u1,v1], outline[[...]], path,
         source {kind: cam|hinge|back_groove|section, joint|door|pair, index, role, preset, demo}}
```

| op | type | Tấm nhận | Mặt |
|---|---|---|---|
| `cam_housing` | drill (mặt) | tấm mang cạnh | A/B (mặt hướng vào lòng tủ, đổi được) |
| `cam_edge_hole` | drill (cạnh) | tấm mang cạnh | E:* |
| `cam_bolt` | drill (mặt) | tấm nhận mặt | A/B |
| `hinge_cup` | drill (mặt) | **chỉ cánh** | B (mặt sau cánh) |
| `back_groove` | groove | hồi, nóc, đáy, (vách nếu hậu từng khoang) | mặt trong |
| `section` | pocket | tấm nhận theo bảng ưu tiên | mặt phía tấm đối tác |

ID feature bám quan hệ nguồn và vai trò (`<joint_key>:<i>:cam`, `<door>:hinge:<i>`, `sec:<pair_key>`), không bám tọa độ → giữ ID sau Move/Resize.

## 4. Mã kiểm tra (`Mfg.validate`)

`DUP_PART_ID, UNSUPPORTED_BENT, BAD_THICKNESS, DEGENERATE_OUTLINE, OUTLINE_CW, SELF_INTERSECT, DUP_FEATURE, BAD_DIAMETER, BAD_DEPTH, WRONG_FACE_DIR, DEPTH_EXCEEDS_STOCK, OUT_OF_AREA, EDGE_HOLE_OFF_THICKNESS, WRONG_FACE, UNSUPPORTED_FEATURE, SECTION_APPROX, DEMO_PRESET, ORPHAN_JOINT, CAM_INCOMPLETE, CAM_MISALIGNED, CAM_AXIS, CAM_EDGE_NOT_REACH, CAM_LATERAL`.
Khoan cạnh kiểm tra độ sâu theo **lượng vật liệu dọc hướng khoan**, không so với độ dày tấm.
Trạng thái tách bạch: `geometry_valid`, `has_unsupported`, `shop_params_unverified`, `target_compat_verified` (luôn `false` ở bản này).

## 5. Luồng cập nhật

1. Thao tác người dùng (Apply / Move / Scale / Delete / công cụ) → **một** `start_operation` (Move/Scale/Delete: transparent, gộp với thao tác native → một Ctrl+Z).
2. Observer chỉ **ghi nhận** (`onChangeEntity`, `onElementRemoved`) → hàng đợi → `UI.start_timer(0)` → xử lý ngoài callback; chặn tái nhập bằng `Manager.busy?`. Không lồng `start_operation`.
3. `Manager.update!`: chuẩn hóa ID copy → đọc tham số + vị trí → **Solver giải một lần** (union-find nhóm rộng/sâu; vị trí theo thứ tự tô-pô liên kết) → dựng lại tham số → **kiểm tra lỗi trước khi ghi** (lỗi ⇒ abort, giữ trạng thái cũ) → tính lại tiết diện đã đánh dấu từ **stock** → vẽ lại **chỉ module bị ảnh hưởng** (đổi tham số, đổi kích thước do liên kết, hoặc chữ ký tiết diện đổi) → ghi transformation.
4. Scale native: suy ra hệ số theo trục cũ, đổi kích thước tham số, đưa transformation về scale 1 ⇒ độ dày, R, khe 25 mm giữ đúng.

## 6. Cấu hình người dùng (ngoài model)

Thư mục: `%APPDATA%/HungLoanTuModule` (Windows) hoặc `~/Library/Application Support/HungLoanTuModule` (macOS).
`library.json` `{schema, folders[{id,name,parent}], links[{folder,template}], settings{template_id:{...}}}`,
`hinge_presets.json`, `cam_presets.json`, `work.json`. File sao lưu: `{format: HLTM-LIBRARY-BACKUP, schema, plugin_version, catalog[], folders, links, settings}`.
Migration: trường không còn dùng/giá trị hết hợp lệ bị bỏ và liệt kê (`Library.migrate`).

## 7. Hợp đồng ánh xạ ABF/Nesting

Xem `docs/ABF_HANDOFF.md`. Toàn bộ cột “khóa/định dạng đích” đang **CHƯA XÁC ĐỊNH** — không có nguồn kiểm chứng.
