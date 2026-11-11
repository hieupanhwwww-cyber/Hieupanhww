# encoding: UTF-8
# Observer chỉ GHI NHẬN sự kiện; việc sửa model được hoãn qua UI.start_timer(0) và chạy trong
# operation transparent (gộp vào thao tác Move/Scale/Delete của người dùng → một lần Ctrl+Z).
# Chống tái nhập bằng Manager.busy? và hàng đợi có khóa. Không monkey-patch lớp lõi SketchUp.
module HungLoan
  module TuModule
    module SU
      module Observers
        M = Manager
        @attached = {}
        @queue = []
        @scheduled = false

        module_function

        def queue_event(ev)
          return if M.busy?
          @queue << ev
          return if @scheduled
          @scheduled = true
          UI.start_timer(0.01, false) { flush }
        end

        def flush
          @scheduled = false
          events = @queue.uniq
          @queue = []
          removed_panels = Hash.new { |h, k| h[k] = [] }
          removed_mods = Hash.new { |h, k| h[k] = [] }
          changed = []
          events.each do |ev|
            case ev[0]
            when :changed then changed << ev[1]
            when :panel_removed then removed_panels[ev[1]] << ev[2]
            when :module_removed then removed_mods[ev[1]] << ev[2]
            end
          end
          removed_panels.each { |mod, lids| Safe.guard('xóa tấm') { Actions.on_panels_removed(mod, lids.uniq) if mod.valid? } }
          removed_mods.each { |asm, ids| Safe.guard('xóa module') { Actions.on_modules_removed(asm, ids.uniq) if asm.valid? } }
          changed.uniq.each do |g|
            next unless g.valid?
            Safe.guard('cập nhật sau Move/Scale') do
              if Store.module?(g) then Actions.on_module_transformed(g)
              elsif Store.assembly?(g) then Actions.on_assembly_transformed(g)
              elsif Store.panel?(g) then Actions.on_panel_transformed(g)
              end
            end
          end
        rescue StandardError => e
          Safe.log('observer.flush', e)
        end

        class EntObs < Sketchup::EntityObserver
          def onChangeEntity(e)
            Observers.queue_event([:changed, e]) if e.valid? && e.is_a?(Sketchup::Group)
          end
        end

        class EntsObs < Sketchup::EntitiesObserver
          def onElementRemoved(ents, eid)
            return if Manager.busy?
            defn = ents.parent
            return unless defn.is_a?(Sketchup::ComponentDefinition)
            owner = defn.instances.first
            return unless owner && owner.valid?
            if Store.module?(owner)
              lid = (Manager.registries[defn.entityID] || {})[eid]
              Observers.queue_event([:panel_removed, owner, lid]) if lid
            elsif Store.assembly?(owner)
              mid = (Observers.module_ids[defn.entityID] || {})[eid]
              Observers.queue_event([:module_removed, owner, mid]) if mid
            end
          end
        end

        class SelObs < Sketchup::SelectionObserver
          def onSelectionBulkChange(_sel) PropertiesDialog.selection_changed end
          def onSelectionCleared(_sel) PropertiesDialog.selection_changed end
          def onSelectionAdded(_sel, _e) PropertiesDialog.selection_changed end
          def onSelectionRemoved(_sel, _e) PropertiesDialog.selection_changed end
        end

        class ModelObs < Sketchup::ModelObserver
          def onTransactionUndo(_m) Observers.later_reattach end
          def onTransactionRedo(_m) Observers.later_reattach end
          def onPreSaveModel(m) Safe.write_diag(m) end
        end

        class AppObs < Sketchup::AppObserver
          def onNewModel(m) Observers.attach_model(m) end
          def onOpenModel(m) Observers.attach_model(m) end
          def expectsStartupModelNotifications; true; end
        end

        def module_ids; @module_ids ||= {}; end

        ENT = EntObs.new
        ENTS = EntsObs.new
        SEL = SelObs.new
        MOD = ModelObs.new
        APP = AppObs.new

        # Khóa nhận diện ổn định: Entities/Selection/Model KHÔNG có entityID trong SketchUp.
        def ident(x)
          case x
          when Sketchup::Model then [:model, x.guid]
          when Sketchup::Selection then [:sel, x.model.guid]
          when Sketchup::Entities
            par = x.parent
            par.is_a?(Sketchup::Model) ? [:ents, par.guid] : [:ents, par.entityID]
          else [:ent, x.entityID]
          end
        end

        def attach(e, obs)
          key = [ident(e), obs.object_id]
          return if @attached[key]
          e.add_observer(obs)
          @attached[key] = true
        end

        def attach_model(m)
          attach(m, MOD)
          attach(m.selection, SEL)
          later_reattach
        end

        def later_reattach
          UI.start_timer(0.1, false) { attach_all(Sketchup.active_model) }
        end

        # Gắn observer cho mọi bộ tủ/module/tấm (duyệt nhóm lồng có giới hạn độ sâu).
        def attach_all(model)
          return unless model
          walk(model.entities, 0)
          PropertiesDialog.selection_changed
        rescue StandardError => e
          warn "[TuModule] attach: #{e.message}"
        end

        def walk(ents, depth)
          return if depth > 8
          ents.grep(Sketchup::Group).each do |g|
            if Store.assembly?(g) || Store.module?(g)
              attach_tree(g)
            elsif depth < 6
              walk(g.entities, depth + 1)
            end
          end
        end

        def attach_tree(root)
          return unless root && root.valid?
          if Store.assembly?(root)
            attach(root, ENT)
            attach(root.definition.entities, ENTS)
            ids = {}
            Store.modules_in(root).each do |m|
              ids[m.entityID] = Store.id(m)
              attach_module(m)
            end
            module_ids[root.definition.entityID] = ids
          elsif Store.module?(root)
            attach_module(root)
          end
        end

        def attach_module(m)
          attach(m, ENT)
          attach(m.definition.entities, ENTS)
          reg = {}
          Store.panels_in(m).each do |pg|
            reg[pg.entityID] = pg.get_attribute(Store::DICT, 'local_id')
            attach(pg, ENT)
          end
          Manager.registries[m.definition.entityID] = reg
        end

        def install
          return if @installed
          @installed = true
          Sketchup.add_observer(APP)
          attach_model(Sketchup.active_model) if Sketchup.active_model
        end
      end
    end
  end
end
