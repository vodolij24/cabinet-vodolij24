export const PNL_ROYALTY_RATE = 0.05;

export const PNL_STATIC_DEFAULTS = {
  amortAuto: 17000,
  filterCost: 75000,
  vchasno: 15000,
  salaryCallcenter: 37400,
  salaryTechdir: 33512,
  salaryFinmanager: 15000,
  salaryOlena: 10000,
} as const;

export const PNL_SHEET_KINDS = [
  "kmitBn",
  "pozdnyakovaBn",
  "utilities",
  "taxes",
] as const;

export type PnlSheetKind = (typeof PNL_SHEET_KINDS)[number];

export const PNL_SHEET_LABELS: Record<PnlSheetKind, string> = {
  kmitBn: "Кміть БН",
  pozdnyakovaBn: "Позднякова БН",
  utilities: "Витрати комунальні послуги",
  taxes: "Податки",
};

export const PNL_SHEET_SIGN: Record<PnlSheetKind, "income" | "expense"> = {
  kmitBn: "income",
  pozdnyakovaBn: "income",
  utilities: "expense",
  taxes: "expense",
};

export function isPnlSheetKind(value: unknown): value is PnlSheetKind {
  return (
    typeof value === "string" &&
    (PNL_SHEET_KINDS as readonly string[]).includes(value)
  );
}

export function kyivPeriodKey(date = new Date()): string {
  return date.toLocaleDateString("en-CA", { timeZone: "Europe/Kyiv" }).slice(0, 7);
}

export function shiftPeriodKey(periodKey: string, months: number): string {
  const [y, m] = periodKey.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + months, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function periodKeyLabel(periodKey: string): string {
  const [y, m] = periodKey.split("-").map(Number);
  const raw = new Date(y, m - 1, 1).toLocaleDateString("uk-UA", {
    month: "long",
    year: "numeric",
  });
  return raw.charAt(0).toUpperCase() + raw.slice(1);
}

export function listPnlMonths(now = new Date(), count = 24) {
  const current = kyivPeriodKey(now);
  return Array.from({ length: count }, (_, i) => {
    const value = shiftPeriodKey(current, -i);
    return { value, label: periodKeyLabel(value) };
  });
}
