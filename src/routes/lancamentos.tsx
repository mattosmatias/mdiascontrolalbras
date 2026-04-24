import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { CalendarIcon, Loader2, Save } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { z } from "zod";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { SERVICES_BY_CATEGORY, dayOfWeekBR, formatISODate, getPeriodForDate, type ServiceDef } from "@/lib/services";
import { fetchEntryByDate } from "@/lib/entries";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export const Route = createFileRoute("/lancamentos")({
  head: () => ({
    meta: [
      { title: "Lançamento Diário — Controle Albras" },
      { name: "description", content: "Inserção de dados diários do contrato CTR 4600009749." },
    ],
  }),
  component: () => (
    <AppShell>
      <LancamentosPage />
    </AppShell>
  ),
});

const numberField = z
  .string()
  .trim()
  .refine((v) => v === "" || !Number.isNaN(Number(v)), "Número inválido")
  .refine((v) => v === "" || Number(v) >= 0, "Não pode ser negativo")
  .refine((v) => v === "" || Number(v) < 1_000_000, "Valor muito alto");

function LancamentosPage() {
  const { canEdit } = useAuth();
  const [date, setDate] = useState<Date>(new Date());
  const [values, setValues] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [existingId, setExistingId] = useState<string | null>(null);

  const period = useMemo(() => getPeriodForDate(date), [date]);

  useEffect(() => {
    let cancel = false;
    setLoading(true);
    fetchEntryByDate(date)
      .then((e) => {
        if (cancel) return;
        if (e) {
          setExistingId(e.id);
          const v: Record<string, string> = {};
          for (const cat of Object.values(SERVICES_BY_CATEGORY)) {
            for (const s of cat) v[s.key] = String(e[s.key] ?? 0);
          }
          setValues(v);
          setNotes(e.notes ?? "");
        } else {
          setExistingId(null);
          setValues({});
          setNotes("");
        }
      })
      .catch((err) => toast.error(err.message))
      .finally(() => !cancel && setLoading(false));
    return () => {
      cancel = true;
    };
  }, [date]);

  function setVal(key: string, v: string) {
    setValues((prev) => ({ ...prev, [key]: v }));
  }

  async function handleSave() {
    if (!canEdit) return toast.error("Você não tem permissão para editar.");
    // validate
    const payload: Record<string, number> = {};
    for (const cat of Object.values(SERVICES_BY_CATEGORY)) {
      for (const s of cat) {
        const raw = values[s.key] ?? "";
        const parsed = numberField.safeParse(raw);
        if (!parsed.success) return toast.error(`${s.short}: ${parsed.error.issues[0].message}`);
        payload[s.key] = raw === "" ? 0 : Number(raw);
      }
    }
    if (notes.length > 1000) return toast.error("Observações muito longas (máx. 1000).");

    setSaving(true);
    const userId = (await supabase.auth.getUser()).data.user?.id;
    const { error } = await supabase
      .from("daily_entries")
      .upsert(
        {
          entry_date: formatISODate(date),
          ...payload,
          notes: notes.trim() || null,
          created_by: userId,
        },
        { onConflict: "entry_date" },
      );
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success(existingId ? "Lançamento atualizado" : "Lançamento salvo");
    // refresh id
    const e = await fetchEntryByDate(date);
    setExistingId(e?.id ?? null);
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div>
        <h1 className="text-2xl sm:text-3xl font-semibold">Lançamento diário</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Período em curso: <strong>{period.label}</strong>
        </p>
      </div>

      <Card className="shadow-card">
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
            <div className="space-y-2">
              <Label>Data do lançamento</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("w-[260px] justify-start text-left font-normal", !date && "text-muted-foreground")}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {date ? format(date, "PPP", { locale: ptBR }) : "Selecionar data"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={date}
                    onSelect={(d) => d && setDate(d)}
                    initialFocus
                    locale={ptBR}
                    className={cn("p-3 pointer-events-auto")}
                  />
                </PopoverContent>
              </Popover>
              <p className="text-xs text-muted-foreground">{dayOfWeekBR(date)}</p>
            </div>
            <div className="flex items-center gap-2">
              {existingId ? (
                <Badge variant="secondary" className="bg-success/10 text-success border-success/20">
                  Já existe lançamento — editar
                </Badge>
              ) : (
                <Badge variant="outline">Novo lançamento</Badge>
              )}
            </div>
          </div>
        </CardHeader>
      </Card>

      {loading ? (
        <div className="text-center text-sm text-muted-foreground py-8">
          <Loader2 className="h-5 w-5 animate-spin inline mr-2" /> Carregando...
        </div>
      ) : (
        <>
          {(Object.keys(SERVICES_BY_CATEGORY) as Array<keyof typeof SERVICES_BY_CATEGORY>).map((cat) => (
            <Card key={cat} className="shadow-card">
              <CardHeader className="pb-4">
                <CardTitle className="text-sm uppercase tracking-wider text-primary">{cat}</CardTitle>
                <CardDescription>
                  {SERVICES_BY_CATEGORY[cat][0].unit === "PILHA"
                    ? "Quantidade de pilhas"
                    : "Toneladas movimentadas"}
                </CardDescription>
              </CardHeader>
              <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {SERVICES_BY_CATEGORY[cat].map((s) => (
                  <ServiceField key={s.key} service={s} value={values[s.key] ?? ""} onChange={(v) => setVal(s.key, v)} disabled={!canEdit} />
                ))}
              </CardContent>
            </Card>
          ))}

          <Card className="shadow-card">
            <CardHeader>
              <CardTitle className="text-sm">Observações (opcional)</CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                maxLength={1000}
                placeholder="Notas sobre o turno, paradas, ocorrências..."
                disabled={!canEdit}
              />
              <p className="text-xs text-muted-foreground mt-1 text-right">{notes.length}/1000</p>
            </CardContent>
          </Card>

          <div className="sticky bottom-4 z-10 flex justify-end">
            <Button size="lg" onClick={handleSave} disabled={saving || !canEdit} className="shadow-elegant">
              {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
              {existingId ? "Atualizar lançamento" : "Salvar lançamento"}
            </Button>
          </div>

          {!canEdit && (
            <p className="text-center text-sm text-muted-foreground">
              Seu papel atual permite apenas visualização. Solicite a um administrador para editar.
            </p>
          )}
        </>
      )}
    </div>
  );
}

function ServiceField({
  service,
  value,
  onChange,
  disabled,
}: {
  service: ServiceDef;
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs flex items-baseline gap-2">
        <span className="font-mono text-muted-foreground">#{service.number}</span>
        <span className="font-medium">{service.short}</span>
        <span className="ml-auto text-[10px] text-muted-foreground">{service.area}</span>
      </Label>
      <div className="relative">
        <Input
          type="number"
          inputMode="decimal"
          step="0.01"
          min="0"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="0"
          disabled={disabled}
          className="pr-16 tabular-nums"
        />
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground font-medium">
          {service.unit}
        </span>
      </div>
    </div>
  );
}
