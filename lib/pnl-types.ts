import type { PnlSheetKind } from "@/lib/pnl-constants";
import type { PaymentCalendarPnlTotals } from "@/lib/payment-requests-shared";

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
    paymentCalendar: PaymentCalendarPnlTotals;
  };
  channels: {
    terebenetsCash: number;
    terebenetsCashless: number;
    kmitCashless: number;
    kmitCash: number;
    pozdnyakovaCashless: number;
    accepted: boolean;
    acceptedAt: string | null;
  };
  manual: {
    otherIncome: number;
    rentTotal: number;
    salaryVolodymyr: number;
    salaryTerebenets: number;
    marketing: number;
    simCards: number;
    fuelKmit: number;
    currentKmit: number;
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
  kmitBnCosts: PnlBnCosts;
  pozdnyakovaBnCosts: PnlBnCosts;
  terebenetsKasaCosts: PnlTerebenetsKasaCosts;
  techDirectorBonus: {
    amount: number;
    updatedAt: string | null;
  };
  opsDirectorSalary: {
    amount: number;
    updatedAt: string | null;
  };
  sheets: Record<PnlSheetKind, PnlSheetSlot>;
  totals: {
    income: number;
    expenses: number;
    operatingProfit: number;
  };
};

export type PnlBnCostValues = {
  utilities: number;
  rent: number;
  taxes: number;
  bankFee: number;
  other: number;
};

export type PnlBnCosts = PnlBnCostValues & {
  accepted: boolean;
  acceptedAt: string | null;
};

export type PnlTerebenetsKasaValues = PnlBnCostValues & {
  marketing: number;
  salary: number;
  credit: number;
  fuel: number;
  cashMovement: number;
  printing: number;
  currentExpenses: number;
};

export type PnlTerebenetsKasaCosts = PnlTerebenetsKasaValues & {
  accepted: boolean;
  acceptedAt: string | null;
};

export type PnlChannelValues = {
  terebenetsCash: number;
  terebenetsCashless: number;
  kmitCashless: number;
  kmitCash: number;
  pozdnyakovaCashless: number;
};

export type PnlManualValues = {
  otherIncome: number;
  rentTotal: number;
  salaryVolodymyr: number;
  salaryTerebenets: number;
  marketing: number;
  simCards: number;
  fuelKmit: number;
  currentKmit: number;
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
