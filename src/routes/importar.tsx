import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import * as XLSX from "xlsx";
import { Loader2, Upload, FileSpreadsheet, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { SERVICES } from "@/lib/services";
import { HOURS } from "@/lib/hours";

export const Route = createFileRoute("/importar")({
  head: () => ({ meta: [{ title: "Importar Excel — Controle Albras" }] }),
  component: () => (<AppShell><ImportPage /></AppShell>),
});

// Excel serial date -> JS Date (yyyy-mm-dd string)
function excelDateToISO(v: unknown): string | null {
  if (v == null || v === "") return null;
  if (v instanceof Date) {
    const y = v.getFullYear(); const m = String(v.getMonth() + 1).padStart(2, "0"); const d = String(v.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
  if (typeof v === "number") {
    // Excel epoch
    const d = XLSX.SSF.parse_date_code(v);
    if (!d) return null;
    return `${d.y}-${String(d.m).padStart(2, "0")}-${String(d.d).padStart(2, "0")}`;
  }
  if (typeof v === "string") {
    // try dd/mm/yyyy
    const m = v.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
    if (m) {
      const yy = m[3].length === 2 ? `20${m[3]}` : m[3];
      return `${yy}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
    }
    if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
  }
  return null;
}

// Map of Excel-sheet column index (0-based) -> service key, in the exact column order of the original spreadsheet
const PROD_COLS: Array<{ idx: number; key: typeof SERVICES[number]["key"] }> = [
  { idx: 2,  key: "s2_embalagem_pet" },
  { idx: 3,  key: "s4_cintagem_metalica" },
  { idx: 4,  key: "s1_mov_lingoteiras" },
  { idx: 5,  key: "s3_mov_toplifting" },
  { idx: 6,  key: "s5_mov_estocagem" },
  { idx: 7,  key: "s6_transp_carreta_adm" },
  { idx: 8,  key: "s7_transp_carreta_fora" },
  { idx: 9,  key: "s9_mov_toplifting_estoq" },
  { idx: 10, key: "s10_mov_nao_conforme" },
  { idx: 11, key: "s8_transp_porto" },
];

// Hours sheet: col 1 = Data, col 2 = Dia, then 16 hour columns starting at index 3
const HOURS_START_COL = 3;

function num(v: unknown): number {
  if (v == null || v === "") return 0;
  const n = typeof v === "number" ? v : Number(String(v).replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

function ImportPage() {
  const { canEdit } = useAuth();
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [report, setReport] = useState<{ entries: number; hours: number; errors: string[] } | null>(null);

  async function handleImport() {
    if (!file) return;
    if (!canEdit) return toast.error("Sem permissão para importar.");
    setBusy(true);
    setReport(null);
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { cellDates: true });
      const errors: string[] = [];
      const userId = (await supabase.auth.getUser()).data.user?.id;

      // ---- Production sheet ----
      const prodSheetName = wb.SheetNames.find((n) => /produ/i.test(n) && /mensal/i.test(n));
      const entriesPayload: Record<string, unknown>[] = [];
      if (prodSheetName) {
        const ws = wb.Sheets[prodSheetName];
        const rows: unknown[][] = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: null });
        // Data rows start where col A is a date (skipping header rows)
        for (let i = 0; i < rows.length; i++) {
          const r = rows[i] || [];
          const iso = excelDateToISO(r[0]);
          if (!iso) continue;
          const row: Record<string, unknown> = { entry_date: iso, created_by: userId };
          let any = false;
          for (const c of PROD_COLS) {
            const v = num(r[c.idx]);
            row[c.key] = v;
            if (v > 0) any = true;
          }
          if (any || rows[i].some((x) => x != null && x !== "")) entriesPayload.push(row);
        }
      } else {
        errors.push("Aba 'RELATÓRIO DE PRODUÇÃO MENSAL' não encontrada.");
      }

      // ---- Hours sheet ----
      const hoursSheetName = wb.SheetNames.find((n) => /horas/i.test(n));
      const hoursPayload: Record<string, unknown>[] = [];
      if (hoursSheetName) {
        const ws = wb.Sheets[hoursSheetName];
        const rows: unknown[][] = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: null });
        for (let i = 0; i < rows.length; i++) {
          const r = rows[i] || [];
          const iso = excelDateToISO(r[1]); // col B = Data
          if (!iso) continue;
          const row: Record<string, unknown> = { entry_date: iso, created_by: userId };
          for (let j = 0; j < HOURS.length; j++) row[HOURS[j].key] = num(r[HOURS_START_COL + j]);
          hoursPayload.push(row);
        }
      } else {
        errors.push("Aba 'RELATÓRIO DE HORAS M.O.' não encontrada.");
      }

      // ---- Upserts ----
      let importedEntries = 0; let importedHours = 0;
      if (entriesPayload.length) {
        const { error } = await supabase.from("daily_entries").upsert(entriesPayload as never, { onConflict: "entry_date" });
        if (error) errors.push(`Produção: ${error.message}`);
        else importedEntries = entriesPayload.length;
      }
      if (hoursPayload.length) {
        const { error } = await supabase.from("daily_hours").upsert(hoursPayload as never, { onConflict: "entry_date" });
        if (error) errors.push(`Horas: ${error.message}`);
        else importedHours = hoursPayload.length;
      }

      setReport({ entries: importedEntries, hours: importedHours, errors });
      if (errors.length === 0) toast.success(`Importação concluída: ${importedEntries} dias de produção, ${importedHours} dias de horas.`);
      else toast.warning("Importação parcial — verifique os avisos.");
    } catch (e) {
      toast.error("Erro ao ler arquivo: " + (e instanceof Error ? e.message : String(e)));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <div>
        <h1 className="text-2xl sm:text-3xl font-semibold">Importar planilha Excel</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Selecione o arquivo .xlsx original do Controle Diário Albras. As abas <strong>RELATÓRIO DE PRODUÇÃO MENSAL</strong> e <strong>RELATÓRIO DE HORAS M.O.</strong> serão importadas automaticamente.
        </p>
      </div>

      <Card className="shadow-card">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><FileSpreadsheet className="h-5 w-5 text-primary" />Arquivo Excel</CardTitle>
          <CardDescription>Linhas existentes com a mesma data serão atualizadas (upsert).</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Input type="file" accept=".xlsx,.xls" onChange={(e) => { setFile(e.target.files?.[0] ?? null); setReport(null); }} disabled={!canEdit || busy} />
          <Button onClick={handleImport} disabled={!file || busy || !canEdit} className="w-full sm:w-auto">
            {busy ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
            Importar
          </Button>
          {!canEdit && <p className="text-xs text-muted-foreground">Apenas administradores e operadores podem importar.</p>}
        </CardContent>
      </Card>

      {report && (
        <Card className="shadow-card">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2 text-success"><CheckCircle2 className="h-5 w-5" />Resultado da importação</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p>Produção: <strong>{report.entries}</strong> dia(s) importado(s).</p>
            <p>Horas: <strong>{report.hours}</strong> dia(s) importado(s).</p>
            {report.errors.length > 0 && (
              <div className="mt-3 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-xs">
                <p className="font-semibold text-destructive mb-1">Avisos:</p>
                <ul className="list-disc list-inside space-y-1">
                  {report.errors.map((e, i) => <li key={i}>{e}</li>)}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
