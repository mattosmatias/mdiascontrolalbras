import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
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
import { computeTotals, fetchEntriesInRange, type DailyEntry } from "@/lib/entries";
import { toast } from "sonner";

export const Route = createFileRoute("/historico")({
  head: () => ({
    meta: [
      { title: "Relatório de Produção Mensal — Albras" },
      { name: "description", content: "Relatório mensal de produção - Contrato CTR 4600009749." },
    ],
  }),
  component: () => (
    <AppShell>
      <HistoryPage />
    </AppShell>
  ),
});

const CATEGORY_ORDER: ServiceCategory[] = [
  "CINTAGEM POR PILHA",
  "MOVIMENTAÇÃO",
  "MOVIMENTAÇÃO EVENTUAL",
  "EXPORTAÇÃO",
];

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
  const todayISO = formatISODate(new Date());

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 print:hidden">
        <div>
          <div className="text-xs uppercase tracking-wider text-muted-foreground">Contrato CTR 4600009749</div>
          <h1 className="text-xl sm:text-2xl font-semibold">Relatório de Produção Mensal</h1>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setPeriod((p) => shiftPeriod(p.start, -1))}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={() => setPeriod(getPeriodForDate(new Date()))}>Atual</Button>
          <Button variant="outline" size="sm" onClick={() => setPeriod((p) => shiftPeriod(p.start, 1))}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Link to="/lancamentos" className="text-xs text-primary hover:underline ml-2">+ Lançar dia</Link>
        </div>
      </div>

      {loading ? (
        <div className="text-center text-sm text-muted-foreground py-10">
          <Loader2 className="h-5 w-5 animate-spin inline mr-2" /> Carregando...
        </div>
      ) : (
        <div className="sheet-wrapper">
          <table className="sheet">
            <caption>
              Relatório de Produção Mensal — Período {period.label}
            </caption>
            <thead>
              <tr>
                <th rowSpan={2} style={{ minWidth: 90 }}>Data</th>
                <th rowSpan={2} style={{ minWidth: 80 }}>Dia da semana</th>
                {CATEGORY_ORDER.map((cat) => (
                  <th key={cat} colSpan={SERVICES_BY_CATEGORY[cat].length}>{cat}</th>
                ))}
              </tr>
              <tr>
                {CATEGORY_ORDER.flatMap((cat) =>
                  SERVICES_BY_CATEGORY[cat].map((s) => (
                    <th key={s.key} className="sub" title={s.description}>
                      <div className="text-[10px] leading-tight">#{s.number}</div>
                      <div className="text-[10px] font-normal normal-case">{s.short}</div>
                      <div className="text-[9px] font-normal opacity-80">({s.unit})</div>
                    </th>
                  )),
                )}
              </tr>
            </thead>
            <tbody>
              {days.map((d) => {
                const iso = formatISODate(d);
                const e = entries.find((x) => x.entry_date === iso);
                const dow = d.getDay();
                const isWeekend = dow === 0 || dow === 6;
                const isToday = iso === todayISO;
                return (
                  <tr key={iso} className={`${isToday ? "today" : ""} ${isWeekend ? "weekend" : ""}`}>
                    <td className="label">{formatDateBR(d)}{isToday && <span className="ml-1 text-[9px] text-primary font-bold">●</span>}</td>
                    <td className="center text-[10px] text-muted-foreground">{dayOfWeekBR(d)}</td>
                    {SERVICES.map((s) => (
                      <td key={s.key} className="num">
                        {e && Number(e[s.key]) > 0 ? fmtNumber(Number(e[s.key]), s.unit === "TON" ? 2 : 0) : <span className="text-muted-foreground/40">—</span>}
                      </td>
                    ))}
                  </tr>
                );
              })}
              <tr className="subtotal">
                <td className="label">Dias preenchidos</td>
                <td className="center">{totals.filledDays}/{totals.totalDays}</td>
                {SERVICES.map((s) => (
                  <td key={s.key} className="num text-[10px] text-muted-foreground">—</td>
                ))}
              </tr>
              <tr className="average">
                <td className="label">Média diária</td>
                <td className="center text-[10px]">média</td>
                {SERVICES.map((s) => (
                  <td key={s.key} className="num">{fmtNumber(totals.averages[s.key], 2)}</td>
                ))}
              </tr>
              <tr className="total">
                <td className="label">TOTAL ATUAL</td>
                <td className="center text-[10px]">realizado</td>
                {SERVICES.map((s) => (
                  <td key={s.key} className="num">{fmtNumber(totals.totals[s.key], s.unit === "TON" ? 2 : 0)}</td>
                ))}
              </tr>
              <tr className="forecast">
                <td className="label">PREVISÃO FECHAMENTO</td>
                <td className="center text-[10px]">+{totals.remainingDays}d restantes</td>
                {SERVICES.map((s) => (
                  <td key={s.key} className="num">{fmtNumber(totals.forecast[s.key], s.unit === "TON" ? 2 : 0)}</td>
                ))}
              </tr>
            </tbody>
          </table>
          <div className="sheet-meta">
            <span>Período: {period.label}</span>
            <span>Previsão = Realizado + (Média × Dias restantes)</span>
          </div>
        </div>
      )}
    </div>
  );
}
