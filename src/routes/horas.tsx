import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { EditableNumberCell } from "@/components/EditableNumberCell";
import {
  dayOfWeekBR,
  eachDayInPeriod,
  fmtNumber,
  formatDateBR,
  formatISODate,
  getPeriodForDate,
  shiftPeriod,
} from "@/lib/services";
import { HOURS, HOURS_BY_GROUP, fetchHoursInRange, type DailyHours, type HoursDef } from "@/lib/hours";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export const Route = createFileRoute("/horas")({
  head: () => ({ meta: [{ title: "Horas M.O. — Controle Albras" }] }),
  component: () => (<AppShell><HorasPage /></AppShell>),
});

const GROUPS = Object.keys(HOURS_BY_GROUP) as HoursDef["group"][];

function HorasPage() {
  const { canEdit, user } = useAuth();
  const [period, setPeriod] = useState(() => getPeriodForDate(new Date()));
  const [rows, setRows] = useState<DailyHours[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setRows(await fetchHoursInRange(period.start, period.end));
    } catch (e: any) { toast.error(e.message); }
    finally { setLoading(false); }
  }, [period]);

  useEffect(() => { load(); }, [load]);

  const days = useMemo(() => eachDayInPeriod(period.start, period.end), [period]);
  const byDate = useMemo(() => {
    const m = new Map<string, DailyHours>();
    for (const r of rows) m.set(r.entry_date, r);
    return m;
  }, [rows]);

  const saveCell = useCallback(async (iso: string, key: string, value: number) => {
    if (!canEdit) throw new Error("Sem permissão");
    const existing = byDate.get(iso);
    const payload: any = { entry_date: iso, [key]: value, created_by: user?.id };
    if (existing) {
      for (const h of HOURS) if (h.key !== key) payload[h.key] = Number(existing[h.key] ?? 0);
    }
    const { error } = await supabase.from("daily_hours").upsert(payload, { onConflict: "entry_date" });
    if (error) throw error;
    setRows((prev) => {
      const idx = prev.findIndex((r) => r.entry_date === iso);
      if (idx >= 0) {
        const copy = [...prev];
        copy[idx] = { ...copy[idx], [key]: value } as DailyHours;
        return copy;
      }
      const fresh: any = { id: crypto.randomUUID(), entry_date: iso, notes: null };
      for (const h of HOURS) fresh[h.key] = h.key === key ? value : 0;
      return [...prev, fresh].sort((a, b) => a.entry_date.localeCompare(b.entry_date));
    });
  }, [byDate, canEdit, user]);

  const totals = useMemo(() => {
    const t: Record<string, number> = {};
    for (const h of HOURS) t[h.key] = 0;
    for (const r of rows) for (const h of HOURS) t[h.key] += Number(r[h.key] ?? 0);
    return t;
  }, [rows]);

  const todayISO = formatISODate(new Date());

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <div className="text-xs uppercase tracking-wider text-muted-foreground">Contrato CTR 4600009749</div>
          <h1 className="text-2xl sm:text-3xl font-semibold">Relatório de Horas M.O.</h1>
          <p className="text-sm text-muted-foreground mt-1">Período: <strong>{period.label}</strong></p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setPeriod((p) => shiftPeriod(p.start, -1))}><ChevronLeft className="h-4 w-4" /></Button>
          <Button variant="outline" size="sm" onClick={() => setPeriod(getPeriodForDate(new Date()))}>Atual</Button>
          <Button variant="outline" size="sm" onClick={() => setPeriod((p) => shiftPeriod(p.start, 1))}><ChevronRight className="h-4 w-4" /></Button>
        </div>
      </div>

      {!canEdit && <p className="text-xs text-muted-foreground">Seu papel atual permite apenas visualização.</p>}

      {loading ? (
        <div className="text-center text-sm text-muted-foreground py-12"><Loader2 className="h-5 w-5 animate-spin inline mr-2" />Carregando...</div>
      ) : (
        <div className="sheet-wrapper">
          <table className="sheet">
            <caption>Relatório de Horas M.O. — {period.label}</caption>
            <thead>
              <tr>
                <th rowSpan={2} style={{ minWidth: 90 }}>Data</th>
                <th rowSpan={2} style={{ minWidth: 70 }}>Dia</th>
                {GROUPS.map((g) => (
                  <th key={g} colSpan={HOURS_BY_GROUP[g].length}>{g}</th>
                ))}
              </tr>
              <tr>
                {HOURS.map((h) => (
                  <th key={h.key} className="sub" title={h.label}>
                    <div className="text-[10px] font-normal normal-case leading-tight">{h.short}</div>
                    <div className="text-[9px] font-normal opacity-80">(HH)</div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {days.map((d) => {
                const iso = formatISODate(d);
                const r = byDate.get(iso);
                const dow = d.getDay();
                const isWeekend = dow === 0 || dow === 6;
                const isToday = iso === todayISO;
                return (
                  <tr key={iso} className={`${isToday ? "today" : ""} ${isWeekend ? "weekend" : ""} ${!canEdit ? "locked" : ""}`}>
                    <td className="label">{formatDateBR(d)}</td>
                    <td className="center text-[10px] text-muted-foreground">{dayOfWeekBR(d)}</td>
                    {HOURS.map((h) => (
                      <EditableNumberCell
                        key={`${iso}-${h.key}`}
                        value={Number(r?.[h.key] ?? 0)}
                        disabled={!canEdit}
                        decimals={1}
                        onCommit={(n) => saveCell(iso, h.key, n)}
                      />
                    ))}
                  </tr>
                );
              })}
              <tr className="total">
                <td className="label">TOTAL HH</td>
                <td className="center text-[10px]">período</td>
                {HOURS.map((h) => (
                  <td key={`t-${h.key}`} className="num">{fmtNumber(totals[h.key], 1)}</td>
                ))}
              </tr>
            </tbody>
          </table>
          <div className="sheet-meta">
            <span>Células editáveis — Enter ou Tab para salvar</span>
            <span>HH = Horas-Homem</span>
          </div>
        </div>
      )}
    </div>
  );
}
