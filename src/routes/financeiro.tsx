import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { fmtNumber, getPeriodForDate, shiftPeriod } from "@/lib/services";
import { fetchEntriesInRange, type DailyEntry } from "@/lib/entries";
import { fetchHoursInRange, type DailyHours } from "@/lib/hours";
import { fetchPrices, totalQuantityFor, type ServicePrice } from "@/lib/financial";
import { toast } from "sonner";

export const Route = createFileRoute("/financeiro")({
  head: () => ({ meta: [{ title: "Financeiro — Controle Albras" }] }),
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

  const groups = useMemo(() => {
    const result: Record<string, { items: Array<{ p: ServicePrice; qty: number; total: number }>; subtotal: number }> = {};
    for (const p of prices) {
      const qty = totalQuantityFor(p, entries, hours);
      const total = qty * Number(p.unit_price);
      const g = result[p.group_label] ||= { items: [], subtotal: 0 };
      g.items.push({ p, qty, total });
      g.subtotal += total;
    }
    return result;
  }, [prices, entries, hours]);

  const grandTotal = Object.values(groups).reduce((a, g) => a + g.subtotal, 0);
  const groupOrder = ["CONTROLADORIA", "FUNDIÇÃO"];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <div className="text-xs uppercase tracking-wider text-muted-foreground font-medium">Controle Diário (Financeiro)</div>
          <h1 className="text-2xl sm:text-3xl font-semibold mt-1">{period.label}</h1>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setPeriod((p) => shiftPeriod(p.start, -1))}><ChevronLeft className="h-4 w-4" /></Button>
          <Button variant="outline" size="sm" onClick={() => setPeriod(getPeriodForDate(new Date()))}>Atual</Button>
          <Button variant="outline" size="sm" onClick={() => setPeriod((p) => shiftPeriod(p.start, 1))}><ChevronRight className="h-4 w-4" /></Button>
        </div>
      </div>

      <Card className="shadow-card border-primary/20 bg-gradient-subtle">
        <CardHeader>
          <CardDescription>Total C&amp;F do período</CardDescription>
          <CardTitle className="text-4xl text-primary">{fmtBRL(grandTotal)}</CardTitle>
        </CardHeader>
      </Card>

      {loading ? (
        <div className="text-center text-sm text-muted-foreground py-10"><Loader2 className="h-5 w-5 animate-spin inline mr-2" />Carregando...</div>
      ) : (
        groupOrder.filter((g) => groups[g]).map((g) => (
          <Card key={g} className="shadow-card overflow-hidden">
            <CardHeader>
              <CardTitle className="text-base">{g}</CardTitle>
              <CardDescription>Subtotal: <strong>{fmtBRL(groups[g].subtotal)}</strong></CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/60 text-xs uppercase tracking-wider text-muted-foreground">
                    <tr>
                      <th className="text-left px-3 py-2 font-medium">linha</th>
                      <th className="text-left px-3 py-2 font-medium">Ref</th>
                      <th className="text-left px-3 py-2 font-medium">Descrição</th>
                      <th className="text-center px-3 py-2 font-medium">Unid.</th>
                      <th className="text-right px-3 py-2 font-medium">Preço unit.</th>
                      <th className="text-right px-3 py-2 font-medium">Quantidade</th>
                      <th className="text-right px-3 py-2 font-medium">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {groups[g].items.map(({ p, qty, total }) => (
                      <tr key={p.id} className="border-t hover:bg-muted/30">
                        <td className="px-3 py-2 tabular-nums text-muted-foreground">{p.line_no}</td>
                        <td className="px-3 py-2 text-xs">{p.ref ?? "—"}</td>
                        <td className="px-3 py-2">{p.description}</td>
                        <td className="px-3 py-2 text-center text-xs">{p.unit}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{Number(p.unit_price).toFixed(2)}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{fmtNumber(qty, 2)}</td>
                        <td className="px-3 py-2 text-right tabular-nums font-medium">{fmtBRL(total)}</td>
                      </tr>
                    ))}
                    <tr className="border-t-2 border-primary/30 bg-muted/40 font-semibold">
                      <td colSpan={6} className="px-3 py-3 text-right">Subtotal {g}</td>
                      <td className="px-3 py-3 text-right tabular-nums">{fmtBRL(groups[g].subtotal)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
}
