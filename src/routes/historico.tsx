import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Edit3, Loader2 } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  SERVICES,
  dayOfWeekBR,
  eachDayInPeriod,
  fmtNumber,
  formatDateBR,
  formatISODate,
  getPeriodForDate,
  shiftPeriod,
} from "@/lib/services";
import { computeTotals, fetchEntriesInRange, type DailyEntry } from "@/lib/entries";
import { toast } from "sonner";

export const Route = createFileRoute("/historico")({
  head: () => ({
    meta: [
      { title: "Histórico — Controle Diário Albras" },
      { name: "description", content: "Visualização detalhada dos lançamentos por dia." },
    ],
  }),
  component: () => (
    <AppShell>
      <HistoryPage />
    </AppShell>
  ),
});

function HistoryPage() {
  const [period, setPeriod] = useState(() => getPeriodForDate(new Date()));
  const [entries, setEntries] = useState<DailyEntry[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancel = false;
    setLoading(true);
    fetchEntriesInRange(period.start, period.end)
      .then((d) => !cancel && setEntries(d))
      .catch((e) => toast.error(e.message))
      .finally(() => !cancel && setLoading(false));
    return () => { cancel = true; };
  }, [period]);

  const days = useMemo(() => eachDayInPeriod(period.start, period.end), [period]);
  const totals = useMemo(() => computeTotals(entries, days.length), [entries, days.length]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-semibold">Histórico do período</h1>
          <p className="text-sm text-muted-foreground mt-1">{period.label}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setPeriod((p) => shiftPeriod(p.start, -1))}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={() => setPeriod(getPeriodForDate(new Date()))}>
            Atual
          </Button>
          <Button variant="outline" size="sm" onClick={() => setPeriod((p) => shiftPeriod(p.start, 1))}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <Card className="shadow-card overflow-hidden">
        <CardHeader>
          <CardTitle className="text-base">Lançamentos diários</CardTitle>
          <CardDescription>Clique em uma data para editar o lançamento</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="text-center text-sm text-muted-foreground py-10">
              <Loader2 className="h-5 w-5 animate-spin inline mr-2" /> Carregando...
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-muted/60 text-muted-foreground uppercase tracking-wider">
                  <tr>
                    <th className="text-left px-3 py-3 font-medium sticky left-0 bg-muted/60 z-10">Data</th>
                    <th className="text-left px-3 py-3 font-medium">Dia</th>
                    {SERVICES.map((s) => (
                      <th key={s.key} className="text-right px-3 py-3 font-medium whitespace-nowrap">
                        #{s.number} <span className="text-[10px] font-normal">({s.unit})</span>
                      </th>
                    ))}
                    <th className="px-2 py-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {days.map((d) => {
                    const iso = formatISODate(d);
                    const e = entries.find((x) => x.entry_date === iso);
                    const isToday = formatISODate(new Date()) === iso;
                    return (
                      <tr key={iso} className={`border-t hover:bg-muted/30 ${isToday ? "bg-primary/5" : ""}`}>
                        <td className="px-3 py-2 font-medium sticky left-0 bg-card">
                          {formatDateBR(d)}
                          {isToday && <span className="ml-2 text-[10px] text-primary font-semibold">HOJE</span>}
                        </td>
                        <td className="px-3 py-2 text-muted-foreground">{dayOfWeekBR(d)}</td>
                        {SERVICES.map((s) => (
                          <td key={s.key} className="px-3 py-2 text-right tabular-nums">
                            {e ? fmtNumber(Number(e[s.key])) : <span className="text-muted-foreground/40">—</span>}
                          </td>
                        ))}
                        <td className="px-2 py-2">
                          <Link to="/lancamentos" className="inline-flex items-center text-primary hover:underline">
                            <Edit3 className="h-3.5 w-3.5" />
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                  <tr className="border-t-2 border-primary/30 bg-muted/40 font-semibold">
                    <td className="px-3 py-3 sticky left-0 bg-muted/60">TOTAL</td>
                    <td></td>
                    {SERVICES.map((s) => (
                      <td key={s.key} className="px-3 py-3 text-right tabular-nums">
                        {fmtNumber(totals.totals[s.key])}
                      </td>
                    ))}
                    <td></td>
                  </tr>
                  <tr className="bg-primary/5 font-semibold text-primary">
                    <td className="px-3 py-3 sticky left-0 bg-primary/5">PREVISÃO</td>
                    <td></td>
                    {SERVICES.map((s) => (
                      <td key={s.key} className="px-3 py-3 text-right tabular-nums">
                        {fmtNumber(totals.forecast[s.key])}
                      </td>
                    ))}
                    <td></td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
