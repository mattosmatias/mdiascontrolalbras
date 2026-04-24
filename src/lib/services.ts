export type ServiceUnit = "PILHA" | "TON";
export type ServiceArea = "FUNDIÇÃO" | "CONTROLADORIA";
export type ServiceCategory =
  | "CINTAGEM POR PILHA"
  | "MOVIMENTAÇÃO"
  | "MOVIMENTAÇÃO EVENTUAL"
  | "EXPORTAÇÃO";

export interface ServiceDef {
  key:
    | "s2_embalagem_pet"
    | "s4_cintagem_metalica"
    | "s1_mov_lingoteiras"
    | "s3_mov_toplifting"
    | "s5_mov_estocagem"
    | "s6_transp_carreta_adm"
    | "s7_transp_carreta_fora"
    | "s9_mov_toplifting_estoq"
    | "s10_mov_nao_conforme"
    | "s8_transp_porto";
  number: number;
  short: string;
  description: string;
  unit: ServiceUnit;
  area: ServiceArea;
  category: ServiceCategory;
}

export const SERVICES: ServiceDef[] = [
  { key: "s2_embalagem_pet", number: 2, short: "Embalagem PET", description: "Embalagem de Pilhas de Alumínio - PET (24h)", unit: "PILHA", area: "FUNDIÇÃO", category: "CINTAGEM POR PILHA" },
  { key: "s4_cintagem_metalica", number: 4, short: "Cintagem Metálica", description: "Cintagem Top Lifting - Fita Metálica (24h)", unit: "PILHA", area: "FUNDIÇÃO", category: "CINTAGEM POR PILHA" },
  { key: "s1_mov_lingoteiras", number: 1, short: "Mov. Lingoteiras → Pátio Interm.", description: "Movimentação de Pilha das Lingoteiras para Estocagem no Pátio Intermediário (24h)", unit: "TON", area: "FUNDIÇÃO", category: "MOVIMENTAÇÃO" },
  { key: "s3_mov_toplifting", number: 3, short: "Mov. Pátio Interm. → Top Lifting → Estocagem", description: "Movimentação de Pilha do Pátio Intermediário até o Top Lifting e do Top Lifting para o Pátio de Estocagem (24h)", unit: "TON", area: "FUNDIÇÃO", category: "MOVIMENTAÇÃO" },
  { key: "s5_mov_estocagem", number: 5, short: "Mov. Pátio Interm. → Estocagem", description: "Movimentação de Pilha de Alumínio do Pátio Intermediário para o Pátio de Estocagem (24h)", unit: "TON", area: "CONTROLADORIA", category: "MOVIMENTAÇÃO" },
  { key: "s6_transp_carreta_adm", number: 6, short: "Transp. Estocagem → Carreta (ADM)", description: "Transporte de Pilhas de Alumínio do Pátio de Estocagem para a Carreta (ADM)", unit: "TON", area: "CONTROLADORIA", category: "MOVIMENTAÇÃO EVENTUAL" },
  { key: "s7_transp_carreta_fora", number: 7, short: "Transp. Estocagem → Carreta (FORA ADM)", description: "Transporte de Pilhas de Alumínio do Pátio de Estocagem para a Carreta (FORA ADM)", unit: "TON", area: "CONTROLADORIA", category: "MOVIMENTAÇÃO EVENTUAL" },
  { key: "s9_mov_toplifting_estoq", number: 9, short: "Mov. Estocagem → Top Lifting", description: "Movimentação de Pilhas do Pátio de Estocagem para o Top Lifting (24h)", unit: "TON", area: "FUNDIÇÃO", category: "MOVIMENTAÇÃO EVENTUAL" },
  { key: "s10_mov_nao_conforme", number: 10, short: "Mov. Estocagem → Pátio Não Conforme", description: "Movimentação de Pilhas do Pátio de Estocagem para o Pátio Intermediário de produtos não conforme (24h)", unit: "TON", area: "FUNDIÇÃO", category: "MOVIMENTAÇÃO EVENTUAL" },
  { key: "s8_transp_porto", number: 8, short: "Transp. Estocagem → Porto Vila do Conde", description: "Transporte de Pilhas de Alumínio do Pátio de Estocagem para o Porto de Vila do Conde (24h)", unit: "TON", area: "CONTROLADORIA", category: "EXPORTAÇÃO" },
];

export const SERVICES_BY_CATEGORY: Record<ServiceCategory, ServiceDef[]> = SERVICES.reduce(
  (acc, s) => {
    (acc[s.category] ||= []).push(s);
    return acc;
  },
  {} as Record<ServiceCategory, ServiceDef[]>,
);

/** Period runs from day 16 to day 15 of the next month. */
export function getPeriodForDate(date: Date): { start: Date; end: Date; label: string } {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  let startYear = d.getFullYear();
  let startMonth = d.getMonth();
  if (d.getDate() < 16) {
    startMonth -= 1;
    if (startMonth < 0) {
      startMonth = 11;
      startYear -= 1;
    }
  }
  const start = new Date(startYear, startMonth, 16);
  const end = new Date(startYear, startMonth + 1, 15);
  const label = `${formatDateBR(start)} a ${formatDateBR(end)}`;
  return { start, end, label };
}

export function shiftPeriod(start: Date, months: number): { start: Date; end: Date; label: string } {
  const ns = new Date(start.getFullYear(), start.getMonth() + months, 16);
  return getPeriodForDate(ns);
}

export function formatDateBR(d: Date): string {
  return d.toLocaleDateString("pt-BR");
}

export function formatISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function eachDayInPeriod(start: Date, end: Date): Date[] {
  const days: Date[] = [];
  const cursor = new Date(start);
  while (cursor <= end) {
    days.push(new Date(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return days;
}

export function dayOfWeekBR(d: Date): string {
  return ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"][d.getDay()];
}

export function fmtNumber(n: number, decimals = 0): string {
  if (!Number.isFinite(n)) return "—";
  return n.toLocaleString("pt-BR", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}
