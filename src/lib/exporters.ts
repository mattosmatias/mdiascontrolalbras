import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import { SERVICES, dayOfWeekBR, eachDayInPeriod, fmtNumber, formatDateBR, formatISODate } from "./services";
import type { DailyEntry } from "./entries";
import type { PeriodTotals } from "./entries";

interface ExportInput {
  periodStart: Date;
  periodEnd: Date;
  entries: DailyEntry[];
  totals: PeriodTotals;
}

export function exportPDF({ periodStart, periodEnd, entries, totals }: ExportInput) {
  const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();

  // Header
  doc.setFillColor(15, 27, 61); // navy
  doc.rect(0, 0, pageWidth, 70, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text("CONTROLE DIÁRIO ALBRAS", 40, 32);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text("CTR 4600009749", 40, 50);
  doc.setFontSize(11);
  doc.text(`Período: ${formatDateBR(periodStart)} a ${formatDateBR(periodEnd)}`, pageWidth - 40, 32, { align: "right" });
  doc.text(`Emitido em ${formatDateBR(new Date())}`, pageWidth - 40, 50, { align: "right" });

  // Summary boxes
  doc.setTextColor(20, 20, 20);
  let y = 92;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("Resumo do Período", 40, y);
  y += 8;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(
    `Dias preenchidos: ${totals.filledDays} de ${totals.totalDays}  ·  Dias restantes: ${totals.remainingDays}`,
    40,
    y + 12,
  );

  // Daily table
  const days = eachDayInPeriod(periodStart, periodEnd);
  const head = [
    ["Data", "Dia", ...SERVICES.map((s) => `${s.number}. ${s.short} (${s.unit})`)],
  ];
  const body = days.map((d) => {
    const iso = formatISODate(d);
    const e = entries.find((x) => x.entry_date === iso);
    return [
      formatDateBR(d),
      dayOfWeekBR(d),
      ...SERVICES.map((s) => (e ? fmtNumber(Number(e[s.key])) : "")),
    ];
  });
  // total row
  body.push([
    "TOTAL",
    "",
    ...SERVICES.map((s) => fmtNumber(totals.totals[s.key])),
  ]);
  // forecast row
  body.push([
    "PREVISÃO",
    "",
    ...SERVICES.map((s) => fmtNumber(totals.forecast[s.key])),
  ]);

  autoTable(doc, {
    head,
    body,
    startY: y + 22,
    styles: { fontSize: 7, cellPadding: 3, lineColor: [220, 225, 235], lineWidth: 0.3 },
    headStyles: { fillColor: [30, 58, 95], textColor: 255, fontSize: 7, halign: "center" },
    bodyStyles: { halign: "right" },
    columnStyles: { 0: { halign: "left" }, 1: { halign: "left" } },
    didParseCell: (d) => {
      if (d.section === "body" && d.row.index >= body.length - 2) {
        d.cell.styles.fontStyle = "bold";
        d.cell.styles.fillColor = d.row.index === body.length - 1 ? [232, 237, 243] : [243, 246, 250];
      }
    },
    margin: { left: 30, right: 30 },
  });

  // Footer
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(120);
    doc.text(
      `Página ${i} de ${pageCount}  ·  Albras — Controle Diário CTR 4600009749`,
      pageWidth / 2,
      doc.internal.pageSize.getHeight() - 16,
      { align: "center" },
    );
  }

  doc.save(`Controle_Albras_${formatISODate(periodStart)}_a_${formatISODate(periodEnd)}.pdf`);
}

export function exportXLSX({ periodStart, periodEnd, entries, totals }: ExportInput) {
  const days = eachDayInPeriod(periodStart, periodEnd);
  const headerRow = [
    "Data",
    "Dia da semana",
    ...SERVICES.map((s) => `${s.number}. ${s.short} (${s.unit})`),
  ];
  const rows = days.map((d) => {
    const iso = formatISODate(d);
    const e = entries.find((x) => x.entry_date === iso);
    return [
      formatDateBR(d),
      dayOfWeekBR(d),
      ...SERVICES.map((s) => (e ? Number(e[s.key]) : null)),
    ];
  });
  rows.push(["TOTAL", "", ...SERVICES.map((s) => totals.totals[s.key])]);
  rows.push(["MÉDIA DIÁRIA", "", ...SERVICES.map((s) => Number(totals.averages[s.key].toFixed(2)))]);
  rows.push(["PREVISÃO FECHAMENTO", "", ...SERVICES.map((s) => Number(totals.forecast[s.key].toFixed(2)))]);

  const ws = XLSX.utils.aoa_to_sheet([
    [`CONTROLE DIÁRIO ALBRAS — CTR 4600009749`],
    [`Período: ${formatDateBR(periodStart)} a ${formatDateBR(periodEnd)}`],
    [`Dias preenchidos: ${totals.filledDays}/${totals.totalDays}  ·  Dias restantes: ${totals.remainingDays}`],
    [],
    headerRow,
    ...rows,
  ]);
  ws["!cols"] = [{ wch: 12 }, { wch: 12 }, ...SERVICES.map(() => ({ wch: 18 }))];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Controle Diário");
  XLSX.writeFile(wb, `Controle_Albras_${formatISODate(periodStart)}_a_${formatISODate(periodEnd)}.xlsx`);
}
