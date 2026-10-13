# encoding: UTF-8
module HieuPanhww
  module TaoVan
    module Settings
      SECTION = 'HieuPanhww_TaoVan'.freeze

      DEFAULTS = {
        'do_day_tu_dong'  => true,   # lấy độ dày theo ván gốc
        'do_day'          => 17.5,   # mm
        'dao_huong'       => false,  # đảo hướng đùn
        'tao_component'   => false,
        'ten_tu_dong'     => true,
        'instance'        => '',
        'layer'           => '',
        'tao_van_nhanh'   => false,  # tạo ván từ mặt đang chọn khi kích hoạt
        'gop_dong_phang'  => true,
        'do_day_nhanh'    => 17.5    # mm
      }.freeze

      def self.get(key)
        Sketchup.read_default(SECTION, key, DEFAULTS[key])
      end

      def self.set(key, value)
        return unless DEFAULTS.key?(key)
        Sketchup.write_default(SECTION, key, value)
      end

      def self.all
        DEFAULTS.keys.each_with_object({}) { |k, h| h[k] = get(k) }
      end
    end
  end
end
