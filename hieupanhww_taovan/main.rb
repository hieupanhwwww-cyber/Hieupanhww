# encoding: UTF-8
require 'json'
require_relative 'settings'
require_relative 'board'
require_relative 'tool'

module HieuPanhww
  module TaoVan
    DIR = File.join(File.dirname(__FILE__)).freeze

    def self.open_settings
      if @dialog && @dialog.visible?
        @dialog.bring_to_front
        return
      end
      @dialog = UI::HtmlDialog.new(
        dialog_title: 'Tạo Ván - Cài đặt',
        preferences_key: 'HieuPanhww_TaoVan_Dialog',
        scrollable: true, resizable: true,
        width: 340, height: 620, style: UI::HtmlDialog::STYLE_DIALOG
      )
      @dialog.set_file(File.join(DIR, 'html', 'taovan.html'))
      @dialog.add_action_callback('load') do |_ctx|
        @dialog.execute_script("window.applySettings(#{JSON.generate(Settings.all)})")
      end
      @dialog.add_action_callback('save') do |_ctx, key, value|
        Settings.set(key.to_s, value)
      end
      @dialog.show
    end

    def self.activate_tool
      Sketchup.active_model.select_tool(VanTool.new)
    end

    unless file_loaded?(__FILE__)
      cmd_tool = UI::Command.new('Tạo Ván') { activate_tool }
      cmd_tool.tooltip = 'Tạo Ván'
      cmd_tool.status_bar_text = 'Bấm vào mặt để tạo ván.'
      icon = File.join(DIR, 'icons', 'taovan.svg')
      cmd_tool.small_icon = icon
      cmd_tool.large_icon = icon

      cmd_set = UI::Command.new('Cài đặt Tạo Ván') { open_settings }
      cmd_set.tooltip = 'Cài đặt Tạo Ván'

      menu = UI.menu('Extensions').add_submenu('Tạo Ván')
      menu.add_item(cmd_tool)
      menu.add_item(cmd_set)

      tb = UI::Toolbar.new('Tạo Ván')
      tb.add_item(cmd_tool)
      tb.show

      file_loaded(__FILE__)
    end
  end
end
