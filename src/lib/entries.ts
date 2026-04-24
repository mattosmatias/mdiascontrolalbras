import { supabase } from "@/integrations/supabase/client";
import { formatISODate, SERVICES, type ServiceDef } from "./services";

export type DailyEntry = {
  id: string;
  entry_date: string;
  notes: string | null;
} & Record<ServiceDef["key"], number>;

export async function fetchEntriesInRange(start: Date, end: Date): Promise<DailyEntry[]> {
  const { data, error } = await supabase
    .from("daily_entries")
    .select("*")
    .gte("entry_date", formatISODate(start))
    .lte("entry_date", formatISODate(end))
    .order("entry_date", { ascending: true });
  if (error) throw error;
  return (data ?? []) as unknown as DailyEntry[];
}

export async function fetchEntryByDate(date: Date): Promise<DailyEntry | null> {
  const { data, error } = await supabase
    .from("daily_entries")
    .select("*")
    .eq("entry_date", formatISODate(date))
    .maybeSingle();
  if (error) throw error;
  return (data as unknown as DailyEntry) ?? null;
}

export interface PeriodTotals {
  totals: Record<ServiceDef["key"], number>;
  filledDays: number;
  totalDays: number;
  remainingDays: number;
  averages: Record<ServiceDef["key"], number>;
  forecast: Record<ServiceDef["key"], number>;
}

export function computeTotals(
  entries: DailyEntry[],
  totalDays: number,
): PeriodTotals {
  const totals = {} as Record<ServiceDef["key"], number>;
  const averages = {} as Record<ServiceDef["key"], number>;
  const forecast = {} as Record<ServiceDef["key"], number>;
  for (const s of SERVICES) {
    totals[s.key] = 0;
  }

  // count "filled" as days where any service > 0
  let filledDays = 0;
  for (const e of entries) {
    let any = false;
    for (const s of SERVICES) {
      const v = Number(e[s.key] ?? 0);
      totals[s.key] += v;
      if (v > 0) any = true;
    }
    if (any) filledDays++;
  }
  const remaining = Math.max(0, totalDays - filledDays);
  for (const s of SERVICES) {
    const avg = filledDays > 0 ? totals[s.key] / filledDays : 0;
    averages[s.key] = avg;
    forecast[s.key] = totals[s.key] + avg * remaining;
  }
  return { totals, filledDays, totalDays, remainingDays: remaining, averages, forecast };
}
