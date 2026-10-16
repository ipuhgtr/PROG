// Formatação pt-BR no fuso America/Bahia (UTC-3).

const FUSO = "America/Bahia";

const fmtDataHora = new Intl.DateTimeFormat("pt-BR", {
  timeZone: FUSO,
  day: "2-digit",
  month: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});

const fmtHora = new Intl.DateTimeFormat("pt-BR", {
  timeZone: FUSO,
  hour: "2-digit",
  minute: "2-digit",
});

const fmtData = new Intl.DateTimeFormat("pt-BR", {
  timeZone: FUSO,
  day: "2-digit",
  month: "2-digit",
});

/** "15/10 21:36" — aceita ISO com offset ou Date. */
export function dataHora(valor: string | Date | null | undefined): string {
  if (!valor) return "—";
  const d = typeof valor === "string" ? new Date(valor) : valor;
  if (isNaN(d.getTime())) return "—";
  return fmtDataHora.format(d).replace(",", "");
}

export function hora(valor: string | Date | null | undefined): string {
  if (!valor) return "—";
  const d = typeof valor === "string" ? new Date(valor) : valor;
  if (isNaN(d.getTime())) return "—";
  return fmtHora.format(d);
}

export function dataCurta(valor: string | Date | null | undefined): string {
  if (!valor) return "—";
  const d = typeof valor === "string" ? new Date(valor) : valor;
  if (isNaN(d.getTime())) return "—";
  return fmtData.format(d);
}

/** Hoje em America/Bahia como dd/MM/yyyy (para formulários). */
export function hojeTexto(): string {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: FUSO,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date());
}

/** Hoje em America/Bahia como yyyy-MM-dd (valor de input date). */
export function hojeISO(): string {
  const partes = new Intl.DateTimeFormat("pt-BR", {
    timeZone: FUSO,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).formatToParts(new Date());
  const p = Object.fromEntries(partes.map((x) => [x.type, x.value]));
  return `${p["year"]}-${p["month"]}-${p["day"]}`;
}

const fmtNum = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 });

/** 3100 → "3.100" */
export function numero(n: number | null | undefined): string {
  if (n == null || isNaN(n)) return "—";
  return fmtNum.format(n);
}

/** Turnos (America/Bahia): A 06–14, B 14–22, C 22–06. Ajuste aqui se a fábrica usar outro horário. */
function horaBahia(d: Date): number {
  return Number(new Intl.DateTimeFormat("en-GB", { timeZone: FUSO, hour: "2-digit", hourCycle: "h23" }).format(d));
}

export function turnoAtual(agora = new Date()): "A" | "B" | "C" {
  const h = horaBahia(agora);
  return h >= 6 && h < 14 ? "A" : h >= 14 && h < 22 ? "B" : "C";
}

/** Momento em que termina o turno atual. */
export function fimTurnoAtual(agora = new Date()): Date {
  const h = horaBahia(agora);
  const fimHora = h >= 6 && h < 14 ? 14 : h >= 14 && h < 22 ? 22 : 6;
  let horas = (fimHora - h + 24) % 24;
  if (horas === 0) horas = 24;
  const d = new Date(agora);
  d.setMinutes(0, 0, 0);
  d.setTime(d.getTime() + horas * 3600_000);
  return d;
}

/** Fim de hoje (meia-noite) em America/Bahia. */
export function fimDeHoje(agora = new Date()): Date {
  const h = horaBahia(agora);
  const d = new Date(agora);
  d.setMinutes(0, 0, 0);
  d.setTime(d.getTime() + (24 - h) * 3600_000);
  return d;
}

/** Turno normalizado: 1→A, 2→B, 3→C. */
export function turnoLetra(t: string | number | null | undefined): string {
  const s = String(t ?? "").trim().toUpperCase();
  return s === "1" ? "A" : s === "2" ? "B" : s === "3" ? "C" : s;
}

/** "2026-10-15T21:30:00-03:00" a partir de input datetime-local (horário da Bahia). */
export function localParaISO(valor: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(valor)) return null;
  return `${valor}:00-03:00`;
}
