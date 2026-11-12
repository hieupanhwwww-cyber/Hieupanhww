'use client';
import { PLAN_PRESETS, TRIGGERS, newPlan, planAmounts, planOver, planWarnText, planRow, type PlanRow, type Trigger } from '@/lib/orderMoney';
import { formatVnd } from '@/lib/money';
import { MoneyInput } from '@/components/MoneyInput';
import type { Settings } from '@/lib/settings';

/** Soạn lịch thanh toán theo đợt: đợt cuối luôn là phần còn lại. */
export function PlanEditor({ plan, total, onChange, settings }: { plan: PlanRow[]; total: number; onChange: (p: PlanRow[]) => void; settings: Settings | null }) {
  const amounts = planAmounts(plan, total);
  const set = (i: number, patch: Partial<PlanRow>) => onChange(plan.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const preset = (rows: Partial<PlanRow>[]) => onChange(newPlan(rows));
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm text-muted">Mẫu:</span>
        {(['2', '3', '4'] as const).map((k) => (
          <button type="button" key={k} className="chip border border-line bg-surface px-3 py-1 text-sm" onClick={() => preset(PLAN_PRESETS[k].rows)}>{PLAN_PRESETS[k].label}</button>
        ))}
        {settings?.plan_template?.length ? <button type="button" className="chip border border-line bg-surface px-3 py-1 text-sm" onClick={() => preset(settings.plan_template!)}>Mẫu của cửa hàng</button> : null}
        <button type="button" className="chip border border-line bg-surface px-3 py-1 text-sm" onClick={() => onChange([])}>Không chia đợt</button>
      </div>
      {!plan.length && <p className="text-sm text-muted">Không chia đợt: khách trả một lần, đến hạn khi nghiệm thu.</p>}
      {plan.map((r, i) => {
        const last = i === plan.length - 1;
        return (
          <div key={r.id} className="rounded-xl border border-line p-2">
            <div className="flex items-center gap-2">
              <span className="chip bg-brand-soft text-brand">Đợt {i + 1}</span>
              <input className="input flex-1 py-1.5" aria-label={`Tên đợt ${i + 1}`} value={r.label} onChange={(e) => set(i, { label: e.target.value })} />
              {plan.length > 1 && <button type="button" className="btn-ghost px-2 py-1" aria-label={`Bỏ đợt ${i + 1}`} onClick={() => onChange(plan.filter((_, j) => j !== i))}>✕</button>}
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
              {last ? <span className="text-muted">Phần còn lại</span> : r.fixed ? (
                <MoneyInput className="w-36" value={r.amt ?? 0} onChange={(v) => set(i, { amt: v })} />
              ) : (
                <label className="flex items-center gap-1"><input className="input w-16 px-2 py-1.5 text-right" inputMode="decimal" aria-label={`Phần trăm đợt ${i + 1}`} value={r.pct}
                  onChange={(e) => { const v = Number(e.target.value.replace(',', '.')); if (!Number.isNaN(v)) set(i, { pct: Math.min(100, Math.max(0, v)) }); }} />%</label>
              )}
              {!last && <button type="button" className="text-brand underline" onClick={() => set(i, r.fixed ? { fixed: undefined, amt: undefined } : { fixed: true, amt: amounts[i].amount })}>{r.fixed ? 'đổi sang %' : 'đổi sang số tiền'}</button>}
              <select className="input w-auto py-1.5" aria-label={`Mốc đợt ${i + 1}`} value={r.trigger} onChange={(e) => set(i, { trigger: e.target.value as Trigger })}>
                {(Object.keys(TRIGGERS) as Trigger[]).map((t) => <option key={t} value={t}>{TRIGGERS[t]}</option>)}
              </select>
              <span className="ml-auto font-semibold">{formatVnd(amounts[i].amount)}</span>
            </div>
          </div>
        );
      })}
      {plan.length > 0 && <button type="button" className="btn-ghost w-full py-1.5 text-sm" onClick={() => onChange([...plan.slice(0, -1), planRow({ label: `Đợt ${plan.length}`, pct: 0, trigger: 'date' }), plan[plan.length - 1]])}>+ Thêm đợt</button>}
      {planOver(plan, total) && <p className="text-sm text-danger">{planWarnText(plan, total)}</p>}
    </div>
  );
}
