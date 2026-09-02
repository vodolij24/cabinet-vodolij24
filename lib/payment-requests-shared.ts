import { parseISO, startOfDay } from "date-fns";

import { kyivDateLabel, kyivDayKey } from "@/lib/kyiv-date";

export const PAYMENT_PRIORITIES = [
  { value: "urgent", label: "Терміново" },
  { value: "normal", label: "Звичайно" },
  { value: "low", label: "Низький" },
] as const;

export const PAYMENT_STATUSES = [
  { value: "pending", label: "Очікує" },
  { value: "approved", label: "Погоджено" },
  { value: "paid", label: "Оплачено" },
  { value: "partial", label: "Частково" },
  { value: "cancelled", label: "Скасовано" },
  { value: "overdue", label: "Прострочено" },
] as const;

export const PAYMENT_CATEGORIES = [
  { value: "rent", label: "Оренда" },
  { value: "utilities", label: "Комунальні" },
  { value: "salary", label: "Зарплата" },
  { value: "tax", label: "Податки" },
  { value: "supplier", label: "Постачальник" },
  { value: "other", label: "Інше" },
] as const;

export const PAYMENT_FUND_SOURCES = [
  { value: "cashbox", label: "Каса" },
  { value: "bank", label: "Банк" },
  { value: "collections", label: "Інкасація" },
  { value: "other", label: "Інше" },
] as const;

export type PaymentPriority = (typeof PAYMENT_PRIORITIES)[number]["value"];
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number]["value"];
export type PaymentCategory = (typeof PAYMENT_CATEGORIES)[number]["value"];
export type PaymentFundSource = (typeof PAYMENT_FUND_SOURCES)[number]["value"];

export type PaymentEffectiveStatus = PaymentStatus;

export type PaymentRequestRow = {
  id: number;
  title: string;
  description: string | null;
  amount: number;
  dueDate: Date;
  periodKey: string;
  category: string;
  priority: string;
  status: string;
  fundSource: string | null;
  fundSourceNote: string | null;
  paidAt: Date | null;
  paidAmount: number | null;
  paidByName: string | null;
  paidById: string | null;
  accounted: boolean;
  accountedAt: Date | null;
  accountedByName: string | null;
  authorId: string | null;
  authorName: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type PaymentRequestView = {
  id: number;
  title: string;
  description: string | null;
  amount: number;
  dueDate: string;
  dueDateLabel: string;
  periodKey: string;
  category: string;
  categoryLabel: string;
  priority: string;
  priorityLabel: string;
  status: string;
  statusLabel: string;
  effectiveStatus: PaymentEffectiveStatus;
  effectiveStatusLabel: string;
  fundSource: string | null;
  fundSourceLabel: string;
  fundSourceNote: string | null;
  paidAt: string | null;
  paidAmount: number | null;
  paidByName: string | null;
  accounted: boolean;
  accountedAt: string | null;
  accountedByName: string | null;
  authorName: string;
  createdAt: string;
};

export type PaymentSummary = {
  dueThisWeek: number;
  dueThisWeekAmount: number;
  overdueCount: number;
  overdueAmount: number;
  paidThisMonth: number;
  paidThisMonthAmount: number;
  unaccountedCount: number;
};

export type PaymentDueGroup =
  | "overdue"
  | "today"
  | "week"
  | "later"
  | "paid"
  | "cancelled";

export const PAYMENT_DUE_GROUPS: { value: PaymentDueGroup; label: string }[] = [
  { value: "overdue", label: "Прострочено" },
  { value: "today", label: "Сьогодні" },
  { value: "week", label: "Цей тиждень" },
  { value: "later", label: "Пізніше" },
  { value: "paid", label: "Оплачено" },
  { value: "cancelled", label: "Скасовано" },
];

function labelOf<T extends { value: string; label: string }>(
  list: readonly T[],
  value: string
) {
  return list.find((x) => x.value === value)?.label || value;
}

function addDaysKey(dayKey: string, days: number): string {
  const [y, m, d] = dayKey.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return [
    dt.getUTCFullYear(),
    String(dt.getUTCMonth() + 1).padStart(2, "0"),
    String(dt.getUTCDate()).padStart(2, "0"),
  ].join("-");
}

export function paymentPeriodKey(dueDate: Date): string {
  const key = kyivDayKey(dueDate);
  return key.slice(0, 7);
}

export function parseDueDate(value: unknown): Date | null {
  if (typeof value !== "string" || !value.trim()) return null;
  const parsed = startOfDay(parseISO(value.trim()));
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
}

export function parsePaymentAmount(value: unknown): number | null {
  if (typeof value === "number") {
    if (!Number.isInteger(value) || value <= 0) return null;
    return value;
  }
  if (typeof value === "string") {
    const t = value.trim().replace(/\s/g, "");
    if (!/^\d+$/.test(t)) return null;
    const n = parseInt(t, 10);
    return n > 0 ? n : null;
  }
  return null;
}

export function isPaymentPriority(v: string): v is PaymentPriority {
  return PAYMENT_PRIORITIES.some((p) => p.value === v);
}

export function isPaymentStatus(v: string): v is PaymentStatus {
  return PAYMENT_STATUSES.some((s) => s.value === v);
}

export function isPaymentCategory(v: string): v is PaymentCategory {
  return PAYMENT_CATEGORIES.some((c) => c.value === v);
}

export function isPaymentFundSource(v: string): v is PaymentFundSource {
  return PAYMENT_FUND_SOURCES.some((f) => f.value === v);
}

export function effectivePaymentStatus(
  row: Pick<PaymentRequestRow, "status" | "dueDate">
): PaymentEffectiveStatus {
  if (row.status === "cancelled" || row.status === "paid") {
    return row.status as PaymentEffectiveStatus;
  }
  if (row.status === "partial") {
    return "partial";
  }
  const todayKey = kyivDayKey();
  const dueKey = kyivDayKey(row.dueDate);
  if (
    (row.status === "pending" || row.status === "approved") &&
    dueKey < todayKey
  ) {
    return "overdue";
  }
  return row.status as PaymentEffectiveStatus;
}

export function formatPaymentRequest(row: PaymentRequestRow): PaymentRequestView {
  const effectiveStatus = effectivePaymentStatus(row);
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    amount: row.amount,
    dueDate: kyivDayKey(row.dueDate),
    dueDateLabel: kyivDateLabel(row.dueDate),
    periodKey: row.periodKey,
    category: row.category,
    categoryLabel: labelOf(PAYMENT_CATEGORIES, row.category),
    priority: row.priority,
    priorityLabel: labelOf(PAYMENT_PRIORITIES, row.priority),
    status: row.status,
    statusLabel: labelOf(PAYMENT_STATUSES, row.status),
    effectiveStatus,
    effectiveStatusLabel: labelOf(PAYMENT_STATUSES, effectiveStatus),
    fundSource: row.fundSource,
    fundSourceLabel: row.fundSource
      ? labelOf(PAYMENT_FUND_SOURCES, row.fundSource)
      : "—",
    fundSourceNote: row.fundSourceNote,
    paidAt: row.paidAt ? row.paidAt.toISOString() : null,
    paidAmount: row.paidAmount,
    paidByName: row.paidByName,
    accounted: row.accounted,
    accountedAt: row.accountedAt ? row.accountedAt.toISOString() : null,
    accountedByName: row.accountedByName,
    authorName: row.authorName || "—",
    createdAt: row.createdAt.toISOString(),
  };
}

export function summarizePayments(items: PaymentRequestView[]): PaymentSummary {
  const todayKey = kyivDayKey();
  const monthKey = todayKey.slice(0, 7);
  const weekEndKey = addDaysKey(todayKey, 6);

  let dueThisWeek = 0;
  let dueThisWeekAmount = 0;
  let overdueCount = 0;
  let overdueAmount = 0;
  let paidThisMonth = 0;
  let paidThisMonthAmount = 0;
  let unaccountedCount = 0;

  for (const item of items) {
    const open =
      item.effectiveStatus !== "paid" &&
      item.effectiveStatus !== "cancelled" &&
      item.effectiveStatus !== "partial";

    if (open && item.dueDate >= todayKey && item.dueDate <= weekEndKey) {
      dueThisWeek += 1;
      dueThisWeekAmount += item.amount;
    }
    if (item.effectiveStatus === "overdue") {
      overdueCount += 1;
      overdueAmount += item.amount;
    }
    if (
      (item.status === "paid" || item.status === "partial") &&
      item.paidAt &&
      item.paidAt.slice(0, 7) === monthKey
    ) {
      paidThisMonth += 1;
      paidThisMonthAmount += item.paidAmount ?? item.amount;
    }
    if (
      (item.status === "paid" || item.status === "partial") &&
      !item.accounted
    ) {
      unaccountedCount += 1;
    }
  }

  return {
    dueThisWeek,
    dueThisWeekAmount,
    overdueCount,
    overdueAmount,
    paidThisMonth,
    paidThisMonthAmount,
    unaccountedCount,
  };
}

export function paymentDueGroup(item: PaymentRequestView): PaymentDueGroup {
  if (item.status === "cancelled") return "cancelled";
  if (item.status === "paid" || item.status === "partial") return "paid";
  if (item.effectiveStatus === "overdue") return "overdue";

  const todayKey = kyivDayKey();
  const weekEndKey = addDaysKey(todayKey, 6);
  if (item.dueDate === todayKey) return "today";
  if (item.dueDate > todayKey && item.dueDate <= weekEndKey) return "week";
  return "later";
}

/** Куди в фін. звіті потрапляє категорія заявки */
export type PaymentPnlTarget = "rent" | "utilities" | "taxes" | "other";

export function paymentCategoryPnlTarget(category: string): PaymentPnlTarget {
  switch (category) {
    case "rent":
      return "rent";
    case "utilities":
      return "utilities";
    case "tax":
      return "taxes";
    default:
      return "other";
  }
}

export type PaymentCalendarPnlLine = {
  id: number;
  title: string;
  amount: number;
  category: string;
  categoryLabel: string;
  target: PaymentPnlTarget;
  paidByName: string | null;
  paidAt: string | null;
};

export type PaymentCalendarPnlTotals = {
  rent: number;
  utilities: number;
  taxes: number;
  other: number;
  lines: PaymentCalendarPnlLine[];
};
