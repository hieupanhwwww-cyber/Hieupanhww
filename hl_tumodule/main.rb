# encoding: UTF-8
require 'json'

module HungLoan
  module TuModule
    VERSION = '1.4.1'.freeze unless const_defined?(:VERSION)
    DIR = File.dirname(__FILE__).freeze
  end
end

%w[util config geom templates params interior hinges joints builder solver sections abf_rules mfg library abf_adapter].each do |f|
  require File.join(HungLoan::TuModule::DIR, 'core', f)
end
%w[units prefs store render manager actions observers tools/pick tools/place_tool tools/divider_tool
   tools/drawer_tool tools/feature_tools export dialogs props testcases survey commands].each do |f|
  require File.join(HungLoan::TuModule::DIR, 'su', f)
end

module HungLoan
  module TuModule
    unless file_loaded?(__FILE__)
      SU::Prefs.load_abf_ops
      SU::Commands.install
      SU::Observers.install
      file_loaded(__FILE__)
    end
  end
end
