import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Loader2, TrendingUp } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { eachDayInPeriod, fmtNumber, formatISODate, getPeriodForDate, shiftPeriod } from "@/lib/services";
import { fetchEntriesInRange, type DailyEntry } from "@/lib/entries";
import { fetchHoursInRange, type DailyHours } from "@/lib/hours";
import { fetchPrices, totalQuantityFor, type ServicePrice } from "@/lib/financial";
import { toast } from "sonner";

export const Route = createFileRoute("/financeiro")({
  head: () => ({ meta: [{ title: "Controle Diário (Financeiro) — Albras" }] }),
  component: () => (<AppShell><FinanceiroPage /></AppShell>),
});

const fmtBRL = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function FinanceiroPage() {
  const [period, setPeriod] = useState(() => getPeriodForDate(new Date()));
  const [entries, setEntries] = useState<DailyEntry[]>([]);
  const [hours, setHours] = useState<DailyHours[]>([]);
  const [prices, setPrices] = useState<ServicePrice[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancel = false;
    setLoading(true);
    Promise.all([
      fetchEntriesInRange(period.start, period.end),
      fetchHoursInRange(period.start, period.end),
      fetchPrices(),
    ]).then(([e, h, p]) => {
      if (cancel) return;
      setEntries(e); setHours(h); setPrices(p);
    }).catch((err) => toast.error(err.message)).finally(() => !cancel && setLoading(false));
    return () => { cancel = true; };
  }, [period]);

  // Days "filled" = days with any entry OR any hours
  const { totalDays, filledDays, remainingDays } = useMemo(() => {
    const days = eachDayInPeriod(period.start, period.end);
    const filledSet = new Set<string>();
    for (const e of entries) {
      if (Object.keys(e).some((k) => k.startsWith("s") && Number((e as any)[k]) > 0)) filledSet.add(e.entry_date);
    }
    for (const h of hours) {
      if (Object.keys(h).some((k) => (k.startsWith("sup_") || k.startsWith("ope_") || k.startsWith("enc_") || k.startsWith("tst_")) && Number((h as any)[k]) > 0)) {
        filledSet.add(h.entry_date);
      }
    }
    const filled = filledSet.size;
    return { totalDays: days.length, filledDays: filled, remainingDays: Math.max(0, days.length - filled) };
  }, [period, entries, hours]);

  const groups = useMemo(() => {
    const result: Record<string, { items: Array<{ p: ServicePrice; qty: number; total: number; avg: number; forecastQty: number; forecastTotal: number }>; subtotal: number; forecastSubtotal: number }> = {};
    for (const p of prices) {
      const qty = totalQuantityFor(p, entries, hours);
      const total = qty * Number(p.unit_price);
      const avg = filledDays > 0 ? qty / filledDays : 0;
      const forecastQty = qty + avg * remainingDays;
      const forecastTotal = forecastQty * Number(p.unit_price);
      const g = result[p.group_label] ||= { items: [], subtotal: 0, forecastSubtotal: 0 };
      g.items.push({ p, qty, total, avg, forecastQty, forecastTotal });
      g.subtotal += total;
      g.forecastSubtotal += forecastTotal;
    }
    return result;
  }, [prices, entries, hours, filledDays, remainingDays]);

  const grandTotal = Object.values(groups).reduce((a, g) => a + g.subtotal, 0);
  const grandForecast = Object.values(groups).reduce((a, g) => a + g.forecastSubtotal, 0);
  const groupOrder = ["CONTROLADORIA", "FUNDIÇÃO"];

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 print:hidden">
        <div>
          <div className="text-xs uppercase tracking-wider text-muted-foreground">Contrato CTR 4600009749</div>
          <h1 className="text-xl sm:text-2xl font-semibold">Controle Diário — Financeiro</h1>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setPeriod((p) => shiftPeriod(p.start, -1))}><ChevronLeft className="h-4 w-4" /></Button>
          <Button variant="outline" size="sm" onClick={() => setPeriod(getPeriodForDate(new Date()))}>Atual</Button>
          <Button variant="outline" size="sm" onClick={() => setPeriod((p) => shiftPeriod(p.start, 1))}><ChevronRight className="h-4 w-4" /></Button>
        </div>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <KpiCard label="Realizado até hoje" value={fmtBRL(grandTotal)} sub={`${filledDays} de ${totalDays} dias preenchidos`} />
        <KpiCard
          label="Previsão de fechamento"
          value={fmtBRL(grandForecast)}
          sub={`+${remainingDays} dias restantes (média × restantes)`}
          highlight
          icon={<TrendingUp className="h-4 w-4" />}
        />
        <KpiCard label="Variação prevista" value={fmtBRL(grandForecast - grandTotal)} sub={`Acréscimo estimado no período`} />
      </div>

      {loading ? (
        <div className="text-center text-sm text-muted-foreground py-10"><Loader2 className="h-5 w-5 animate-spin inline mr-2" />Carregando...</div>
      ) : (
        groupOrder.filter((g) => groups[g]).map((g) => (
          <div key={g} className="sheet-wrapper">
            <table className="sheet">
              <caption>{g === "CONTROLADORIA" ? "Controle Diário — Controladoria" : "Controle Diário — Fundição"} — {period.label}</caption>
              <thead>
                <tr>
                  <th style={{ width: 50 }}>Linha</th>
                  <th style={{ width: 90 }}>Ref</th>
                  <th style={{ minWidth: 320, textAlign: "left" }}>Descrição</th>
                  <th style={{ width: 60 }}>Unid.</th>
                  <th style={{ width: 100 }}>Preço unit. (R$)</th>
                  <th style={{ width: 100 }}>Qtde realizada</th>
                  <th style={{ width: 130 }}>Total realizado</th>
                  <th style={{ width: 100 }}>Qtde prevista</th>
                  <th style={{ width: 130 }}>Total previsto</th>
                </tr>
              </thead>
              <tbody>
                {groups[g].items.map(({ p, qty, total, forecastQty, forecastTotal }) => (
                  <tr key={p.id}>
                    <td className="center text-muted-foreground">{p.line_no}</td>
                    <td className="center text-[10px]">{p.ref ?? "—"}</td>
                    <td className="label" style={{ whiteSpace: "normal" }}>{p.description}</td>
                    <td className="center text-[10px]">{p.unit}</td>
                    <td className="num">{Number(p.unit_price).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 4 })}</td>
                    <td className="num">{fmtNumber(qty, 2)}</td>
                    <td className="num">{fmtBRL(total)}</td>
                    <td className="num text-[oklch(0.4_0.12_75)]">{fmtNumber(forecastQty, 2)}</td>
                    <td className="num text-[oklch(0.4_0.12_75)] font-semibold">{fmtBRL(forecastTotal)}</td>
                  </tr>
                ))}
                <tr className="subtotal">
                  <td colSpan={6} style={{ textAlign: "right" }}>Subtotal {g} (realizado)</td>
                  <td className="num">{fmtBRL(groups[g].subtotal)}</td>
                  <td></td>
                  <td className="num">{fmtBRL(groups[g].forecastSubtotal)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        ))
      )}

      {!loading && (
        <div className="sheet-wrapper">
          <table className="sheet">
            <tbody>
              <tr className="total">
                <td className="label" style={{ width: "60%" }}>TOTAL GERAL DO PERÍODO</td>
                <td className="num" style={{ width: "20%" }}>Realizado: {fmtBRL(grandTotal)}</td>
                <td className="num" style={{ width: "20%" }}>Previsto: {fmtBRL(grandForecast)}</td>
              </tr>
            </tbody>
          </table>
          <div className="sheet-meta">
            <span>Período: {period.label}</span>
            <span>Previsão = Realizado + (Média diária × {remainingDays} dias restantes)</span>
          </div>
        </div>
      )}
    </div>
  );
}

function KpiCard({ label, value, sub, highlight, icon }: { label: string; value: string; sub?: string; highlight?: boolean; icon?: React.ReactNode }) {
  return (
    <div className={`rounded-lg border p-4 shadow-card ${highlight ? "bg-gradient-primary text-primary-foreground border-primary" : "bg-card"}`}>
      <div className={`text-xs uppercase tracking-wider flex items-center gap-2 ${highlight ? "opacity-90" : "text-muted-foreground"}`}>
        {icon}{label}
      </div>
      <div className="text-2xl font-bold mt-1 tabular-nums">{value}</div>
      {sub && <div className={`text-[11px] mt-1 ${highlight ? "opacity-80" : "text-muted-foreground"}`}>{sub}</div>}
    </div>
  );
}
