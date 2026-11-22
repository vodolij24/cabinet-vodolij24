import { getPnlPage } from "@/lib/pnl";
import {
  kyivPeriodKey,
  periodKeyLabel,
  shiftPeriodKey,
} from "@/lib/pnl-constants";
import type { PnlPage } from "@/lib/pnl-types";

const SHORT_MONTHS = [
  "січ.",
  "лют.",
  "бер.",
  "квіт.",
  "трав.",
  "черв.",
  "лип.",
  "серп.",
  "вер.",
  "жовт.",
  "лист.",
  "груд.",
] as const;

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

function shortMonthLabel(periodKey: string) {
  const [year, month] = periodKey.split("-").map(Number);
  const name = SHORT_MONTHS[month - 1] ?? periodKey;
  return `${name} ${String(year).slice(2)}`;
}

function fundsFromPage(page: PnlPage) {
  const salary = round2(
    page.computed.techSalariesTotal +
      page.techDirectorBonus.amount +
      page.manual.salaryVolodymyr +
      page.manual.salaryTerebenets +
      page.manual.salaryDudar +
      page.manual.salaryOlenaManual +
      page.staticCosts.salaryCallcenter +
      page.staticCosts.salaryTechdir +
      page.staticCosts.salaryFinmanager +
      page.staticCosts.salaryOlena +
      page.terebenetsKasaCosts.salary +
      page.kmitKasaCosts.salary
  );
  const rent = round2(
    page.manual.rentTotal +
      page.computed.paymentCalendar.rent +
      page.pozdnyakovaBnCosts.rent +
      page.kmitBnCosts.rent +
      page.terebenetsKasaCosts.rent
  );
  const utilities = round2(
    (page.sheets.utilities.amount ?? 0) +
      page.computed.paymentCalendar.utilities +
      page.pozdnyakovaBnCosts.utilities +
      page.kmitBnCosts.utilities +
      page.terebenetsKasaCosts.utilities +
      page.kmitKasaCosts.utilities
  );

  return {
    salary,
    rent,
    utilities,
    total: round2(salary + rent + utilities),
  };
}

export type ExpenseFundMonth = {
  periodKey: string;
  label: string;
  shortLabel: string;
  salary: number;
  rent: number;
  utilities: number;
  total: number;
};

export type ExpenseFundsReport = {
  months: ExpenseFundMonth[];
  totals: {
    salary: number;
    rent: number;
    utilities: number;
    total: number;
  };
};

/** Три попередні повні місяці, від старішого до новішого. */
export async function getExpenseFundsReport(
  now = new Date()
): Promise<ExpenseFundsReport> {
  const current = kyivPeriodKey(now);
  const keys = [3, 2, 1].map((monthsAgo) => shiftPeriodKey(current, -monthsAgo));
  const pages = await Promise.all(keys.map((key) => getPnlPage(key)));

  const months = pages.map((page) => ({
    periodKey: page.periodKey,
    label: periodKeyLabel(page.periodKey),
    shortLabel: shortMonthLabel(page.periodKey),
    ...fundsFromPage(page),
  }));

  const totals = months.reduce(
    (acc, month) => ({
      salary: round2(acc.salary + month.salary),
      rent: round2(acc.rent + month.rent),
      utilities: round2(acc.utilities + month.utilities),
      total: round2(acc.total + month.total),
    }),
    { salary: 0, rent: 0, utilities: 0, total: 0 }
  );

  return { months, totals };
}
