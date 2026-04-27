import { supabase } from "@/integrations/supabase/client";
import { formatISODate } from "./services";

export interface HoursDef {
  key:
    | "sup_24h" | "sup_adm" | "sup_adn" | "sup_he65" | "sup_he100"
    | "ope_24h" | "ope_adm" | "ope_adn" | "ope_he65" | "ope_he100"
    | "enc_adn" | "enc_he65" | "enc_he100"
    | "tst_adn" | "tst_he65" | "tst_he100";
  label: string;
  group: "SUPERVISÃO" | "IDENTIFICAÇÃO E OPERAÇÃO" | "OUTROS";
  short: string;
}

// Order matches Excel "RELATÓRIO DE HORAS M.O." columns left-to-right
export const HOURS: HoursDef[] = [
  { key: "sup_24h",  group: "SUPERVISÃO", short: "Supervisor 24h",     label: "8. Supervisão de Carregamento de Navios - Supervisor 24 horas" },
  { key: "sup_adm",  group: "SUPERVISÃO", short: "Supervisor Adm",     label: "9. Supervisão da Expedição - Supervisor Adm" },
  { key: "sup_adn",  group: "SUPERVISÃO", short: "Supervisor ADN",     label: "Supervisor - Adicional Noturno" },
  { key: "sup_he65", group: "SUPERVISÃO", short: "Supervisor HE 65%",  label: "Supervisor - Horas Extras (65%)" },
  { key: "sup_he100",group: "SUPERVISÃO", short: "Supervisor HE 100%", label: "Supervisor - Horas Extras (100%)" },
  { key: "ope_24h",  group: "IDENTIFICAÇÃO E OPERAÇÃO", short: "Operador 24h",    label: "10. Identificação e Operação - Operador 24 horas" },
  { key: "ope_adm",  group: "IDENTIFICAÇÃO E OPERAÇÃO", short: "Operador Adm",    label: "10. Identificação e Operação - Operador Adm" },
  { key: "ope_adn",  group: "IDENTIFICAÇÃO E OPERAÇÃO", short: "Operador ADN",    label: "Operador de expedição - Adicional Noturno" },
  { key: "ope_he65", group: "IDENTIFICAÇÃO E OPERAÇÃO", short: "Operador HE 65%", label: "Operador de expedição - Horas Extras (65%)" },
  { key: "ope_he100",group: "IDENTIFICAÇÃO E OPERAÇÃO", short: "Operador HE 100%",label: "Operador de expedição - Horas Extras (100%)" },
  { key: "enc_adn",  group: "OUTROS", short: "Encarregado ADN",    label: "Encarregado - Adicional Noturno" },
  { key: "enc_he65", group: "OUTROS", short: "Encarregado HE 65%", label: "Encarregado - Horas Extras (65%)" },
  { key: "enc_he100",group: "OUTROS", short: "Encarregado HE 100%",label: "Encarregado - Horas Extras (100%)" },
  { key: "tst_adn",  group: "OUTROS", short: "TST ADN",            label: "Técnico de Segurança - Adicional Noturno" },
  { key: "tst_he65", group: "OUTROS", short: "TST HE 65%",         label: "Técnico de Segurança - Horas Extras (65%)" },
  { key: "tst_he100",group: "OUTROS", short: "TST HE 100%",        label: "Técnico de Segurança - Horas Extras (100%)" },
];

export const HOURS_BY_GROUP: Record<HoursDef["group"], HoursDef[]> = HOURS.reduce(
  (acc, h) => { (acc[h.group] ||= []).push(h); return acc; },
  {} as Record<HoursDef["group"], HoursDef[]>,
);

export type DailyHours = {
  id: string;
  entry_date: string;
  notes: string | null;
} & Record<HoursDef["key"], number>;

export async function fetchHoursInRange(start: Date, end: Date): Promise<DailyHours[]> {
  const { data, error } = await supabase
    .from("daily_hours")
    .select("*")
    .gte("entry_date", formatISODate(start))
    .lte("entry_date", formatISODate(end))
    .order("entry_date", { ascending: true });
  if (error) throw error;
  return (data ?? []) as unknown as DailyHours[];
}

export async function fetchHoursByDate(date: Date): Promise<DailyHours | null> {
  const { data, error } = await supabase
    .from("daily_hours")
    .select("*")
    .eq("entry_date", formatISODate(date))
    .maybeSingle();
  if (error) throw error;
  return (data as unknown as DailyHours) ?? null;
}

export interface HoursTotals {
  totals: Record<HoursDef["key"], number>;
}

export function computeHoursTotals(rows: DailyHours[]): HoursTotals {
  const totals = {} as Record<HoursDef["key"], number>;
  for (const h of HOURS) totals[h.key] = 0;
  for (const r of rows) for (const h of HOURS) totals[h.key] += Number(r[h.key] ?? 0);
  return { totals };
}
