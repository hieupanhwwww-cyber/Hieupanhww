# encoding: UTF-8
# Tủ Module Hùng Loan — loader extension.
require 'sketchup.rb'
require 'extensions.rb'

module HungLoan
  module TuModule
    VERSION = '1.0.1'.freeze
    unless file_loaded?(__FILE__)
      ex = SketchupExtension.new('Tủ Module Hùng Loan', 'hl_tumodule/main')
      ex.description = 'Dựng tủ bằng thư viện module: ghép bộ tủ, vách/đợt, cánh, ngăn kéo ray bi, hậu, chữ L, bo; ' \
                       'cam Minifix, lỗ cốc bản lề, tiết diện và dữ liệu gia công.'
      ex.version = VERSION
      ex.creator = 'Nội Thất Hùng Loan'
      ex.copyright = '2026 Nội Thất Hùng Loan'
      Sketchup.register_extension(ex, true)
      file_loaded(__FILE__)
    end
  end
end
