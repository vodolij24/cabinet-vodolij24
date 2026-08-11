import { endOfMonth, startOfMonth, parse } from "date-fns";

import prismadb from "@/lib/prismadb";
import {
  BASE_RATE_PER_MACHINE,
  PERFORMANCE_RATE,
} from "@/lib/finance-constants";
import { currentPeriodKey } from "@/lib/task-fields";
import { parsePhotoUrls } from "@/lib/photo-urls";

export {
  BASE_RATE_PER_MACHINE,
  PERFORMANCE_RATE,
} from "@/lib/finance-constants";

export const EXPENSE_TYPES = [
  { value: "fuel", label: "Паливо" },
  { value: "other", label: "Інші витрати" },
] as const;

export type ExpenseType = (typeof EXPENSE_TYPES)[number]["value"];

export function isExpenseType(value: unknown): value is ExpenseType {
  return value === "fuel" || value === "other";
}

export function expenseTypeLabel(type: string): string {
  return EXPENSE_TYPES.find((t) => t.value === type)?.label ?? type;
}

export function isPeriodKey(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}$/.test(value);
}

export function periodBounds(periodKey: string) {
  const from = startOfMonth(parse(`${periodKey}-01`, "yyyy-MM-dd", new Date()));
  const to = endOfMonth(from);
  return { from, to };
}

export type FinanceExpenseEntry = {
  id: number;
  type: string;
  typeLabel: string;
  amount: number;
  comment: string;
  photoUrls: string[];
  createdAt: string;
};

export type FinanceTechnicianRow = {
  workerId: number;
  name: string;
  phone: string | null;
  machinesCount: number;
  baseSalary: number;
  avgNetworkLiters: number;
  performanceBonus: number;
  deductions: number;
  manualBonuses: number;
  fuelAmount: number;
  otherAmount: number;
  expenseCompensation: number;
  payoutTotal: number;
  entriesCount: number;
  lastExpenseAt: string | null;
  photoUrls: string[];
  entries: FinanceExpenseEntry[];
};

export type FinanceMonthSummary = {
  periodKey: string;
  avgNetworkLiters: number;
  networkMachinesCount: number;
  totalNetworkLiters: number;
  rows: FinanceTechnicianRow[];
  totals: {
    machinesCount: number;
    baseSalary: number;
    performanceBonus: number;
    deductions: number;
    manualBonuses: number;
    fuelAmount: number;
    otherAmount: number;
    expenseCompensation: number;
    payoutTotal: number;
  };
};

function roundMoney(n: number): number {
  return Math.round(n);
}

function mapEntry(e: {
  id: number;
  type: string;
  amount: number;
  comment: string | null;
  photoUrls: string | null;
  createdAt: Date;
}): FinanceExpenseEntry {
  return {
    id: e.id,
    type: e.type,
    typeLabel: expenseTypeLabel(e.type),
    amount: e.amount,
    comment: e.comment || "",
    photoUrls: parsePhotoUrls(e.photoUrls),
    createdAt: e.createdAt.toLocaleString("uk-UA"),
  };
}

export async function getFinanceMonth(
  periodKey = currentPeriodKey()
): Promise<FinanceMonthSummary> {
  const { from, to } = periodBounds(periodKey);

  const technicians = await prismadb.workers.findMany({
    where: {
      role: "technician",
      OR: [{ active: true }, { active: null }],
    },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      phone: true,
      machines: { select: { id: true } },
    },
  });

  const networkMachinesCount = await prismadb.vending_machines.count();

  const litersAgg = await prismadb.transactions.aggregate({
    where: { date: { gte: from, lte: to } },
    _sum: { waterFullfilled: true },
  });
  const totalNetworkLiters = Math.round(litersAgg._sum.waterFullfilled || 0);
  const avgNetworkLiters =
    networkMachinesCount > 0
      ? totalNetworkLiters / networkMachinesCount
      : 0;

  const entries = await prismadb.technicianExpenseEntry.findMany({
    where: { periodKey },
    orderBy: { createdAt: "desc" },
  });

  const entriesByWorker = new Map<number, typeof entries>();
  for (const e of entries) {
    const list = entriesByWorker.get(e.workerId) || [];
    list.push(e);
    entriesByWorker.set(e.workerId, list);
  }

  const deductionTasks = await prismadb.tasks.findMany({
    where: {
      deductionApplied: true,
      workerId: { not: null },
      OR: [
        { reviewedAt: { gte: from, lte: to } },
        // Відхилення з утриманням: ще до ознайомлення керівника
        {
          reviewedAt: null,
          completedAt: { gte: from, lte: to },
        },
      ],
    },
    select: {
      workerId: true,
      salaryDeduction: true,
    },
  });

  const deductionsByWorker = new Map<number, number>();
  for (const t of deductionTasks) {
    if (t.workerId == null) continue;
    const add = t.salaryDeduction || 0;
    deductionsByWorker.set(
      t.workerId,
      (deductionsByWorker.get(t.workerId) || 0) + add
    );
  }

  const manualBonuses =
    typeof prismadb.technicianManualBonus?.findMany === "function"
      ? await prismadb.technicianManualBonus.findMany({
          where: { bonusDate: { gte: from, lte: to } },
          select: { workerId: true, amount: true },
        })
      : [];
  const manualByWorker = new Map<number, number>();
  for (const b of manualBonuses) {
    manualByWorker.set(
      b.workerId,
      (manualByWorker.get(b.workerId) || 0) + b.amount
    );
  }

  const rows: FinanceTechnicianRow[] = technicians.map((tech) => {
    const machinesCount = tech.machines.length;
    const baseSalary = machinesCount * BASE_RATE_PER_MACHINE;
    const performanceBonus = roundMoney(
      machinesCount * avgNetworkLiters * PERFORMANCE_RATE
    );
    const deductions = deductionsByWorker.get(tech.id) || 0;
    const manualBonusSum = manualByWorker.get(tech.id) || 0;
    const workerEntries = entriesByWorker.get(tech.id) || [];
    const mapped = workerEntries.map(mapEntry);
    const fuelAmount = workerEntries
      .filter((e) => e.type === "fuel")
      .reduce((s, e) => s + e.amount, 0);
    const otherAmount = workerEntries
      .filter((e) => e.type === "other")
      .reduce((s, e) => s + e.amount, 0);
    const expenseCompensation = fuelAmount + otherAmount;
    const payoutTotal =
      baseSalary +
      performanceBonus +
      manualBonusSum -
      deductions +
      expenseCompensation;
    const allPhotos = mapped.flatMap((e) => e.photoUrls);

    return {
      workerId: tech.id,
      name: tech.name || `Технік #${tech.id}`,
      phone: tech.phone,
      machinesCount,
      baseSalary,
      avgNetworkLiters: roundMoney(avgNetworkLiters),
      performanceBonus,
      deductions,
      manualBonuses: manualBonusSum,
      fuelAmount,
      otherAmount,
      expenseCompensation,
      payoutTotal,
      entriesCount: mapped.length,
      lastExpenseAt: mapped[0]?.createdAt ?? null,
      photoUrls: allPhotos.slice(0, 6),
      entries: mapped,
    };
  });

  const totals = rows.reduce(
    (acc, r) => {
      acc.machinesCount += r.machinesCount;
      acc.baseSalary += r.baseSalary;
      acc.performanceBonus += r.performanceBonus;
      acc.deductions += r.deductions;
      acc.manualBonuses += r.manualBonuses;
      acc.fuelAmount += r.fuelAmount;
      acc.otherAmount += r.otherAmount;
      acc.expenseCompensation += r.expenseCompensation;
      acc.payoutTotal += r.payoutTotal;
      return acc;
    },
    {
      machinesCount: 0,
      baseSalary: 0,
      performanceBonus: 0,
      deductions: 0,
      manualBonuses: 0,
      fuelAmount: 0,
      otherAmount: 0,
      expenseCompensation: 0,
      payoutTotal: 0,
    }
  );

  return {
    periodKey,
    avgNetworkLiters: roundMoney(avgNetworkLiters),
    networkMachinesCount,
    totalNetworkLiters,
    rows,
    totals,
  };
}

function parsePositiveInt(value: unknown): number | "invalid" {
  if (value === null || value === undefined || value === "") return "invalid";
  if (typeof value === "number") {
    if (!Number.isInteger(value) || value <= 0) return "invalid";
    return value;
  }
  if (typeof value === "string") {
    const t = value.trim();
    if (!/^\d+$/.test(t)) return "invalid";
    const n = parseInt(t, 10);
    if (n <= 0) return "invalid";
    return n;
  }
  return "invalid";
}

/** Створює незмінну транзакцію витрати (паливо АБО інше) */
export async function createExpenseEntry(input: {
  workerId: number;
  periodKey: string;
  type: unknown;
  amount: unknown;
  comment?: unknown;
  photoUrls?: string[];
}) {
  if (!isExpenseType(input.type)) {
    return { error: "Оберіть тип: паливо або інші витрати" as const };
  }
  const amount = parsePositiveInt(input.amount);
  if (amount === "invalid") {
    return { error: "Вкажіть суму більше 0" as const };
  }
  if (!isPeriodKey(input.periodKey)) {
    return { error: "Некоректний період" as const };
  }

  const comment =
    typeof input.comment === "string" ? input.comment.trim() : "";

  const worker = await prismadb.workers.findFirst({
    where: { id: input.workerId, role: "technician" },
    select: { id: true },
  });
  if (!worker) {
    return { error: "Техніка не знайдено" as const };
  }

  const photos = (input.photoUrls || []).slice(0, 5);

  const entry = await prismadb.technicianExpenseEntry.create({
    data: {
      workerId: input.workerId,
      periodKey: input.periodKey,
      type: input.type,
      amount,
      comment: comment || null,
      photoUrls: photos.length ? JSON.stringify(photos) : null,
    },
  });

  return { entry: mapEntry(entry) };
}

export async function listExpenseEntries(
  workerId: number,
  periodKey: string
): Promise<FinanceExpenseEntry[]> {
  const rows = await prismadb.technicianExpenseEntry.findMany({
    where: { workerId, periodKey },
    orderBy: { createdAt: "desc" },
  });
  return rows.map(mapEntry);
}

export async function getTechnicianFinanceSnapshot(
  workerId: number,
  periodKey = currentPeriodKey()
): Promise<FinanceTechnicianRow | null> {
  const summary = await getFinanceMonth(periodKey);
  return summary.rows.find((r) => r.workerId === workerId) || null;
}
