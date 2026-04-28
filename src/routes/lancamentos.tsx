import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { EditableNumberCell } from "@/components/EditableNumberCell";
import {
  SERVICES,
  SERVICES_BY_CATEGORY,
  dayOfWeekBR,
  eachDayInPeriod,
  fmtNumber,
  formatDateBR,
  formatISODate,
  getPeriodForDate,
  shiftPeriod,
  type ServiceCategory,
} from "@/lib/services";
import { fetchEntriesInRange, type DailyEntry } from "@/lib/entries";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export const Route = createFileRoute("/lancamentos")({
  head: () => ({ meta: [{ title: "Produção — Controle Albras" }] }),
  component: () => (
    <AppShell>
      <LancamentosPage />
    </AppShell>
  ),
});

const CATEGORIES = Object.keys(SERVICES_BY_CATEGORY) as ServiceCategory[];

function LancamentosPage() {
  const { canEdit, user } = useAuth();
  const [period, setPeriod] = useState(() => getPeriodForDate(new Date()));
  const [rows, setRows] = useState<DailyEntry[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchEntriesInRange(period.start, period.end);
      setRows(data);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => { load(); }, [load]);

  const days = useMemo(() => eachDayInPeriod(period.start, period.end), [period]);
  const byDate = useMemo(() => {
    const m = new Map<string, DailyEntry>();
    for (const r of rows) m.set(r.entry_date, r);
    return m;
  }, [rows]);

  const saveCell = useCallback(async (iso: string, key: string, value: number) => {
    if (!canEdit) throw new Error("Sem permissão");
    const existing = byDate.get(iso);
    const payload: Record<string, unknown> = {
      entry_date: iso,
      [key]: value,
      created_by: user?.id,
    };
    // Keep other fields when updating
    if (existing) {
      for (const s of SERVICES) {
        if (s.key !== key) payload[s.key] = Number(existing[s.key] ?? 0);
      }
      payload.notes = existing.notes;
    }
    const { error } = await supabase
      .from("daily_entries")
      .upsert(payload, { onConflict: "entry_date" });
    if (error) throw error;
    // update local state
    setRows((prev) => {
      const idx = prev.findIndex((r) => r.entry_date === iso);
      if (idx >= 0) {
        const copy = [...prev];
        copy[idx] = { ...copy[idx], [key]: value } as DailyEntry;
        return copy;
      }
      const fresh: any = { id: crypto.randomUUID(), entry_date: iso, notes: null };
      for (const s of SERVICES) fresh[s.key] = s.key === key ? value : 0;
      return [...prev, fresh].sort((a, b) => a.entry_date.localeCompare(b.entry_date));
    });
  }, [byDate, canEdit, user]);

  const totals = useMemo(() => {
    const t: Record<string, number> = {};
    for (const s of SERVICES) t[s.key] = 0;
    for (const r of rows) for (const s of SERVICES) t[s.key] += Number(r[s.key] ?? 0);
    return t;
  }, [rows]);

  const todayISO = formatISODate(new Date());

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <div className="text-xs uppercase tracking-wider text-muted-foreground">Contrato CTR 4600009749</div>
          <h1 className="text-2xl sm:text-3xl font-semibold">Relatório de Produção Mensal</h1>
          <p className="text-sm text-muted-foreground mt-1">Período: <strong>{period.label}</strong></p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setPeriod((p) => shiftPeriod(p.start, -1))}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={() => setPeriod(getPeriodForDate(new Date()))}>Atual</Button>
          <Button variant="outline" size="sm" onClick={() => setPeriod((p) => shiftPeriod(p.start, 1))}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {!canEdit && (
        <p className="text-xs text-muted-foreground">
          Seu papel atual permite apenas visualização.
        </p>
      )}

      {loading ? (
        <div className="text-center text-sm text-muted-foreground py-12">
          <Loader2 className="h-5 w-5 animate-spin inline mr-2" />Carregando...
        </div>
      ) : (
        <div className="sheet-wrapper">
          <table className="sheet">
            <caption>Relatório de Produção — {period.label}</caption>
            <thead>
              <tr>
                <th rowSpan={3} style={{ minWidth: 90 }}>Data</th>
                <th rowSpan={3} style={{ minWidth: 70 }}>Dia</th>
                {CATEGORIES.map((cat) => (
                  <th key={cat} colSpan={SERVICES_BY_CATEGORY[cat].length}>{cat}</th>
                ))}
              </tr>
              <tr>
                {CATEGORIES.flatMap((cat) =>
                  SERVICES_BY_CATEGORY[cat].map((s) => (
                    <th key={`n-${s.key}`} className="sub" title={s.description}>
                      <div className="text-[10px] font-semibold">Serviço {s.number}</div>
                    </th>
                  ))
                )}
              </tr>
              <tr>
                {CATEGORIES.flatMap((cat) =>
                  SERVICES_BY_CATEGORY[cat].map((s) => (
                    <th key={`u-${s.key}`} className="sub" title={s.description}>
                      <div className="text-[10px] font-normal normal-case leading-tight">{s.short}</div>
                      <div className="text-[9px] font-normal opacity-80">({s.unit})</div>
                    </th>
                  ))
                )}
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
                    {CATEGORIES.flatMap((cat) =>
                      SERVICES_BY_CATEGORY[cat].map((s) => (
                        <EditableNumberCell
                          key={`${iso}-${s.key}`}
                          value={Number(r?.[s.key] ?? 0)}
                          disabled={!canEdit}
                          decimals={s.unit === "TON" ? 2 : 0}
                          onCommit={(n) => saveCell(iso, s.key, n)}
                        />
                      ))
                    )}
                  </tr>
                );
              })}
              <tr className="total">
                <td className="label">TOTAL</td>
                <td className="center text-[10px]">período</td>
                {CATEGORIES.flatMap((cat) =>
                  SERVICES_BY_CATEGORY[cat].map((s) => (
                    <td key={`t-${s.key}`} className="num">
                      {fmtNumber(totals[s.key], s.unit === "TON" ? 2 : 0)}
                    </td>
                  ))
                )}
              </tr>
            </tbody>
          </table>
          <div className="sheet-meta">
            <span>Células editáveis — Enter ou Tab para salvar</span>
            <span>Período: {period.label}</span>
          </div>
        </div>
      )}
    </div>
  );
}
