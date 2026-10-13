# encoding: UTF-8
require 'sketchup.rb'
require 'extensions.rb'

module HieuPanhww
  module TaoVan
    unless file_loaded?(__FILE__)
      ex = SketchupExtension.new('Tạo Ván', 'hieupanhww_taovan/main')
      ex.description = 'Tạo ván (tấm gỗ công nghiệp) từ mặt: độ dày tự động, component, đặt tên, tạo ván nhanh.'
      ex.version     = '1.0.0'
      ex.creator     = 'hieupanhww'
      Sketchup.register_extension(ex, true)
      file_loaded(__FILE__)
    end
  end
end
