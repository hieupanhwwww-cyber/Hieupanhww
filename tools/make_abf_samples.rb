# encoding: UTF-8
# Sinh dữ liệu đối chiếu (nguồn) cho bộ ca kiểm thử ABF bằng lõi plugin, chạy ngoài SketchUp:
#   ruby tools/make_abf_samples.rb
# Kết quả ở docs/abf_samples/. Đây là DỮ LIỆU MONG ĐỢI phía plugin, chưa phải kết quả ABF đọc được.
require 'tmpdir'
ENV['APPDATA'] = Dir.mktmpdir('hltm')
require_relative '../tests/mock_sketchup'
require_relative '../hl_tumodule/main'
S = HungLoan::TuModule::SU
out = File.expand_path('../docs/abf_samples', __dir__)
S::TestCases.build_all
$mock_save_path = File.join(out, 'ca_kiem_thu.json')
S::Export.cmd_export_files
parts, joints, issues = S::Export.check(Sketchup.active_model)
rows = parts.map do |p|
  ops = p['features'].group_by { |f| f['op'] }.map { |k, v| "#{k}×#{v.size}" }.join(' ')
  format('| %s | %s | %.1f × %.1f × %.1f | %d | %s |', p['id'].split('/').last.gsub('|', '/'), p['label'], p['stock']['w'], p['stock']['h'], p['thickness'], p['features'].size, ops)
end
File.write(File.join(out, 'BANG_MONG_DOI.md'), <<~MD, encoding: 'UTF-8')
  # Bảng mong đợi — bộ ca kiểm thử ABF (sinh tự động từ lõi plugin)

  Tổng: #{parts.size} chi tiết, #{parts.sum { |p| p['features'].size }} thao tác, #{joints.count { |j| !j['deleted'] }} cạnh cam.
  Lỗi dữ liệu: #{issues.count { |i| i['level'] == 'error' }} · Cảnh báo: #{issues.count { |i| i['level'] == 'warning' }} (preset DEMO).

  Cột "Thực tế ABF" để trống: điền sau khi nạp bản gia công vào ABF/Nesting (xem docs/ABF_HANDOFF.md).

  | Chi tiết | Tên | Kích thước (mm) | Số thao tác | Thao tác | Thực tế ABF |
  |---|---|---|---|---|---|
  #{rows.map { |r| r + ' |' }.join("\n")}
MD
puts "Đã ghi #{out}"
