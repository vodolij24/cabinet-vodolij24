export const FINANCE_PERIOD_PRESETS = [
  { value: "last_7_days", label: "Останні 7 днів" },
  { value: "current_month", label: "Поточний місяць" },
  { value: "previous_month", label: "Попередній місяць" },
  { value: "last_2_months", label: "Останні 2 місяці" },
  { value: "quarter", label: "Квартал" },
  { value: "year", label: "Рік" },
  { value: "custom", label: "Довільний період" },
] as const;

export type FinancePeriodPreset =
  (typeof FINANCE_PERIOD_PRESETS)[number]["value"];

export function isFinancePeriodPreset(
  value: unknown
): value is FinancePeriodPreset {
  return (
    typeof value === "string" &&
    FINANCE_PERIOD_PRESETS.some((p) => p.value === value)
  );
}

/** Константи формули ЗП (без server-залежностей). */
export const BASE_RATE_PER_MACHINE = 300;
export const PERFORMANCE_RATE = 0.07;
