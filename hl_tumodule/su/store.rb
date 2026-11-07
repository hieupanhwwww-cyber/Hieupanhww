# encoding: UTF-8
# Đọc/ghi metadata plugin trong attribute dictionary riêng. Định danh bằng metadata,
# không phụ thuộc tên Group, Tag hay material.
require 'json'

module HungLoan
  module TuModule
    module SU
      module Store
        DICT = 'HungLoan_TuModule'.freeze
        C = Core
        module_function

        def kind(e)
          return nil unless e.respond_to?(:get_attribute) && e.valid?
          e.get_attribute(DICT, 'kind')
        end

        def assembly?(e) kind(e) == 'assembly' end
        def module?(e) kind(e) == 'module' end
        def panel?(e) kind(e) == 'panel' end

        def read_json(e, key, default = nil)
          s = e.get_attribute(DICT, key)
          return default if s.nil? || s == ''
          JSON.parse(s)
        rescue JSON::ParserError
          default
        end

        def write_json(e, key, data)
          e.set_attribute(DICT, key, JSON.generate(data))
        end

        def params(mod)
          p = read_json(mod, 'params')
          p && C::Params.migrate(p)
        end

        def set_params(mod, p)
          write_json(mod, 'params', p)
          mod.set_attribute(DICT, 'id', p['id'])
          mod.set_attribute(DICT, 'schema', C::Config::SCHEMA_VERSION)
        end

        def asm_data(asm)
          d = read_json(asm, 'data', {})
          d['links'] ||= []
          d['sections'] ||= { 'marked' => {}, 'receiver_override' => {} }
          d
        end

        def set_asm_data(asm, d) write_json(asm, 'data', d) end

        def id(e) e.get_attribute(DICT, 'id') end

        def tag_assembly(asm, id)
          asm.set_attribute(DICT, 'kind', 'assembly')
          asm.set_attribute(DICT, 'id', id)
          asm.set_attribute(DICT, 'pid', asm.persistent_id) if asm.respond_to?(:persistent_id)
          asm.name = 'Bộ tủ' if asm.name.to_s.empty?
        end

        def tag_module(mod, p)
          mod.set_attribute(DICT, 'kind', 'module')
          set_params(mod, p)
          mod.set_attribute(DICT, 'pid', mod.persistent_id) if mod.respond_to?(:persistent_id)
          mod.name = p['template_name'].to_s
        end

        def tag_panel(g, pn, module_id)
          g.set_attribute(DICT, 'kind', 'panel')
          g.set_attribute(DICT, 'id', "#{module_id}/#{pn['local_id']}")
          g.set_attribute(DICT, 'local_id', pn['local_id'])
          g.set_attribute(DICT, 'role', pn['role'])
          g.set_attribute(DICT, 'module_id', module_id)
          g.set_attribute(DICT, 'tf', g.transformation.to_a)
          g.name = pn['label'].to_s
        end

        def entities_of(group)
          group.respond_to?(:definition) ? group.definition.entities : group.entities
        end

        def modules_in(asm)
          entities_of(asm).grep(Sketchup::Group).select { |g| module?(g) }
        end

        def panels_in(mod)
          entities_of(mod).grep(Sketchup::Group).select { |g| panel?(g) }
        end

        # Từ một thực thể bất kỳ trong đường dẫn, tìm module / assembly chứa nó.
        def owner_module(path)
          path.reverse.find { |e| module?(e) }
        end

        def owner_assembly(path)
          path.reverse.find { |e| assembly?(e) }
        end

        def parent_group(e)
          par = e.parent
          return nil unless par.is_a?(Sketchup::ComponentDefinition) && par.group?
          par.instances.first
        end
      end
    end
  end
end
