import {
  addDays,
  endOfDay,
  endOfMonth,
  endOfQuarter,
  endOfYear,
  format,
  parseISO,
  startOfDay,
  startOfMonth,
  startOfQuarter,
  startOfYear,
  subMonths,
} from "date-fns";
import { uk } from "date-fns/locale";

import prismadb from "@/lib/prismadb";
import {
  BASE_RATE_PER_MACHINE,
  FINANCE_PERIOD_PRESETS,
  PERFORMANCE_RATE,
  isFinancePeriodPreset,
  type FinancePeriodPreset,
} from "@/lib/finance-constants";

export {
  FINANCE_PERIOD_PRESETS,
  isFinancePeriodPreset,
  type FinancePeriodPreset,
} from "@/lib/finance-constants";

function roundMoney(n: number): number {
  return Math.round(n);
}

/** Унікальні YYYY-MM, що перетинають [from, to] */
export function periodKeysInRange(from: Date, to: Date): string[] {
  const keys: string[] = [];
  let cursor = startOfMonth(from);
  const end = startOfMonth(to);
  while (cursor <= end) {
    keys.push(format(cursor, "yyyy-MM"));
    cursor = startOfMonth(addDays(endOfMonth(cursor), 1));
  }
  return keys;
}

export function resolveFinancePeriod(input: {
  preset?: string | null;
  from?: string | null;
  to?: string | null;
  now?: Date;
}):
  | {
      ok: true;
      preset: FinancePeriodPreset;
      from: Date;
      to: Date;
      label: string;
    }
  | { ok: false; error: string } {
  const now = input.now ?? new Date();
  const preset: FinancePeriodPreset = isFinancePeriodPreset(input.preset)
    ? input.preset
    : "current_month";

  if (preset === "custom") {
    if (!input.from || !input.to) {
      return { ok: false, error: "Вкажіть from і to для довільного періоду" };
    }
    const from = startOfDay(parseISO(input.from));
    const to = endOfDay(parseISO(input.to));
    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
      return { ok: false, error: "Некоректні дати" };
    }
    if (from > to) {
      return { ok: false, error: "Дата «від» пізніше за «до»" };
    }
    return {
      ok: true,
      preset,
      from,
      to,
      label: `${format(from, "dd.MM.yyyy")} – ${format(to, "dd.MM.yyyy")}`,
    };
  }

  let from: Date;
  let to: Date;

  switch (preset) {
    case "last_7_days":
      to = endOfDay(now);
      from = startOfDay(addDays(now, -6));
      break;
    case "previous_month": {
      const prev = subMonths(now, 1);
      from = startOfMonth(prev);
      to = endOfMonth(prev);
      break;
    }
    case "last_2_months": {
      const prev = subMonths(now, 1);
      from = startOfMonth(prev);
      to = endOfMonth(now);
      break;
    }
    case "quarter":
      from = startOfQuarter(now);
      to = endOfQuarter(now);
      break;
    case "year":
      from = startOfYear(now);
      to = endOfYear(now);
      break;
    case "current_month":
    default:
      from = startOfMonth(now);
      to = endOfMonth(now);
      break;
  }

  const presetLabel =
    FINANCE_PERIOD_PRESETS.find((p) => p.value === preset)?.label || preset;

  return {
    ok: true,
    preset,
    from,
    to,
    label: `${presetLabel} · ${format(from, "dd.MM.yyyy", { locale: uk })} – ${format(to, "dd.MM.yyyy", { locale: uk })}`,
  };
}

export type FinanceReportFuelRow = {
  id: number;
  workerId: number;
  technicianName: string;
  amount: number;
  comment: string;
};

export type FinanceReportOtherRow = {
  id: number;
  workerId: number;
  technicianName: string;
  amount: number;
  comment: string;
  date: string;
};

export type FinanceReportSalaryRow = {
  workerId: number;
  name: string;
  baseSalary: number;
  performanceBonus: number;
  manualBonuses: number;
  deductions: number;
  total: number;
};

export type FinanceReportBonusRow = {
  id: number;
  workerId: number;
  technicianName: string;
  amount: number;
  reason: string;
  authorName: string;
  bonusDate: string;
};

/** Рядок виписки як у банківській: дата · опис · +/− · залишок */
export type FinanceStatementLine = {
  id: string;
  date: string;
  dateSort: number;
  description: string;
  credit: number;
  debit: number;
  balance: number;
};

export type FinanceWorkerStatement = {
  workerId: number;
  name: string;
  lines: FinanceStatementLine[];
  totalCredit: number;
  totalDebit: number;
  balance: number;
};

export type FinanceReport = {
  preset: FinancePeriodPreset;
  from: string;
  to: string;
  label: string;
  fuel: { total: number; rows: FinanceReportFuelRow[] };
  other: { total: number; rows: FinanceReportOtherRow[] };
  salary: { total: number; rows: FinanceReportSalaryRow[] };
  manualBonusEntries: FinanceReportBonusRow[];
  /** Деталізація по працівниках (банківська виписка) */
  statements: FinanceWorkerStatement[];
  technicians: { id: number; name: string }[];
};

async function monthPayrollParts(periodKey: string) {
  const from = startOfMonth(parseISO(`${periodKey}-01`));
  const to = endOfMonth(from);

  const technicians = await prismadb.workers.findMany({
    where: {
      role: "technician",
      OR: [{ active: true }, { active: null }],
    },
    select: {
      id: true,
      name: true,
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

  const byWorker = new Map<
    number,
    { name: string; baseSalary: number; performanceBonus: number }
  >();

  for (const tech of technicians) {
    const machinesCount = tech.machines.length;
    byWorker.set(tech.id, {
      name: tech.name || `Технік #${tech.id}`,
      baseSalary: machinesCount * BASE_RATE_PER_MACHINE,
      performanceBonus: roundMoney(
        machinesCount * avgNetworkLiters * PERFORMANCE_RATE
      ),
    });
  }

  return byWorker;
}

export async function getFinanceReport(input: {
  preset?: string | null;
  from?: string | null;
  to?: string | null;
}): Promise<FinanceReport | { error: string }> {
  const resolved = resolveFinancePeriod(input);
  if (!resolved.ok) return { error: resolved.error };

  const { from, to, preset, label } = resolved;

  const technicians = await prismadb.workers.findMany({
    where: {
      role: "technician",
      OR: [{ active: true }, { active: null }],
    },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });
  const nameById = new Map(
    technicians.map((t) => [t.id, t.name || `Технік #${t.id}`])
  );

  const expenseEntries = await prismadb.technicianExpenseEntry.findMany({
    where: { createdAt: { gte: from, lte: to } },
    orderBy: { createdAt: "desc" },
    include: { worker: { select: { name: true } } },
  });

  const fuelRows: FinanceReportFuelRow[] = [];
  const otherRows: FinanceReportOtherRow[] = [];
  let fuelTotal = 0;
  let otherTotal = 0;

  for (const e of expenseEntries) {
    const technicianName =
      e.worker?.name || nameById.get(e.workerId) || `Технік #${e.workerId}`;
    if (e.type === "fuel") {
      fuelTotal += e.amount;
      fuelRows.push({
        id: e.id,
        workerId: e.workerId,
        technicianName,
        amount: e.amount,
        comment: e.comment || "",
      });
    } else if (e.type === "other") {
      otherTotal += e.amount;
      otherRows.push({
        id: e.id,
        workerId: e.workerId,
        technicianName,
        amount: e.amount,
        comment: e.comment || "",
        date: e.createdAt.toLocaleDateString("uk-UA"),
      });
    }
  }

  const periodKeys = periodKeysInRange(from, to);
  const salaryAcc = new Map<
    number,
    {
      name: string;
      baseSalary: number;
      performanceBonus: number;
      manualBonuses: number;
      deductions: number;
    }
  >();

  for (const tech of technicians) {
    salaryAcc.set(tech.id, {
      name: tech.name || `Технік #${tech.id}`,
      baseSalary: 0,
      performanceBonus: 0,
      manualBonuses: 0,
      deductions: 0,
    });
  }

  type RawLine = {
    id: string;
    date: Date;
    description: string;
    credit: number;
    debit: number;
  };
  const rawByWorker = new Map<number, RawLine[]>();
  const pushLine = (workerId: number, line: RawLine) => {
    const list = rawByWorker.get(workerId) || [];
    list.push(line);
    rawByWorker.set(workerId, list);
  };

  for (const key of periodKeys) {
    const parts = await monthPayrollParts(key);
    const monthDate = endOfMonth(parseISO(`${key}-01`));
    const monthLabel = format(monthDate, "LLLL yyyy", { locale: uk });
    for (const [workerId, part] of parts) {
      const row = salaryAcc.get(workerId);
      if (!row) {
        salaryAcc.set(workerId, {
          name: part.name,
          baseSalary: part.baseSalary,
          performanceBonus: part.performanceBonus,
          manualBonuses: 0,
          deductions: 0,
        });
      } else {
        row.baseSalary += part.baseSalary;
        row.performanceBonus += part.performanceBonus;
      }
      if (part.baseSalary > 0) {
        pushLine(workerId, {
          id: `base-${workerId}-${key}`,
          date: monthDate,
          description: `Базова ставка · ${monthLabel}`,
          credit: part.baseSalary,
          debit: 0,
        });
      }
      if (part.performanceBonus > 0) {
        pushLine(workerId, {
          id: `perf-${workerId}-${key}`,
          date: monthDate,
          description: `Премія за літри · ${monthLabel}`,
          credit: part.performanceBonus,
          debit: 0,
        });
      }
    }
  }

  const deductionTasks = await prismadb.tasks.findMany({
    where: {
      deductionApplied: true,
      workerId: { not: null },
      OR: [
        { reviewedAt: { gte: from, lte: to } },
        {
          reviewedAt: null,
          completedAt: { gte: from, lte: to },
        },
      ],
    },
    select: {
      id: true,
      title: true,
      workerId: true,
      salaryDeduction: true,
      reviewedAt: true,
      completedAt: true,
    },
  });

  for (const t of deductionTasks) {
    if (t.workerId == null) continue;
    const row = salaryAcc.get(t.workerId);
    if (row) row.deductions += t.salaryDeduction || 0;
  }

  const bonuses =
    typeof prismadb.technicianManualBonus?.findMany === "function"
      ? await prismadb.technicianManualBonus.findMany({
          where: { bonusDate: { gte: from, lte: to } },
          orderBy: { bonusDate: "desc" },
          include: { worker: { select: { name: true } } },
        })
      : [];

  const manualBonusEntries: FinanceReportBonusRow[] = bonuses.map((b) => ({
    id: b.id,
    workerId: b.workerId,
    technicianName:
      b.worker?.name || nameById.get(b.workerId) || `Технік #${b.workerId}`,
    amount: b.amount,
    reason: b.reason,
    authorName: b.authorName,
    bonusDate: b.bonusDate.toLocaleDateString("uk-UA"),
  }));

  for (const b of bonuses) {
    const row = salaryAcc.get(b.workerId);
    if (row) row.manualBonuses += b.amount;
  }

  const salaryRows: FinanceReportSalaryRow[] = [...salaryAcc.entries()]
    .map(([workerId, r]) => {
      const total =
        r.baseSalary + r.performanceBonus + r.manualBonuses - r.deductions;
      return {
        workerId,
        name: r.name,
        baseSalary: r.baseSalary,
        performanceBonus: r.performanceBonus,
        manualBonuses: r.manualBonuses,
        deductions: r.deductions,
        total,
      };
    })
    .filter(
      (r) =>
        r.baseSalary !== 0 ||
        r.performanceBonus !== 0 ||
        r.manualBonuses !== 0 ||
        r.deductions !== 0
    )
    .sort((a, b) => a.name.localeCompare(b.name, "uk"));

  const salaryTotal = salaryRows.reduce((s, r) => s + r.total, 0);

  for (const b of bonuses) {
    pushLine(b.workerId, {
      id: `bonus-${b.id}`,
      date: b.bonusDate,
      description: `Ручна премія · ${b.reason}${
        b.authorName ? ` (${b.authorName})` : ""
      }`,
      credit: b.amount,
      debit: 0,
    });
  }

  for (const t of deductionTasks) {
    if (t.workerId == null || !t.salaryDeduction) continue;
    const when = t.reviewedAt || t.completedAt || from;
    pushLine(t.workerId, {
      id: `deduct-${t.id}`,
      date: when,
      description: `Утримання · ${t.title || `задача #${t.id}`}`,
      credit: 0,
      debit: t.salaryDeduction,
    });
  }

  for (const e of expenseEntries) {
    if (e.type === "fuel") {
      pushLine(e.workerId, {
        id: `fuel-${e.id}`,
        date: e.createdAt,
        description: e.comment?.trim()
          ? `Паливо · ${e.comment.trim()}`
          : "Паливо (компенсація)",
        credit: e.amount,
        debit: 0,
      });
    } else if (e.type === "other") {
      pushLine(e.workerId, {
        id: `other-${e.id}`,
        date: e.createdAt,
        description: e.comment?.trim()
          ? `Інші витрати · ${e.comment.trim()}`
          : "Інші витрати (компенсація)",
        credit: e.amount,
        debit: 0,
      });
    }
  }

  const statements: FinanceWorkerStatement[] = [];
  for (const tech of technicians) {
    const raw = rawByWorker.get(tech.id) || [];
    if (raw.length === 0) continue;
    raw.sort((a, b) => a.date.getTime() - b.date.getTime());
    let running = 0;
    let totalCredit = 0;
    let totalDebit = 0;
    const lines: FinanceStatementLine[] = raw.map((line) => {
      totalCredit += line.credit;
      totalDebit += line.debit;
      running += line.credit - line.debit;
      return {
        id: line.id,
        date: line.date.toLocaleDateString("uk-UA"),
        dateSort: line.date.getTime(),
        description: line.description,
        credit: line.credit,
        debit: line.debit,
        balance: running,
      };
    });
    statements.push({
      workerId: tech.id,
      name: tech.name || `Технік #${tech.id}`,
      lines,
      totalCredit,
      totalDebit,
      balance: running,
    });
  }
  statements.sort((a, b) => a.name.localeCompare(b.name, "uk"));

  return {
    preset,
    from: format(from, "yyyy-MM-dd"),
    to: format(to, "yyyy-MM-dd"),
    label,
    fuel: { total: fuelTotal, rows: fuelRows },
    other: { total: otherTotal, rows: otherRows },
    salary: { total: salaryTotal, rows: salaryRows },
    manualBonusEntries,
    statements,
    technicians: technicians.map((t) => ({
      id: t.id,
      name: t.name || `Технік #${t.id}`,
    })),
  };
}
