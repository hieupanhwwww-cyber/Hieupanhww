# encoding: UTF-8
# Tiện ích chung cho lõi (không phụ thuộc SketchUp). Đơn vị nội bộ của lõi: mm.
require 'json'

module HungLoan
  module TuModule
    module Core
      TOL = 0.05 # mm — dung sai hình học khi so tiếp xúc/giao

      class ValidationError < StandardError
        attr_reader :field
        def initialize(msg, field = nil)
          super(msg)
          @field = field
        end
      end

      module Util
        module_function

        def deep_copy(obj)
          JSON.parse(JSON.generate([obj]))[0]
        end

        @counter = 0
        def new_id(prefix)
          @counter = (@counter + 1) % 0xffff
          "#{prefix}_#{Time.now.to_i.to_s(36)}#{format('%04x%04x', rand(0xffff), @counter)}"
        end

        def num(x)
          return nil if x.nil? || x == ''
          Float(x)
        rescue ArgumentError, TypeError
          nil
        end

        def r3(x)
          (x * 1000.0).round / 1000.0
        end

        # Gộp sâu hash b vào a (b ưu tiên). Không sửa a.
        def deep_merge(a, b)
          out = deep_copy(a)
          (b || {}).each do |k, v|
            out[k] = if out[k].is_a?(Hash) && v.is_a?(Hash)
                       deep_merge(out[k], v)
                     else
                       deep_copy(v)
                     end
          end
          out
        end
      end
    end
  end
end
