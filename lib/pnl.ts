import "server-only";

import prismadb from "@/lib/prismadb";
import { decimalToNumber } from "@/lib/collection-fields";
import { kyivCustomPeriodBounds } from "@/lib/kyiv-date";
import { getFinanceMonth, isPeriodKey } from "@/lib/finance-month";
import {
  PNL_ROYALTY_RATE,
  PNL_STATIC_DEFAULTS,
  kyivPeriodKey,
  listPnlMonths,
  periodKeyLabel,
  type PnlSheetKind,
} from "@/lib/pnl-constants";
import type {
  PnlManualValues,
  PnlPage,
  PnlSheetSlot,
  PnlStaticValues,
} from "@/lib/pnl-types";

export type {
  PnlManualValues,
  PnlPage,
  PnlSheetSlot,
  PnlStaticValues,
} from "@/lib/pnl-types";

type PnlRow = {
  period_key: string;
  other_income: unknown;
  kmit_cash: unknown;
  rent_total: unknown;
  salary_volodymyr: unknown;
  salary_terebenets: unknown;
  marketing: unknown;
  sim_cards: unknown;
  manual_accepted_at: Date | null;
  amort_auto: unknown;
  filter_cost: unknown;
  vchasno: unknown;
  salary_callcenter: unknown;
  salary_techdir: unknown;
  salary_finmanager: unknown;
  salary_olena: unknown;
  static_accepted_at: Date | null;
  kmit_bn_amount: unknown;
  kmit_bn_file_url: string | null;
  kmit_bn_file_name: string | null;
  kmit_bn_note: string | null;
  kmit_bn_accepted_at: Date | null;
  pozdnyakova_bn_amount: unknown;
  pozdnyakova_bn_file_url: string | null;
  pozdnyakova_bn_file_name: string | null;
  pozdnyakova_bn_note: string | null;
  pozdnyakova_bn_accepted_at: Date | null;
  utilities_amount: unknown;
  utilities_file_url: string | null;
  utilities_file_name: string | null;
  utilities_note: string | null;
  utilities_accepted_at: Date | null;
  taxes_amount: unknown;
  taxes_file_url: string | null;
  taxes_file_name: string | null;
  taxes_note: string | null;
  taxes_accepted_at: Date | null;
};

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

function moneyOr(value: unknown, fallback = 0) {
  if (value == null) return fallback;
  return round2(decimalToNumber(value));
}

function moneyOrNull(value: unknown): number | null {
  if (value == null) return null;
  return round2(decimalToNumber(value));
}

function isoOrNull(d: Date | null) {
  return d ? d.toISOString() : null;
}

function kyivMonthBounds(periodKey: string) {
  const [y, m] = periodKey.split("-").map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const fromKey = `${periodKey}-01`;
  const toKey = `${periodKey}-${String(last).padStart(2, "0")}`;
  const bounds = kyivCustomPeriodBounds(fromKey, toKey);
  if (!bounds) throw new Error("Invalid period");
  return bounds;
}

let tableReady = false;

export async function ensurePnlTable() {
  if (tableReady) return;
  await prismadb.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS monthly_pnl (
      id SERIAL PRIMARY KEY,
      period_key VARCHAR(16) NOT NULL UNIQUE,
      other_income DOUBLE PRECISION NOT NULL DEFAULT 0,
      kmit_cash DOUBLE PRECISION NOT NULL DEFAULT 0,
      rent_total DOUBLE PRECISION NOT NULL DEFAULT 0,
      salary_volodymyr DOUBLE PRECISION NOT NULL DEFAULT 0,
      salary_terebenets DOUBLE PRECISION NOT NULL DEFAULT 0,
      marketing DOUBLE PRECISION NOT NULL DEFAULT 0,
      sim_cards DOUBLE PRECISION NOT NULL DEFAULT 0,
      manual_accepted_at TIMESTAMPTZ,
      amort_auto DOUBLE PRECISION,
      filter_cost DOUBLE PRECISION,
      vchasno DOUBLE PRECISION,
      salary_callcenter DOUBLE PRECISION,
      salary_techdir DOUBLE PRECISION,
      salary_finmanager DOUBLE PRECISION,
      salary_olena DOUBLE PRECISION,
      static_accepted_at TIMESTAMPTZ,
      kmit_bn_amount DOUBLE PRECISION,
      kmit_bn_file_url TEXT,
      kmit_bn_file_name TEXT,
      kmit_bn_note TEXT,
      kmit_bn_accepted_at TIMESTAMPTZ,
      pozdnyakova_bn_amount DOUBLE PRECISION,
      pozdnyakova_bn_file_url TEXT,
      pozdnyakova_bn_file_name TEXT,
      pozdnyakova_bn_note TEXT,
      pozdnyakova_bn_accepted_at TIMESTAMPTZ,
      utilities_amount DOUBLE PRECISION,
      utilities_file_url TEXT,
      utilities_file_name TEXT,
      utilities_note TEXT,
      utilities_accepted_at TIMESTAMPTZ,
      taxes_amount DOUBLE PRECISION,
      taxes_file_url TEXT,
      taxes_file_name TEXT,
      taxes_note TEXT,
      taxes_accepted_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  tableReady = true;
}

async function loadRow(periodKey: string): Promise<PnlRow | null> {
  await ensurePnlTable();
  const rows = await prismadb.$queryRaw<PnlRow[]>`
    SELECT * FROM monthly_pnl WHERE period_key = ${periodKey} LIMIT 1
  `;
  return rows[0] ?? null;
}

export async function ensurePnlRow(periodKey: string): Promise<PnlRow> {
  const existing = await loadRow(periodKey);
  if (existing) return existing;
  await prismadb.$executeRaw`
    INSERT INTO monthly_pnl (period_key) VALUES (${periodKey})
    ON CONFLICT (period_key) DO NOTHING
  `;
  const created = await loadRow(periodKey);
  if (!created) throw new Error("Не вдалося створити фінзвіт");
  return created;
}

function sheetSlot(
  amount: unknown,
  fileUrl: string | null,
  fileName: string | null,
  note: string | null,
  acceptedAt: Date | null
): PnlSheetSlot {
  return {
    amount: moneyOrNull(amount),
    fileUrl,
    fileName,
    note,
    accepted: acceptedAt != null,
    acceptedAt: isoOrNull(acceptedAt),
  };
}

export function emptySheetSlot(): PnlSheetSlot {
  return {
    amount: null,
    fileUrl: null,
    fileName: null,
    note: null,
    accepted: false,
    acceptedAt: null,
  };
}

async function getComputed(periodKey: string) {
  const bounds = kyivMonthBounds(periodKey);
  const [tx, finance] = await Promise.all([
    prismadb.transactions.aggregate({
      where: { date: { gte: bounds.from, lte: bounds.to } },
      _sum: {
        cashPaymant: true,
        cardPaymant: true,
        onlinePaymant: true,
      },
    }),
    getFinanceMonth(periodKey),
  ]);

  const cashRevenue = round2(tx._sum.cashPaymant || 0);
  const cashlessRevenue = round2(
    (tx._sum.cardPaymant || 0) + (tx._sum.onlinePaymant || 0)
  );
  const totalRevenue = round2(cashRevenue + cashlessRevenue);
  const fuel = finance.totals.fuelAmount;
  const otherExpenses = finance.totals.otherAmount;
  const royalty = round2(totalRevenue * PNL_ROYALTY_RATE);

  const techSalaries = finance.rows
    .map((r) => ({
      workerId: r.workerId,
      name: r.name,
      amount: round2(
        r.baseSalary + r.performanceBonus + r.manualBonuses - r.deductions
      ),
    }))
    .filter((r) => r.amount !== 0)
    .sort((a, b) => a.name.localeCompare(b.name, "uk"));

  const techSalariesTotal = round2(
    techSalaries.reduce((s, r) => s + r.amount, 0)
  );

  return {
    cashRevenue,
    cashlessRevenue,
    totalRevenue,
    fuel,
    otherExpenses,
    royalty,
    techSalaries,
    techSalariesTotal,
  };
}

function mapPage(periodKey: string, row: PnlRow | null, computed: Awaited<ReturnType<typeof getComputed>>): PnlPage {
  const d = PNL_STATIC_DEFAULTS;
  const manual = {
    otherIncome: moneyOr(row?.other_income),
    kmitCash: moneyOr(row?.kmit_cash),
    rentTotal: moneyOr(row?.rent_total),
    salaryVolodymyr: moneyOr(row?.salary_volodymyr),
    salaryTerebenets: moneyOr(row?.salary_terebenets),
    marketing: moneyOr(row?.marketing),
    simCards: moneyOr(row?.sim_cards),
    accepted: row?.manual_accepted_at != null,
    acceptedAt: isoOrNull(row?.manual_accepted_at ?? null),
  };
  const staticCosts = {
    amortAuto: moneyOr(row?.amort_auto, d.amortAuto),
    filterCost: moneyOr(row?.filter_cost, d.filterCost),
    vchasno: moneyOr(row?.vchasno, d.vchasno),
    salaryCallcenter: moneyOr(row?.salary_callcenter, d.salaryCallcenter),
    salaryTechdir: moneyOr(row?.salary_techdir, d.salaryTechdir),
    salaryFinmanager: moneyOr(row?.salary_finmanager, d.salaryFinmanager),
    salaryOlena: moneyOr(row?.salary_olena, d.salaryOlena),
    accepted: row?.static_accepted_at != null,
    acceptedAt: isoOrNull(row?.static_accepted_at ?? null),
  };
  const sheets: Record<PnlSheetKind, PnlSheetSlot> = {
    kmitBn: sheetSlot(
      row?.kmit_bn_amount,
      row?.kmit_bn_file_url ?? null,
      row?.kmit_bn_file_name ?? null,
      row?.kmit_bn_note ?? null,
      row?.kmit_bn_accepted_at ?? null
    ),
    pozdnyakovaBn: sheetSlot(
      row?.pozdnyakova_bn_amount,
      row?.pozdnyakova_bn_file_url ?? null,
      row?.pozdnyakova_bn_file_name ?? null,
      row?.pozdnyakova_bn_note ?? null,
      row?.pozdnyakova_bn_accepted_at ?? null
    ),
    utilities: sheetSlot(
      row?.utilities_amount,
      row?.utilities_file_url ?? null,
      row?.utilities_file_name ?? null,
      row?.utilities_note ?? null,
      row?.utilities_accepted_at ?? null
    ),
    taxes: sheetSlot(
      row?.taxes_amount,
      row?.taxes_file_url ?? null,
      row?.taxes_file_name ?? null,
      row?.taxes_note ?? null,
      row?.taxes_accepted_at ?? null
    ),
  };

  const kmitBn = sheets.kmitBn.amount ?? 0;
  const pozdnyakovaBn = sheets.pozdnyakovaBn.amount ?? 0;
  const utilities = sheets.utilities.amount ?? 0;
  const taxes = sheets.taxes.amount ?? 0;

  const income = round2(
    computed.totalRevenue +
      manual.otherIncome +
      manual.kmitCash +
      kmitBn +
      pozdnyakovaBn
  );
  const expenses = round2(
    computed.fuel +
      computed.otherExpenses +
      computed.royalty +
      computed.techSalariesTotal +
      manual.rentTotal +
      manual.salaryVolodymyr +
      manual.salaryTerebenets +
      manual.marketing +
      manual.simCards +
      staticCosts.amortAuto +
      staticCosts.filterCost +
      staticCosts.vchasno +
      staticCosts.salaryCallcenter +
      staticCosts.salaryTechdir +
      staticCosts.salaryFinmanager +
      staticCosts.salaryOlena +
      utilities +
      taxes
  );

  return {
    periodKey,
    periodLabel: periodKeyLabel(periodKey),
    months: listPnlMonths(),
    computed,
    manual,
    staticCosts,
    sheets,
    totals: {
      income,
      expenses,
      operatingProfit: round2(income - expenses),
    },
  };
}

export async function getPnlPage(periodKey = kyivPeriodKey()): Promise<PnlPage> {
  if (!isPeriodKey(periodKey)) {
    throw new Error("Некоректний місяць");
  }
  const [row, computed] = await Promise.all([
    loadRow(periodKey),
    getComputed(periodKey),
  ]);
  return mapPage(periodKey, row, computed);
}

export async function savePnlManual(
  periodKey: string,
  values: PnlManualValues,
  action: "save" | "accept" | "edit"
) {
  await ensurePnlRow(periodKey);
  const acceptedSql =
    action === "accept"
      ? prismadb.$executeRaw`
          UPDATE monthly_pnl SET
            other_income = ${values.otherIncome},
            kmit_cash = ${values.kmitCash},
            rent_total = ${values.rentTotal},
            salary_volodymyr = ${values.salaryVolodymyr},
            salary_terebenets = ${values.salaryTerebenets},
            marketing = ${values.marketing},
            sim_cards = ${values.simCards},
            manual_accepted_at = NOW(),
            updated_at = NOW()
          WHERE period_key = ${periodKey}`
      : action === "edit"
        ? prismadb.$executeRaw`
            UPDATE monthly_pnl SET
              other_income = ${values.otherIncome},
              kmit_cash = ${values.kmitCash},
              rent_total = ${values.rentTotal},
              salary_volodymyr = ${values.salaryVolodymyr},
              salary_terebenets = ${values.salaryTerebenets},
              marketing = ${values.marketing},
              sim_cards = ${values.simCards},
              manual_accepted_at = NULL,
              updated_at = NOW()
            WHERE period_key = ${periodKey}`
        : prismadb.$executeRaw`
            UPDATE monthly_pnl SET
              other_income = ${values.otherIncome},
              kmit_cash = ${values.kmitCash},
              rent_total = ${values.rentTotal},
              salary_volodymyr = ${values.salaryVolodymyr},
              salary_terebenets = ${values.salaryTerebenets},
              marketing = ${values.marketing},
              sim_cards = ${values.simCards},
              updated_at = NOW()
            WHERE period_key = ${periodKey}`;
  await acceptedSql;
  return getPnlPage(periodKey);
}

export async function savePnlStatic(
  periodKey: string,
  values: PnlStaticValues,
  action: "save" | "accept" | "edit"
) {
  await ensurePnlRow(periodKey);
  const acceptedSql =
    action === "accept"
      ? prismadb.$executeRaw`
          UPDATE monthly_pnl SET
            amort_auto = ${values.amortAuto},
            filter_cost = ${values.filterCost},
            vchasno = ${values.vchasno},
            salary_callcenter = ${values.salaryCallcenter},
            salary_techdir = ${values.salaryTechdir},
            salary_finmanager = ${values.salaryFinmanager},
            salary_olena = ${values.salaryOlena},
            static_accepted_at = NOW(),
            updated_at = NOW()
          WHERE period_key = ${periodKey}`
      : action === "edit"
        ? prismadb.$executeRaw`
            UPDATE monthly_pnl SET
              amort_auto = ${values.amortAuto},
              filter_cost = ${values.filterCost},
              vchasno = ${values.vchasno},
              salary_callcenter = ${values.salaryCallcenter},
              salary_techdir = ${values.salaryTechdir},
              salary_finmanager = ${values.salaryFinmanager},
              salary_olena = ${values.salaryOlena},
              static_accepted_at = NULL,
              updated_at = NOW()
            WHERE period_key = ${periodKey}`
        : prismadb.$executeRaw`
            UPDATE monthly_pnl SET
              amort_auto = ${values.amortAuto},
              filter_cost = ${values.filterCost},
              vchasno = ${values.vchasno},
              salary_callcenter = ${values.salaryCallcenter},
              salary_techdir = ${values.salaryTechdir},
              salary_finmanager = ${values.salaryFinmanager},
              salary_olena = ${values.salaryOlena},
              updated_at = NOW()
            WHERE period_key = ${periodKey}`;
  await acceptedSql;
  return getPnlPage(periodKey);
}

const SHEET_COLS: Record<
  PnlSheetKind,
  { amount: string; url: string; name: string; note: string; accepted: string }
> = {
  kmitBn: {
    amount: "kmit_bn_amount",
    url: "kmit_bn_file_url",
    name: "kmit_bn_file_name",
    note: "kmit_bn_note",
    accepted: "kmit_bn_accepted_at",
  },
  pozdnyakovaBn: {
    amount: "pozdnyakova_bn_amount",
    url: "pozdnyakova_bn_file_url",
    name: "pozdnyakova_bn_file_name",
    note: "pozdnyakova_bn_note",
    accepted: "pozdnyakova_bn_accepted_at",
  },
  utilities: {
    amount: "utilities_amount",
    url: "utilities_file_url",
    name: "utilities_file_name",
    note: "utilities_note",
    accepted: "utilities_accepted_at",
  },
  taxes: {
    amount: "taxes_amount",
    url: "taxes_file_url",
    name: "taxes_file_name",
    note: "taxes_note",
    accepted: "taxes_accepted_at",
  },
};

export function sheetAcceptedAt(row: PnlRow, kind: PnlSheetKind): Date | null {
  if (kind === "kmitBn") return row.kmit_bn_accepted_at;
  if (kind === "pozdnyakovaBn") return row.pozdnyakova_bn_accepted_at;
  if (kind === "utilities") return row.utilities_accepted_at;
  return row.taxes_accepted_at;
}

export async function savePnlSheetUpload(
  periodKey: string,
  kind: PnlSheetKind,
  input: { amount: number; fileUrl: string; fileName: string; note: string }
) {
  const row = await ensurePnlRow(periodKey);
  if (sheetAcceptedAt(row, kind)) {
    throw new Error("SHEET_LOCKED");
  }
  const c = SHEET_COLS[kind];
  await prismadb.$executeRawUnsafe(
    `UPDATE monthly_pnl SET
       ${c.amount} = $1,
       ${c.url} = $2,
       ${c.name} = $3,
       ${c.note} = $4,
       ${c.accepted} = NULL,
       updated_at = NOW()
     WHERE period_key = $5`,
    input.amount,
    input.fileUrl,
    input.fileName,
    input.note,
    periodKey
  );
  return getPnlPage(periodKey);
}

export async function savePnlSheetValues(
  periodKey: string,
  kind: PnlSheetKind,
  values: { amount: number; note: string },
  action: "save" | "accept" | "edit"
) {
  await ensurePnlRow(periodKey);
  const c = SHEET_COLS[kind];
  const acceptedExpr =
    action === "accept" ? "NOW()" : action === "edit" ? "NULL" : c.accepted;
  await prismadb.$executeRawUnsafe(
    `UPDATE monthly_pnl SET
       ${c.amount} = $1,
       ${c.note} = $2,
       ${c.accepted} = ${acceptedExpr},
       updated_at = NOW()
     WHERE period_key = $3`,
    values.amount,
    values.note,
    periodKey
  );
  return getPnlPage(periodKey);
}
