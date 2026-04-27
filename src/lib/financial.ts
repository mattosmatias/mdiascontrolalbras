import { supabase } from "@/integrations/supabase/client";
import type { DailyEntry } from "./entries";
import type { DailyHours } from "./hours";

export interface ServicePrice {
  id: string;
  line_no: number;
  ref: string | null;
  description: string;
  group_label: "CONTROLADORIA" | "FUNDIÇÃO";
  unit: string;
  unit_price: number;
  source_kind: "service_op" | "service_eq" | "hour";
  source_key: string;
  display_order: number;
  active: boolean;
}

export async function fetchPrices(): Promise<ServicePrice[]> {
  const { data, error } = await supabase
    .from("service_prices")
    .select("*")
    .eq("active", true)
    .order("display_order", { ascending: true });
  if (error) throw error;
  return (data ?? []) as unknown as ServicePrice[];
}

/** For a given price line and a daily entry+hours record, get the quantity for that day. */
export function quantityFor(p: ServicePrice, entry?: DailyEntry | null, hours?: DailyHours | null): number {
  if (p.source_kind === "hour") return Number(hours?.[p.source_key as keyof DailyHours] ?? 0) || 0;
  // service_op or service_eq both pull from the same daily_entries column (the service quantity)
  return Number(entry?.[p.source_key as keyof DailyEntry] ?? 0) || 0;
}

/** Aggregate quantity across all entries/hours for a price line. */
export function totalQuantityFor(p: ServicePrice, entries: DailyEntry[], hoursList: DailyHours[]): number {
  if (p.source_kind === "hour") {
    return hoursList.reduce((a, h) => a + (Number(h[p.source_key as keyof DailyHours] ?? 0) || 0), 0);
  }
  return entries.reduce((a, e) => a + (Number(e[p.source_key as keyof DailyEntry] ?? 0) || 0), 0);
}
