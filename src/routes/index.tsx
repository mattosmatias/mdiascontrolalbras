import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Download, FileSpreadsheet, FileText, TrendingUp, CalendarDays, CheckCircle2 } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import { exportPDF, exportXLSX } from "@/lib/exporters";
import { toast } from "sonner";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Dashboard — Controle Diário Albras" },
      { name: "description", content: "Acompanhamento e previsão de fechamento do período Albras." },
    ],
  }),
  component: DashboardPage,
});

const CATEGORY_ORDER: ServiceCategory[] = [
  "CINTAGEM POR PILHA",
  "MOVIMENTAÇÃO",
  "MOVIMENTAÇÃO EVENTUAL",
  "EXPORTAÇÃO",
];

function DashboardPage() {
  return (
    <AppShell>
      <Dashboard />
    </AppShell>
  );
}

function Dashboard() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [period, setPeriod] = useState(() => getPeriodForDate(new Date()));
  const [entries, setEntries] = useState<DailyEntry[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth" });
  }, [loading, user, navigate]);

  useEffect(() => {
    let cancel = false;
    setBusy(true);
    fetchEntriesInRange(period.start, period.end)
      .then((d) => !cancel && setEntries(d))
      .catch((e) => toast.error(e.message))
      .finally(() => !cancel && setBusy(false));
    return () => {
      cancel = true;
    };
  }, [period]);

  const days = useMemo(() => eachDayInPeriod(period.start, period.end), [period]);
  const totals = useMemo(() => computeTotals(entries, days.length), [entries, days.length]);
  const progress = days.length > 0 ? (totals.filledDays / days.length) * 100 : 0;

  // KPI categories
  const catTotals = useMemo(() => {
    return CATEGORY_ORDER.map((cat) => {
      const services = SERVICES_BY_CATEGORY[cat] ?? [];
      const sum = services.reduce((a, s) => a + totals.totals[s.key], 0);
      const fc = services.reduce((a, s) => a + totals.forecast[s.key], 0);
      const unit = services.every((s) => s.unit === services[0].unit) ? services[0].unit : "MISTO";
      return { cat, sum, fc, unit };
    });
  }, [totals]);

  return (
    <div className="space-y-6">
      {/* Period selector */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <div className="text-xs uppercase tracking-wider text-muted-foreground font-medium">Período de fechamento</div>
          <h1 className="text-2xl sm:text-3xl font-semibold mt-1">{period.label}</h1>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setPeriod((p) => shiftPeriod(p.start, -1))}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={() => setPeriod(getPeriodForDate(new Date()))}>
            <CalendarDays className="h-4 w-4 mr-2" /> Atual
          </Button>
          <Button variant="outline" size="sm" onClick={() => setPeriod((p) => shiftPeriod(p.start, 1))}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <div className="ml-2 hidden md:flex items-center gap-2">
            <Button size="sm" variant="secondary" onClick={() => exportXLSX({ periodStart: period.start, periodEnd: period.end, entries, totals })}>
              <FileSpreadsheet className="h-4 w-4 mr-2" /> Excel
            </Button>
            <Button size="sm" onClick={() => exportPDF({ periodStart: period.start, periodEnd: period.end, entries, totals })}>
              <FileText className="h-4 w-4 mr-2" /> PDF
            </Button>
          </div>
        </div>
      </div>

      {/* Mobile export */}
      <div className="flex md:hidden gap-2">
        <Button size="sm" variant="secondary" className="flex-1" onClick={() => exportXLSX({ periodStart: period.start, periodEnd: period.end, entries, totals })}>
          <FileSpreadsheet className="h-4 w-4 mr-2" /> Excel
        </Button>
        <Button size="sm" className="flex-1" onClick={() => exportPDF({ periodStart: period.start, periodEnd: period.end, entries, totals })}>
          <FileText className="h-4 w-4 mr-2" /> PDF
        </Button>
      </div>

      {/* Progress KPI */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="shadow-card">
          <CardHeader className="pb-2">
            <CardDescription>Progresso do período</CardDescription>
            <CardTitle className="text-3xl">
              {totals.filledDays}<span className="text-lg text-muted-foreground"> / {days.length} dias</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-2 w-full rounded-full bg-secondary overflow-hidden">
              <div className="h-full bg-gradient-primary transition-all" style={{ width: `${progress}%` }} />
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              {totals.remainingDays > 0
                ? `Faltam ${totals.remainingDays} dias para o fechamento`
                : "Período completo"}
            </p>
          </CardContent>
        </Card>

        <Card className="shadow-card">
          <CardHeader className="pb-2">
            <CardDescription>Realizado até o momento</CardDescription>
            <CardTitle className="text-3xl flex items-baseline gap-2">
              <CheckCircle2 className="h-6 w-6 text-success inline" />
              {fmtNumber(catTotals.reduce((a, c) => a + c.sum, 0))}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            Soma de todas as categorias acumuladas no período
          </CardContent>
        </Card>

        <Card className="shadow-card border-primary/20 bg-gradient-subtle">
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1.5">
              <TrendingUp className="h-3.5 w-3.5" /> Previsão de fechamento
            </CardDescription>
            <CardTitle className="text-3xl text-primary">
              {fmtNumber(catTotals.reduce((a, c) => a + c.fc, 0))}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            Baseado na média diária × dias restantes
          </CardContent>
        </Card>
      </div>

      {/* Category cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {catTotals.map((c) => (
          <Card key={c.cat} className="shadow-card">
            <CardHeader className="pb-2">
              <CardDescription className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">
                {c.cat}
              </CardDescription>
              <CardTitle className="text-2xl">
                {fmtNumber(c.sum)} <span className="text-xs font-normal text-muted-foreground">{c.unit}</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Previsão</span>
                <span className="font-semibold text-primary">{fmtNumber(c.fc)} {c.unit !== "MISTO" && c.unit}</span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Per-service breakdown */}
      <Card className="shadow-card overflow-hidden">
        <CardHeader>
          <CardTitle className="text-lg">Detalhamento por serviço</CardTitle>
          <CardDescription>Realizado, média diária e previsão de fechamento por item contratual</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/60 text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="text-left px-4 py-3 font-medium">Serviço</th>
                  <th className="text-left px-4 py-3 font-medium">Área</th>
                  <th className="text-center px-4 py-3 font-medium">Unid.</th>
                  <th className="text-right px-4 py-3 font-medium">Realizado</th>
                  <th className="text-right px-4 py-3 font-medium">Média/dia</th>
                  <th className="text-right px-4 py-3 font-medium">Previsão</th>
                </tr>
              </thead>
              <tbody>
                {SERVICES.map((s) => (
                  <tr key={s.key} className="border-t hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3">
                      <div className="font-medium text-sm">{s.number}. {s.short}</div>
                      <div className="text-xs text-muted-foreground line-clamp-1">{s.description}</div>
                    </td>
                    <td className="px-4 py-3 text-xs">{s.area}</td>
                    <td className="px-4 py-3 text-center text-xs font-medium">{s.unit}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{fmtNumber(totals.totals[s.key])}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">
                      {fmtNumber(totals.averages[s.key], 1)}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums font-semibold text-primary">
                      {fmtNumber(totals.forecast[s.key])}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {busy && <div className="text-xs text-muted-foreground text-center">Carregando dados...</div>}
    </div>
  );
}
