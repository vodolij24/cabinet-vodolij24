import prismadb from "@/lib/prismadb";
import {
  BASE_RATE_PER_MACHINE,
  PERFORMANCE_RATE,
} from "@/lib/finance-constants";

const MONTHS = [
  "січень",
  "лютий",
  "березень",
  "квітень",
  "травень",
  "червень",
  "липень",
  "серпень",
  "вересень",
  "жовтень",
  "листопад",
  "грудень",
];

export type SettlementCurrency = "UAH" | "USD";

export type LedgerLine = {
  id: string;
  dateLabel: string;
  monthKey: string;
  monthLabel: string | null;
  accrual: number;
  payout: number;
  purpose: string;
  balance: number;
};

export type SettlementBook = {
  currency: SettlementCurrency;
  digits: number;
  unit: string;
  opening: number;
  lines: LedgerLine[];
  accrued: number;
  paid: number;
  balance: number;
};

export type SettlementPerson = {
  slug: string;
  name: string;
  kind: "counterparty" | "employee";
  hint: string;
  books: { currency: SettlementCurrency; unit: string; balance: number; digits: number }[];
};

export type SettlementDetail = {
  slug: string;
  name: string;
  kind: "counterparty" | "employee";
  hint: string;
  year: number | "all";
  yearLinks: { year: number | "all"; label: string }[];
  books: SettlementBook[];
};

type GrishRow = {
  category: string;
  side: string;
  amount: number;
  currency: string;
  entry_date: string | null;
  date_raw: string | null;
  period_raw: string | null;
  note: string | null;
  detail: string | null;
  source_row: number;
};

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

function currentYear() {
  return new Date().getFullYear();
}

export function parseSettlementYear(
  value: string | undefined,
  allowAll: boolean
): number | "all" {
  if (allowAll && value === "all") return "all";
  const year = Number(value);
  const now = currentYear();
  if (Number.isInteger(year) && year >= 2024 && year <= now) return year;
  return now;
}

function monthKeys(year: number) {
  const now = new Date();
  const last =
    year < now.getFullYear() ? 12 : year === now.getFullYear() ? now.getMonth() + 1 : 0;
  return Array.from({ length: last }, (_, i) => {
    const month = String(i + 1).padStart(2, "0");
    return `${year}-${month}`;
  });
}

function dateLabel(iso: string) {
  const [y, m, d] = iso.split("-");
  return `${Number(d)}.${Number(m)}.${y}`;
}

function monthTitle(key: string) {
  const [y, m] = key.split("-");
  const name = MONTHS[Number(m) - 1];
  if (!name) return key;
  return `${name[0].toUpperCase()}${name.slice(1)} ${y}`;
}

function royaltyPeriod(text: string | null) {
  if (!text) return null;
  const year = text.match(/ys=(\d{4})/);
  const month = text.match(/ms=(\d{1,2})/);
  if (!year || !month) return null;
  const name = MONTHS[Number(month[1]) - 1];
  return name ? `${name} ${year[1]}` : null;
}

function purposeOf(row: GrishRow) {
  const period = royaltyPeriod(row.detail);
  const note = row.note && !/^https?:/i.test(row.note) ? row.note : "";
  const detail =
    row.detail && !/https?:/i.test(row.detail) && !/ys=/.test(row.detail)
      ? row.detail
      : "";
  if (row.category === "Роялті" && row.side === "charge" && period) {
    return note ? `Роялті · ${period} · ${note}` : `Роялті · ${period}`;
  }
  const extra = [note, detail].filter(Boolean).join(" · ");
  return extra ? `${row.category} · ${extra}` : row.category;
}

/** yyyy-mm-dd, if the file has a single day or month. Ranges stay undated. */
function sortKey(row: GrishRow): string | null {
  if (row.entry_date && /^\d{4}-\d{2}-\d{2}$/.test(row.entry_date)) {
    return row.entry_date;
  }
  if (row.period_raw && /^\d{4}-\d{2}$/.test(row.period_raw)) {
    return `${row.period_raw}-01`;
  }
  return null;
}

function mentionedYears(row: GrishRow) {
  const text = `${row.date_raw || ""} ${row.period_raw || ""} ${row.note || ""}`;
  return [...text.matchAll(/20\d{2}/g)].map((m) => Number(m[0]));
}

function placeRow(row: GrishRow, year: number | "all"): "opening" | "line" | "skip" {
  const key = sortKey(row);
  if (key) {
    const rowYear = Number(key.slice(0, 4));
    if (year === "all") return "line";
    if (rowYear < year) return "opening";
    if (rowYear > year) return "skip";
    return "line";
  }
  if (year === "all") return "line";
  const years = mentionedYears(row);
  if (years.length && Math.max(...years) < year) return "opening";
  if (years.length && Math.min(...years) > year) return "skip";
  if (row.category === "Ремонти" || row.category === "Перепрошивка") {
    return year === currentYear() ? "line" : "opening";
  }
  return "opening";
}

function bookFromRows(rows: GrishRow[], currency: SettlementCurrency, year: number | "all"): SettlementBook {
  const mine = rows.filter((row) => row.currency === currency);
  let opening = 0;
  const active: GrishRow[] = [];
  for (const row of mine) {
    const place = placeRow(row, year);
    const signed = row.side === "payment" ? -row.amount : row.amount;
    if (place === "opening") opening += signed;
    else if (place === "line") active.push(row);
  }
  active.sort((a, b) => {
    const ak = sortKey(a) || "0000-00-00";
    const bk = sortKey(b) || "0000-00-00";
    if (ak !== bk) return ak < bk ? -1 : 1;
    if (a.side !== b.side) return a.side === "charge" ? -1 : 1;
    return a.source_row - b.source_row;
  });

  const lines: LedgerLine[] = [];
  let running = opening;
  opening = round2(opening);
  if (year !== "all") {
    lines.push({
      id: `opening-${currency}`,
      dateLabel: `1.1.${year}`,
      monthKey: "opening",
      monthLabel: null,
      accrual: 0,
      payout: 0,
      purpose: `Сальдо на початок ${year}`,
      balance: opening,
    });
  }
  let accrued = 0;
  let paid = 0;
  for (const row of active) {
    const key = sortKey(row);
    const accrual = row.side === "charge" ? row.amount : 0;
    const payout = row.side === "payment" ? row.amount : 0;
    accrued += accrual;
    paid += payout;
    running += accrual - payout;
    lines.push({
      id: `${row.category}-${row.side}-${row.source_row}-${row.amount}`,
      dateLabel: key ? dateLabel(key) : row.date_raw || row.period_raw || "без дати",
      monthKey: key ? key.slice(0, 7) : "undated",
      monthLabel: key ? monthTitle(key.slice(0, 7)) : "Без дати у файлі",
      accrual,
      payout,
      purpose: purposeOf(row),
      balance: round2(running),
    });
  }
  return {
    currency,
    digits: 2,
    unit: currency === "UAH" ? "грн" : "$",
    opening,
    lines,
    accrued: round2(accrued),
    paid: round2(paid),
    balance: round2(running),
  };
}

async function grishchenkoRows(): Promise<GrishRow[]> {
  return prismadb.$queryRaw<GrishRow[]>`
    SELECT category,
           side,
           amount::float8 AS amount,
           currency,
           to_char(entry_date, 'YYYY-MM-DD') AS entry_date,
           date_raw,
           period_raw,
           note,
           detail,
           source_row
    FROM grishchenko_ledger
    WHERE included_in_current_debt = true
  `;
}

async function employeeLines(year: number) {
  const keys = monthKeys(year);
  const from = new Date(year, 0, 1);
  const to = new Date(year + 1, 0, 1);
  const technicians = await prismadb.workers.findMany({
    where: {
      role: "technician",
      OR: [{ active: true }, { active: null }],
    },
    orderBy: { name: "asc" },
    select: { id: true, name: true, machines: { select: { id: true } } },
  });
  if (keys.length === 0) {
    return technicians.map((tech) => ({
      id: tech.id,
      name: tech.name || `Технік #${tech.id}`,
      lines: [] as LedgerLine[],
    }));
  }

  const [networkMachinesCount, literRows, entries, bonuses, deductions] =
    await Promise.all([
      prismadb.vending_machines.count(),
      prismadb.$queryRaw<{ month: string; liters: number }[]>`
        SELECT to_char(date, 'YYYY-MM') AS month,
               COALESCE(SUM("waterFullfilled"), 0)::float8 AS liters
        FROM transactions
        WHERE date >= ${from} AND date < ${to}
        GROUP BY 1
      `,
      prismadb.technicianExpenseEntry.findMany({
        where: { periodKey: { in: keys } },
        orderBy: { createdAt: "asc" },
      }),
      prismadb.technicianManualBonus.findMany({
        where: { bonusDate: { gte: from, lt: to } },
        orderBy: { bonusDate: "asc" },
      }),
      prismadb.tasks.findMany({
        where: {
          deductionApplied: true,
          workerId: { not: null },
          OR: [
            { reviewedAt: { gte: from, lt: to } },
            { reviewedAt: null, completedAt: { gte: from, lt: to } },
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
      }),
    ]);

  const litersByMonth = new Map(literRows.map((row) => [row.month, row.liters]));
  const avgByMonth = new Map(
    keys.map((key) => {
      const total = Math.round(litersByMonth.get(key) || 0);
      const avg = networkMachinesCount > 0 ? total / networkMachinesCount : 0;
      return [key, avg] as const;
    })
  );

  return technicians.map((tech) => {
    const machines = tech.machines.length;
    const draft: {
      id: string;
      sort: string;
      accrual: number;
      payout: number;
      purpose: string;
    }[] = [];
    for (const key of keys) {
      const base = machines * BASE_RATE_PER_MACHINE;
      const bonus = Math.round(machines * (avgByMonth.get(key) || 0) * PERFORMANCE_RATE);
      const salary = base + bonus;
      if (salary > 0) {
        const month = Number(key.slice(5, 7));
        draft.push({
          id: `salary-${tech.id}-${key}`,
          sort: `${key}-01`,
          accrual: salary,
          payout: 0,
          purpose: `ЗП ${MONTHS[month - 1]}`,
        });
      }
    }
    for (const entry of entries) {
      if (entry.workerId !== tech.id) continue;
      const created = entry.createdAt;
      const sort = `${created.getFullYear()}-${String(created.getMonth() + 1).padStart(2, "0")}-${String(created.getDate()).padStart(2, "0")}`;
      const label = entry.type === "fuel" ? "паливо" : "різні витрати";
      draft.push({
        id: `expense-${entry.id}`,
        sort,
        accrual: entry.amount,
        payout: 0,
        purpose: entry.comment?.trim() ? `${label} · ${entry.comment.trim()}` : label,
      });
    }
    for (const bonus of bonuses) {
      if (bonus.workerId !== tech.id) continue;
      const when = bonus.bonusDate;
      const sort = `${when.getFullYear()}-${String(when.getMonth() + 1).padStart(2, "0")}-${String(when.getDate()).padStart(2, "0")}`;
      draft.push({
        id: `bonus-${bonus.id}`,
        sort,
        accrual: bonus.amount,
        payout: 0,
        purpose: `премія · ${bonus.reason}`,
      });
    }
    for (const task of deductions) {
      if (task.workerId !== tech.id || !task.salaryDeduction) continue;
      const when = task.reviewedAt || task.completedAt || from;
      const sort = `${when.getFullYear()}-${String(when.getMonth() + 1).padStart(2, "0")}-${String(when.getDate()).padStart(2, "0")}`;
      draft.push({
        id: `deduct-${task.id}`,
        sort,
        accrual: 0,
        payout: task.salaryDeduction,
        purpose: `утримання · ${task.title || `задача #${task.id}`}`,
      });
    }
    draft.sort((a, b) => (a.sort < b.sort ? -1 : a.sort > b.sort ? 1 : a.accrual > 0 ? -1 : 1));
    let running = 0;
    const lines: LedgerLine[] = draft.map((line) => {
      running = round2(running + line.accrual - line.payout);
      return {
        id: line.id,
        dateLabel: dateLabel(line.sort),
        monthKey: line.sort.slice(0, 7),
        monthLabel: monthTitle(line.sort.slice(0, 7)),
        accrual: line.accrual,
        payout: line.payout,
        purpose: line.purpose,
        balance: running,
      };
    });
    return {
      id: tech.id,
      name: tech.name || `Технік #${tech.id}`,
      lines,
    };
  });
}

function sumLines(lines: LedgerLine[]) {
  let accrued = 0;
  let paid = 0;
  for (const line of lines) {
    accrued += line.accrual;
    paid += line.payout;
  }
  const balance = lines.length ? lines[lines.length - 1].balance : 0;
  return { accrued: round2(accrued), paid: round2(paid), balance };
}

export async function listSettlementPeople(year = currentYear()): Promise<{
  grishchenko: SettlementPerson | null;
  employees: SettlementPerson[];
  year: number;
}> {
  const [rows, people] = await Promise.all([
    grishchenkoRows().catch(() => null),
    employeeLines(year),
  ]);
  const grishchenko = rows
    ? (() => {
        const uah = bookFromRows(rows, "UAH", "all");
        const usd = bookFromRows(rows, "USD", "all");
        return {
          slug: "grishchenko",
          name: "Грищенко Віктор",
          kind: "counterparty" as const,
          hint: "Контрагент",
          books: [uah, usd].map((book) => ({
            currency: book.currency,
            unit: book.unit,
            balance: book.balance,
            digits: book.digits,
          })),
        };
      })()
    : null;
  const employees = people
    .filter((person) => person.lines.length > 0)
    .map((person) => {
      const totals = sumLines(person.lines);
      return {
        slug: `w-${person.id}`,
        name: person.name,
        kind: "employee" as const,
        hint: "Зарплата",
        books: [
          {
            currency: "UAH" as const,
            unit: "грн",
            balance: totals.balance,
            digits: 0,
          },
        ],
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name, "uk"));
  return { grishchenko, employees, year };
}

export async function getSettlementDetail(
  slug: string,
  year: number | "all"
): Promise<SettlementDetail | null> {
  if (slug === "grishchenko") {
    const rows = await grishchenkoRows();
    const now = currentYear();
    return {
      slug,
      name: "Грищенко Віктор",
      kind: "counterparty",
      hint: "Нарахування збільшує борг, видача зменшує. Гривні й долари окремо.",
      year,
      yearLinks: [
        { year: now, label: String(now) },
        { year: "all", label: "Уся історія" },
      ],
      books: [bookFromRows(rows, "UAH", year), bookFromRows(rows, "USD", year)],
    };
  }
  const match = slug.match(/^w-(\d+)$/);
  if (!match) return null;
  const workerId = Number(match[1]);
  const selected = year === "all" ? currentYear() : year;
  const people = await employeeLines(selected);
  const person = people.find((item) => item.id === workerId);
  if (!person) return null;
  const totals = sumLines(person.lines);
  const now = currentYear();
  const links = [now - 1, now]
    .filter((item) => item >= 2024)
    .map((item) => ({ year: item as number | "all", label: String(item) }));
  return {
    slug,
    name: person.name,
    kind: "employee",
    hint: "Зарплата як у фінансах: автомати × 300 і премія за літри. Видача — це утримання, готівкові виплати сюди ще не записуються.",
    year: selected,
    yearLinks: links,
    books: [
      {
        currency: "UAH",
        digits: 0,
        unit: "грн",
        opening: 0,
        lines: person.lines,
        accrued: totals.accrued,
        paid: totals.paid,
        balance: totals.balance,
      },
    ],
  };
}
