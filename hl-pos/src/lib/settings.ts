'use client';
import { supabase } from './supabase/client';
import type { PlanRow } from './orderMoney';

export type Settings = {
  name: string; address: string; phone: string; note: string | null; tagline: string; email: string; logo: string | null;
  bank_name: string; bank_bin: string; bank_account: string; bank_holder: string; memo_prefix: string;
  default_note: string; default_terms: string; code_prefix: string; warranty_months: number;
  plan_template: Partial<PlanRow>[] | null; follow_days: number; cash_start_date: string | null; cash_start_amount: number;
};
export const SETTINGS_COLS = 'name, address, phone, note, tagline, email, logo, bank_name, bank_bin, bank_account, bank_holder, memo_prefix, default_note, default_terms, code_prefix, warranty_months, plan_template, follow_days, cash_start_date, cash_start_amount';

export async function loadSettings(): Promise<Settings> {
  const { data, error } = await supabase().from('store_settings').select(SETTINGS_COLS).single();
  if (error) throw error;
  return { ...(data as unknown as Settings), cash_start_amount: Number((data as { cash_start_amount: number }).cash_start_amount) };
}
export async function saveSettings(patch: Partial<Settings>): Promise<void> {
  const { error } = await supabase().from('store_settings').update(patch).eq('id', 1);
  if (error) throw error;
}
