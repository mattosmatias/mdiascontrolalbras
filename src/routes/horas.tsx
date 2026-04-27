import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { CalendarIcon, ChevronLeft, ChevronRight, Loader2, Save } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { dayOfWeekBR, eachDayInPeriod, fmtNumber, formatDateBR, formatISODate, getPeriodForDate, shiftPeriod } from "@/lib/services";
import { HOURS, HOURS_BY_GROUP, computeHoursTotals, fetchHoursByDate, fetchHoursInRange, type DailyHours } from "@/lib/hours";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export const Route = createFileRoute("/horas")({
  head: () => ({ meta: [{ title: "Horas M.O. — Controle Albras" }] }),
  component: () => (<AppShell><HorasPage /></AppShell>),
});

function HorasPage() {
  const { canEdit } = useAuth();
  const [date, setDate] = useState<Date>(new Date());
  const [values, setValues] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [existingId, setExistingId] = useState<string | null>(null);
  const period = useMemo(() => getPeriodForDate(date), [date]);

  useEffect(() => {
    let cancel = false;
    setLoading(true);
    fetchHoursByDate(date).then((e) => {
      if (cancel) return;
      if (e) {
        setExistingId(e.id);
        const v: Record<string, string> = {};
        for (const h of HOURS) v[h.key] = String(e[h.key] ?? 0);
        setValues(v);
      } else { setExistingId(null); setValues({}); }
    }).catch((err) => toast.error(err.message)).finally(() => !cancel && setLoading(false));
    return () => { cancel = true; };
  }, [date]);

  async function handleSave() {
    if (!canEdit) return toast.error("Sem permissão.");
    const payload: Record<string, number> = {};
    for (const h of HOURS) {
      const raw = values[h.key] ?? "";
      const n = raw === "" ? 0 : Number(raw);
      if (!Number.isFinite(n) || n < 0 || n >= 1_000_000) return toast.error(`${h.short}: valor inválido`);
      payload[h.key] = n;
    }
    setSaving(true);
    const userId = (await supabase.auth.getUser()).data.user?.id;
    const { error } = await supabase.from("daily_hours").upsert(
      { entry_date: formatISODate(date), ...payload, created_by: userId },
      { onConflict: "entry_date" },
    );
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success(existingId ? "Horas atualizadas" : "Horas salvas");
    const e = await fetchHoursByDate(date);
    setExistingId(e?.id ?? null);
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div>
        <h1 className="text-2xl sm:text-3xl font-semibold">Horas de mão de obra</h1>
        <p className="text-sm text-muted-foreground mt-1">Período: <strong>{period.label}</strong></p>
      </div>

      <Card className="shadow-card">
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
            <div className="space-y-2">
              <Label>Data</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("w-[260px] justify-start text-left font-normal", !date && "text-muted-foreground")}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {date ? format(date, "PPP", { locale: ptBR }) : "Selecionar"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={date} onSelect={(d) => d && setDate(d)} initialFocus locale={ptBR} className="p-3 pointer-events-auto" />
                </PopoverContent>
              </Popover>
              <p className="text-xs text-muted-foreground">{dayOfWeekBR(date)}</p>
            </div>
            {existingId
              ? <Badge variant="secondary" className="bg-success/10 text-success border-success/20">Já existe — editar</Badge>
              : <Badge variant="outline">Novo lançamento</Badge>}
          </div>
        </CardHeader>
      </Card>

      {loading ? (
        <div className="text-center text-sm text-muted-foreground py-8">
          <Loader2 className="h-5 w-5 animate-spin inline mr-2" />Carregando...
        </div>
      ) : (
        <>
          {(Object.keys(HOURS_BY_GROUP) as Array<keyof typeof HOURS_BY_GROUP>).map((g) => (
            <Card key={g} className="shadow-card">
              <CardHeader className="pb-4">
                <CardTitle className="text-sm uppercase tracking-wider text-primary">{g} (HH)</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {HOURS_BY_GROUP[g].map((h) => (
                  <div key={h.key} className="space-y-1.5">
                    <Label className="text-xs font-medium">{h.short}</Label>
                    <div className="relative">
                      <Input type="number" inputMode="decimal" step="0.5" min="0"
                        value={values[h.key] ?? ""}
                        onChange={(e) => setValues((p) => ({ ...p, [h.key]: e.target.value }))}
                        placeholder="0" disabled={!canEdit} className="pr-12 tabular-nums" />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground font-medium">HH</span>
                    </div>
                    <p className="text-[10px] text-muted-foreground line-clamp-1">{h.label}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
          ))}

          <div className="sticky bottom-4 z-10 flex justify-end">
            <Button size="lg" onClick={handleSave} disabled={saving || !canEdit} className="shadow-elegant">
              {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
              {existingId ? "Atualizar" : "Salvar"}
            </Button>
          </div>

          <MonthlyHoursReport currentDate={date} />
        </>
      )}
    </div>
  );
}

function MonthlyHoursReport({ currentDate }: { currentDate: Date }) {
  const [period, setPeriod] = useState(() => getPeriodForDate(currentDate));
  const [rows, setRows] = useState<DailyHours[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancel = false;
    setLoading(true);
    fetchHoursInRange(period.start, period.end)
      .then((d) => !cancel && setRows(d))
      .catch((e) => toast.error(e.message))
      .finally(() => !cancel && setLoading(false));
    return () => { cancel = true; };
  }, [period]);

  const days = useMemo(() => eachDayInPeriod(period.start, period.end), [period]);
  const totals = useMemo(() => computeHoursTotals(rows), [rows]);
  const todayISO = formatISODate(new Date());

  return (
    <div className="space-y-3 pt-4">
      <div className="flex items-center justify-between print:hidden">
        <div>
          <div className="text-xs uppercase tracking-wider text-muted-foreground">Contrato CTR 4600009749</div>
          <h2 className="text-lg font-semibold">Relatório de Horas M.O. — Mensal</h2>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setPeriod((p) => shiftPeriod(p.start, -1))}><ChevronLeft className="h-4 w-4" /></Button>
          <Button variant="outline" size="sm" onClick={() => setPeriod(getPeriodForDate(new Date()))}>Atual</Button>
          <Button variant="outline" size="sm" onClick={() => setPeriod((p) => shiftPeriod(p.start, 1))}><ChevronRight className="h-4 w-4" /></Button>
        </div>
      </div>

      {loading ? (
        <div className="text-center text-sm text-muted-foreground py-8"><Loader2 className="h-5 w-5 animate-spin inline mr-2" />Carregando...</div>
      ) : (
        <div className="sheet-wrapper">
          <table className="sheet">
            <caption>Relatório de Horas M.O. — {period.label}</caption>
            <thead>
              <tr>
                <th rowSpan={2} style={{ minWidth: 90 }}>Data</th>
                <th rowSpan={2} style={{ minWidth: 70 }}>Dia</th>
                {(Object.keys(HOURS_BY_GROUP) as Array<keyof typeof HOURS_BY_GROUP>).map((g) => (
                  <th key={g} colSpan={HOURS_BY_GROUP[g].length}>{g}</th>
                ))}
              </tr>
              <tr>
                {HOURS.map((h) => (
                  <th key={h.key} className="sub" title={h.label}>
                    <div className="text-[10px] font-normal normal-case">{h.short}</div>
                    <div className="text-[9px] font-normal opacity-80">(HH)</div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {days.map((d) => {
                const iso = formatISODate(d);
                const r = rows.find((x) => x.entry_date === iso);
                const dow = d.getDay();
                const isWeekend = dow === 0 || dow === 6;
                const isToday = iso === todayISO;
                return (
                  <tr key={iso} className={`${isToday ? "today" : ""} ${isWeekend ? "weekend" : ""}`}>
                    <td className="label">{formatDateBR(d)}</td>
                    <td className="center text-[10px] text-muted-foreground">{dayOfWeekBR(d)}</td>
                    {HOURS.map((h) => (
                      <td key={h.key} className="num">
                        {r && Number(r[h.key]) > 0 ? fmtNumber(Number(r[h.key]), 1) : <span className="text-muted-foreground/40">—</span>}
                      </td>
                    ))}
                  </tr>
                );
              })}
              <tr className="total">
                <td className="label">TOTAL HH</td>
                <td className="center text-[10px]">período</td>
                {HOURS.map((h) => (
                  <td key={h.key} className="num">{fmtNumber(totals.totals[h.key], 1)}</td>
                ))}
              </tr>
            </tbody>
          </table>
          <div className="sheet-meta">
            <span>Período: {period.label}</span>
            <span>HH = Horas-Homem</span>
          </div>
        </div>
      )}
    </div>
  );
}
