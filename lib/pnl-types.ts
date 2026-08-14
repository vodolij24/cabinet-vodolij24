import type { PnlSheetKind } from "@/lib/pnl-constants";

export type PnlSheetSlot = {
  amount: number | null;
  fileUrl: string | null;
  fileName: string | null;
  note: string | null;
  accepted: boolean;
  acceptedAt: string | null;
};

export type PnlPage = {
  periodKey: string;
  periodLabel: string;
  months: { value: string; label: string }[];
  computed: {
    cashRevenue: number;
    cashlessRevenue: number;
    totalRevenue: number;
    fuel: number;
    otherExpenses: number;
    royalty: number;
    techSalaries: { workerId: number; name: string; amount: number }[];
    techSalariesTotal: number;
  };
  manual: {
    otherIncome: number;
    kmitCash: number;
    rentTotal: number;
    salaryVolodymyr: number;
    salaryTerebenets: number;
    marketing: number;
    simCards: number;
    accepted: boolean;
    acceptedAt: string | null;
  };
  staticCosts: {
    amortAuto: number;
    filterCost: number;
    vchasno: number;
    salaryCallcenter: number;
    salaryTechdir: number;
    salaryFinmanager: number;
    salaryOlena: number;
    accepted: boolean;
    acceptedAt: string | null;
  };
  sheets: Record<PnlSheetKind, PnlSheetSlot>;
  totals: {
    income: number;
    expenses: number;
    operatingProfit: number;
  };
};

export type PnlManualValues = {
  otherIncome: number;
  kmitCash: number;
  rentTotal: number;
  salaryVolodymyr: number;
  salaryTerebenets: number;
  marketing: number;
  simCards: number;
};

export type PnlStaticValues = {
  amortAuto: number;
  filterCost: number;
  vchasno: number;
  salaryCallcenter: number;
  salaryTechdir: number;
  salaryFinmanager: number;
  salaryOlena: number;
};
