"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import axios from "axios";
import { toast } from "react-hot-toast";
import { ChevronDown, ChevronRight, RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  PNL_SHEET_KINDS,
  PNL_SHEET_LABELS,
  PNL_SHEET_SIGN,
  PNL_TECHDIR_BONUS_RATE,
  type PnlSheetKind,
} from "@/lib/pnl-constants";
import type {
  PnlBnCosts,
  PnlPage,
  PnlTerebenetsKasaCosts,
} from "@/lib/pnl-types";
import type {
  PaymentCalendarPnlTotals,
  PaymentPnlTarget,
} from "@/lib/payment-requests-shared";

function money(n: number) {
  return `${n.toLocaleString("uk-UA", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} грн`;
}

function Line({
  label,
  value,
  hint,
}: {
  label: string;
  value: number;
  hint?: string;
}) {
  return (
    <div className="flex items-start justify-between gap-3 py-1.5">
      <div>
        <p className="text-sm">{label}</p>
        {hint ? (
          <p className="text-xs text-muted-foreground">{hint}</p>
        ) : null}
      </div>
      <p className="shrink-0 tabular-nums text-sm font-medium">{money(value)}</p>
    </div>
  );
}

function MoneyField({
  label,
  value,
  disabled,
  onChange,
}: {
  label: string;
  value: number;
  disabled: boolean;
  onChange: (v: string) => void;
}) {
  return (
    <div className="space-y-1">
      <label className="text-sm text-muted-foreground">{label}</label>
      <Input
        type="number"
        min={0}
        step="0.01"
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

function num(v: string | number) {
  const n =
    typeof v === "number"
      ? v
      : parseFloat(String(v).replace(",", ".").replace(/\s/g, ""));
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) / 100 : 0;
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

type BalLine = {
  label: string;
  amount: number;
  hint?: string;
  indent?: boolean;
  skipSum?: boolean;
};

function calendarBalLines(
  pc: PaymentCalendarPnlTotals,
  target: PaymentPnlTarget
): BalLine[] {
  return pc.lines
    .filter((line) => line.target === target)
    .map((line) => ({
      label: line.title,
      amount: line.amount,
      hint: `календар · ${line.categoryLabel}${
        line.paidByName ? ` · ${line.paidByName}` : ""
      }`,
      indent: true,
      skipSum: true,
    }));
}

export function PnlClient({ initial }: { initial: PnlPage }) {
  const router = useRouter();
  const [data, setData] = useState(initial);
  const [busy, setBusy] = useState<string | null>(null);
  const [openTech, setOpenTech] = useState(false);
  const [channels, setChannels] = useState(initial.channels);
  const [kmitBnCosts, setKmitBnCosts] = useState(initial.kmitBnCosts);
  const [pozdnyakovaBnCosts, setPozdnyakovaBnCosts] = useState(
    initial.pozdnyakovaBnCosts
  );
  const [terebenetsKasaCosts, setTerebenetsKasaCosts] = useState(
    initial.terebenetsKasaCosts
  );
  const [manual, setManual] = useState(initial.manual);
  const [staticCosts, setStaticCosts] = useState(initial.staticCosts);
  const [sheetDraft, setSheetDraft] = useState(initial.sheets);
  const fileRefs = useRef<Record<string, HTMLInputElement | null>>({});

  useEffect(() => {
    setData(initial);
    setChannels(initial.channels);
    setKmitBnCosts(initial.kmitBnCosts);
    setPozdnyakovaBnCosts(initial.pozdnyakovaBnCosts);
    setTerebenetsKasaCosts(initial.terebenetsKasaCosts);
    setManual(initial.manual);
    setStaticCosts(initial.staticCosts);
    setSheetDraft(initial.sheets);
  }, [initial]);

  const patch = async (payload: Record<string, unknown>, key: string) => {
    try {
      setBusy(key);
      const { data: next } = await axios.patch<PnlPage>("/api/pnl", {
        periodKey: data.periodKey,
        ...payload,
      });
      setData(next);
      setChannels(next.channels);
      setKmitBnCosts(next.kmitBnCosts);
      setPozdnyakovaBnCosts(next.pozdnyakovaBnCosts);
      setTerebenetsKasaCosts(next.terebenetsKasaCosts);
      setManual(next.manual);
      setStaticCosts(next.staticCosts);
      setSheetDraft(next.sheets);
      toast.success(
        payload.section === "techDirectorBonus"
          ? "Оновлено З/П директорів"
          : payload.action === "accept"
            ? "Прийнято"
            : payload.action === "edit"
              ? "Відкрито для редагування"
              : "Збережено"
      );
    } catch (error) {
      const message =
        axios.isAxiosError(error) && typeof error.response?.data === "string"
          ? error.response.data
          : "Не вдалося зберегти";
      toast.error(message);
    } finally {
      setBusy(null);
    }
  };

  const uploadSheet = async (kind: PnlSheetKind, file: File) => {
    const fd = new FormData();
    fd.append("periodKey", data.periodKey);
    fd.append("kind", kind);
    fd.append("file", file);
    try {
      setBusy(`sheet-${kind}`);
      const { data: next } = await axios.post<PnlPage>("/api/pnl/sheet", fd);
      setData(next);
      setChannels(next.channels);
      setSheetDraft(next.sheets);
      toast.success("Таблицю розібрано — перевірте суму і прийміть");
    } catch (error) {
      const message =
        axios.isAxiosError(error) && typeof error.response?.data === "string"
          ? error.response.data
          : "Не вдалося розібрати файл";
      toast.error(message);
    } finally {
      setBusy(null);
    }
  };

  const live = useMemo(() => {
    const pc = data.computed.paymentCalendar;
    const income: BalLine[] = [
      {
        label: "Виторг готівка",
        amount: data.computed.cashRevenue,
        hint: "автомати · БД",
      },
      {
        label: "Виторг безготівка",
        amount: data.computed.cashlessRevenue,
        hint: "автомати · БД",
      },
      { label: "Інші доходи", amount: manual.otherIncome, hint: "вручну" },
    ];
    const expenses: BalLine[] = [
      {
        label: "Паливо",
        amount: data.computed.fuel,
        hint: "витрати техніків · БД",
      },
      {
        label: "Поточні витрати",
        amount: data.computed.otherExpenses,
        hint:
          pc.other > 0
            ? "техніки · БД + календар"
            : "витрати техніків · БД",
      },
      ...calendarBalLines(pc, "other"),
      {
        label: "Роялті 5%",
        amount: data.computed.royalty,
        hint: "від виторгу автоматів",
      },
      {
        label: "З/П техніків",
        amount: data.computed.techSalariesTotal,
        hint: "ставка + премія + ручні − утримання",
      },
      ...data.computed.techSalaries.map(
        (t): BalLine => ({
          label: t.name,
          amount: t.amount,
          indent: true,
          skipSum: true,
        })
      ),
      {
        label: "Премія технічний директор",
        amount: data.techDirectorBonus.amount,
        hint: "7% від перерахунку",
      },
      {
        label: "З/П Операційний директор",
        amount: data.opsDirectorSalary.amount,
        hint: "З/П техдір + премія",
      },
      {
        label: "Загальна оренда",
        amount: manual.rentTotal + pc.rent,
        hint: pc.rent > 0 ? "вручну + календар" : "вручну",
      },
      ...calendarBalLines(pc, "rent"),
      {
        label: "З/П Володимир склад",
        amount: manual.salaryVolodymyr,
        hint: "вручну",
      },
      {
        label: "З/П Теребинець",
        amount: manual.salaryTerebenets,
        hint: "вручну",
      },
      { label: "Маркетинг", amount: manual.marketing, hint: "вручну" },
      {
        label: "Сімкарти автомати + підтримка",
        amount: manual.simCards,
        hint: "вручну",
      },
      {
        label: "Паливо Кміть",
        amount: manual.fuelKmit,
        hint: "вручну",
      },
      {
        label: "Поточні витрати Кміть",
        amount: manual.currentKmit,
        hint: "вручну",
      },
      { label: "Амортизація авто", amount: staticCosts.amortAuto },
      { label: "Витрати фільтра", amount: staticCosts.filterCost },
      { label: "Вчасно", amount: staticCosts.vchasno },
      { label: "З/П колцентру", amount: staticCosts.salaryCallcenter },
      { label: "З/П техдір", amount: staticCosts.salaryTechdir },
      { label: "З/П фін менеджер", amount: staticCosts.salaryFinmanager },
      { label: "З/П лічильники Олена", amount: staticCosts.salaryOlena },
      {
        label: PNL_SHEET_LABELS.utilities,
        amount: (sheetDraft.utilities.amount ?? 0) + pc.utilities,
        hint: pc.utilities > 0 ? "таблиця + календар" : "таблиця",
      },
      ...calendarBalLines(pc, "utilities"),
      {
        label: PNL_SHEET_LABELS.taxes,
        amount: (sheetDraft.taxes.amount ?? 0) + pc.taxes,
        hint: pc.taxes > 0 ? "таблиця + календар" : "таблиця",
      },
      ...calendarBalLines(pc, "taxes"),
      {
        label: "Позднякова · комунальні",
        amount: pozdnyakovaBnCosts.utilities,
        hint: "безготівка · витрата",
      },
      {
        label: "Позднякова · оренда",
        amount: pozdnyakovaBnCosts.rent,
        hint: "безготівка · витрата",
      },
      {
        label: "Позднякова · податки",
        amount: pozdnyakovaBnCosts.taxes,
        hint: "безготівка · витрата",
      },
      {
        label: "Позднякова · банк комісія",
        amount: pozdnyakovaBnCosts.bankFee,
        hint: "безготівка · витрата",
      },
      {
        label: "Позднякова · інше",
        amount: pozdnyakovaBnCosts.other,
        hint: "безготівка · витрата",
      },
      {
        label: "Кміть · комунальні",
        amount: kmitBnCosts.utilities,
        hint: "безготівка · витрата",
      },
      {
        label: "Кміть · оренда",
        amount: kmitBnCosts.rent,
        hint: "безготівка · витрата",
      },
      {
        label: "Кміть · податки",
        amount: kmitBnCosts.taxes,
        hint: "безготівка · витрата",
      },
      {
        label: "Кміть · банк комісія",
        amount: kmitBnCosts.bankFee,
        hint: "безготівка · витрата",
      },
      {
        label: "Кміть · інше",
        amount: kmitBnCosts.other,
        hint: "безготівка · витрата",
      },
      {
        label: "Каса Теребенець · комунальні",
        amount: terebenetsKasaCosts.utilities,
        hint: "каса · витрата",
      },
      {
        label: "Каса Теребенець · оренда",
        amount: terebenetsKasaCosts.rent,
        hint: "каса · витрата",
      },
      {
        label: "Каса Теребенець · податки",
        amount: terebenetsKasaCosts.taxes,
        hint: "каса · витрата",
      },
      {
        label: "Каса Теребенець · банк комісія",
        amount: terebenetsKasaCosts.bankFee,
        hint: "каса · витрата",
      },
      {
        label: "Каса Теребенець · інше",
        amount: terebenetsKasaCosts.other,
        hint: "каса · витрата",
      },
      {
        label: "Каса Теребенець · маркетинг",
        amount: terebenetsKasaCosts.marketing,
        hint: "каса · витрата",
      },
      {
        label: "Каса Теребенець · зарплата",
        amount: terebenetsKasaCosts.salary,
        hint: "каса · витрата",
      },
      {
        label: "Каса Теребенець · кредит",
        amount: terebenetsKasaCosts.credit,
        hint: "каса · витрата",
      },
      {
        label: "Каса Теребенець · паливо",
        amount: terebenetsKasaCosts.fuel,
        hint: "каса · витрата",
      },
      {
        label: "Каса Теребенець · поліграфія",
        amount: terebenetsKasaCosts.printing,
        hint: "каса · витрата",
      },
      {
        label: "Каса Теребенець · поточні витрати",
        amount: terebenetsKasaCosts.currentExpenses,
        hint: "каса · витрата",
      },
    ];
    const incomeTotal = round2(
      income.reduce((s, r) => s + (r.skipSum ? 0 : r.amount), 0)
    );
    const expenseTotal = round2(
      expenses.reduce((s, r) => s + (r.skipSum ? 0 : r.amount), 0)
    );
    return {
      income,
      expenses,
      incomeTotal,
      expenseTotal,
      profit: round2(incomeTotal - expenseTotal),
    };
  }, [data.computed, data.techDirectorBonus, data.opsDirectorSalary, manual, staticCosts, sheetDraft, kmitBnCosts, pozdnyakovaBnCosts, terebenetsKasaCosts]);

  const profit = live.profit;
  const actualIncome = round2(
    channels.terebenetsCash +
      channels.terebenetsCashless +
      channels.kmitCashless +
      channels.kmitCash +
      channels.pozdnyakovaCashless
  );
  const recastProfit = round2(actualIncome - live.expenseTotal);
  const recastBase = round2(
    actualIncome -
      (live.expenseTotal -
        data.techDirectorBonus.amount -
        data.opsDirectorSalary.amount)
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-1">
          <label className="text-sm text-muted-foreground">Місяць</label>
          <Select
            value={data.periodKey}
            onValueChange={(v) => router.push(`/pnl?period=${v}`)}
          >
            <SelectTrigger className="w-[240px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {data.months.map((m) => (
                <SelectItem key={m.value} value={m.value}>
                  {m.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-wrap items-stretch gap-3">
          <ProfitBox
            title="Операційний прибуток"
            profit={profit}
            income={live.incomeTotal}
            expenses={live.expenseTotal}
          />
          <ProfitBox
            title="Перерахунок від фактичних надходжень"
            profit={recastProfit}
            income={actualIncome}
            expenses={live.expenseTotal}
          />
        </div>
      </div>

      <section className="rounded-xl border bg-card p-4 shadow-sm">
        <h3 className="mb-2 font-medium">Виторг з автоматів</h3>
        <Line label="Виторг готівка" value={data.computed.cashRevenue} />
        <Line label="Виторг безготівка" value={data.computed.cashlessRevenue} />
        <Line label="Загальний виторг" value={data.computed.totalRevenue} />
      </section>

      <section className="rounded-xl border bg-card p-4 shadow-sm">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="font-medium">Каса / безготівка</h3>
            <p className="text-xs text-muted-foreground">
              Для перерахунку від фактичних надходжень
            </p>
          </div>
          <FormActions
            accepted={channels.accepted}
            busy={busy === "channels"}
            onSave={() =>
              void patch(
                { section: "channels", action: "save", ...channels },
                "channels"
              )
            }
            onAccept={() =>
              void patch(
                { section: "channels", action: "accept", ...channels },
                "channels"
              )
            }
            onEdit={() =>
              void patch(
                { section: "channels", action: "edit", ...channels },
                "channels"
              )
            }
          />
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <MoneyField
            label="Готівка Теребенець"
            value={channels.terebenetsCash}
            disabled={channels.accepted}
            onChange={(v) =>
              setChannels((s) => ({ ...s, terebenetsCash: num(v) }))
            }
          />
          <MoneyField
            label="Безготівка Теребенець"
            value={channels.terebenetsCashless}
            disabled={channels.accepted}
            onChange={(v) =>
              setChannels((s) => ({ ...s, terebenetsCashless: num(v) }))
            }
          />
          <MoneyField
            label="Безготівка Кміть"
            value={channels.kmitCashless}
            disabled={channels.accepted}
            onChange={(v) =>
              setChannels((s) => ({ ...s, kmitCashless: num(v) }))
            }
          />
          <MoneyField
            label="Готівка Кміть"
            value={channels.kmitCash}
            disabled={channels.accepted}
            onChange={(v) => setChannels((s) => ({ ...s, kmitCash: num(v) }))}
          />
          <MoneyField
            label="Безготівка Позднякова"
            value={channels.pozdnyakovaCashless}
            disabled={channels.accepted}
            onChange={(v) =>
              setChannels((s) => ({ ...s, pozdnyakovaCashless: num(v) }))
            }
          />
        </div>
      </section>

      <BnCostBlock
        title="Безготівка Позднякова"
        hint="Витрати з рахунку ФОП. Входять у зелений прибуток."
        costs={pozdnyakovaBnCosts}
        busy={busy === "pozdnyakovaBnCosts"}
        onChange={setPozdnyakovaBnCosts}
        onSave={() =>
          void patch(
            {
              section: "pozdnyakovaBnCosts",
              action: "save",
              ...pozdnyakovaBnCosts,
            },
            "pozdnyakovaBnCosts"
          )
        }
        onAccept={() =>
          void patch(
            {
              section: "pozdnyakovaBnCosts",
              action: "accept",
              ...pozdnyakovaBnCosts,
            },
            "pozdnyakovaBnCosts"
          )
        }
        onEdit={() =>
          void patch(
            {
              section: "pozdnyakovaBnCosts",
              action: "edit",
              ...pozdnyakovaBnCosts,
            },
            "pozdnyakovaBnCosts"
          )
        }
      />

      <BnCostBlock
        title="Безготівка Кміть"
        hint="Витрати з рахунку ФОП. Входять у зелений прибуток."
        costs={kmitBnCosts}
        busy={busy === "kmitBnCosts"}
        onChange={setKmitBnCosts}
        onSave={() =>
          void patch(
            { section: "kmitBnCosts", action: "save", ...kmitBnCosts },
            "kmitBnCosts"
          )
        }
        onAccept={() =>
          void patch(
            { section: "kmitBnCosts", action: "accept", ...kmitBnCosts },
            "kmitBnCosts"
          )
        }
        onEdit={() =>
          void patch(
            { section: "kmitBnCosts", action: "edit", ...kmitBnCosts },
            "kmitBnCosts"
          )
        }
      />

      <TerebenetsKasaBlock
        costs={terebenetsKasaCosts}
        busy={busy === "terebenetsKasaCosts"}
        onChange={setTerebenetsKasaCosts}
        onSave={() =>
          void patch(
            {
              section: "terebenetsKasaCosts",
              action: "save",
              ...terebenetsKasaCosts,
            },
            "terebenetsKasaCosts"
          )
        }
        onAccept={() =>
          void patch(
            {
              section: "terebenetsKasaCosts",
              action: "accept",
              ...terebenetsKasaCosts,
            },
            "terebenetsKasaCosts"
          )
        }
        onEdit={() =>
          void patch(
            {
              section: "terebenetsKasaCosts",
              action: "edit",
              ...terebenetsKasaCosts,
            },
            "terebenetsKasaCosts"
          )
        }
      />

      <section className="rounded-xl border bg-card p-4 shadow-sm">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-medium">Ручні суми</h3>
          <FormActions
            accepted={manual.accepted}
            busy={busy === "manual"}
            onSave={() =>
              void patch({ section: "manual", action: "save", ...manual }, "manual")
            }
            onAccept={() =>
              void patch(
                { section: "manual", action: "accept", ...manual },
                "manual"
              )
            }
            onEdit={() =>
              void patch({ section: "manual", action: "edit", ...manual }, "manual")
            }
          />
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <MoneyField
            label="Інші доходи"
            value={manual.otherIncome}
            disabled={manual.accepted}
            onChange={(v) => setManual((s) => ({ ...s, otherIncome: num(v) }))}
          />
          <MoneyField
            label="Загальна оренда"
            value={manual.rentTotal}
            disabled={manual.accepted}
            onChange={(v) => setManual((s) => ({ ...s, rentTotal: num(v) }))}
          />
          <MoneyField
            label="З/П Володимир склад"
            value={manual.salaryVolodymyr}
            disabled={manual.accepted}
            onChange={(v) =>
              setManual((s) => ({ ...s, salaryVolodymyr: num(v) }))
            }
          />
          <MoneyField
            label="З/П Теребинець"
            value={manual.salaryTerebenets}
            disabled={manual.accepted}
            onChange={(v) =>
              setManual((s) => ({ ...s, salaryTerebenets: num(v) }))
            }
          />
          <MoneyField
            label="Маркетинг"
            value={manual.marketing}
            disabled={manual.accepted}
            onChange={(v) => setManual((s) => ({ ...s, marketing: num(v) }))}
          />
          <MoneyField
            label="Сімкарти автомати + підтримка"
            value={manual.simCards}
            disabled={manual.accepted}
            onChange={(v) => setManual((s) => ({ ...s, simCards: num(v) }))}
          />
          <MoneyField
            label="Паливо Кміть"
            value={manual.fuelKmit}
            disabled={manual.accepted}
            onChange={(v) => setManual((s) => ({ ...s, fuelKmit: num(v) }))}
          />
          <MoneyField
            label="Поточні витрати Кміть"
            value={manual.currentKmit}
            disabled={manual.accepted}
            onChange={(v) => setManual((s) => ({ ...s, currentKmit: num(v) }))}
          />
        </div>
      </section>

      <section className="rounded-xl border bg-card p-4 shadow-sm">
        <h3 className="mb-2 font-medium">З бази кабінету</h3>
        <Line label="Паливо" value={data.computed.fuel} hint="Витрати техніків" />
        <Line
          label="Поточні витрати"
          value={data.computed.otherExpenses}
          hint="Інші витрати техніків"
        />
        <Line
          label="Роялті 5%"
          value={data.computed.royalty}
          hint="Від загального виторгу автоматів"
        />
        <button
          type="button"
          className="mt-2 flex w-full items-center justify-between rounded-lg bg-muted/50 px-3 py-2 text-left"
          onClick={() => setOpenTech((v) => !v)}
        >
          <span className="flex items-center gap-2 text-sm">
            {openTech ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
            З/П техніків
          </span>
          <span className="tabular-nums text-sm font-medium">
            {money(data.computed.techSalariesTotal)}
          </span>
        </button>
        {openTech ? (
          <div className="mt-2 px-1">
            {data.computed.techSalaries.length === 0 ? (
              <p className="text-sm text-muted-foreground">Немає нарахувань</p>
            ) : (
              data.computed.techSalaries.map((t) => (
                <Line key={t.workerId} label={t.name} value={t.amount} />
              ))
            )}
          </div>
        ) : null}
        <div className="mt-2 flex items-start justify-between gap-3 py-1.5">
          <div>
            <p className="text-sm">Премія технічний директор</p>
            <p className="text-xs text-muted-foreground">
              {Math.round(PNL_TECHDIR_BONUS_RATE * 100)}% від перерахунку
              фактичних надходжень
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={busy === "techDirectorBonus"}
              onClick={() => {
                const bonus = round2(
                  Math.max(0, recastBase) * PNL_TECHDIR_BONUS_RATE
                );
                void patch(
                  {
                    section: "techDirectorBonus",
                    action: "save",
                    amount: bonus,
                    opsDirectorSalary: round2(
                      staticCosts.salaryTechdir + bonus
                    ),
                  },
                  "techDirectorBonus"
                );
              }}
            >
              <RefreshCw className="mr-1 h-3.5 w-3.5" />
              Оновити
            </Button>
            <p className="tabular-nums text-sm font-medium">
              {money(data.techDirectorBonus.amount)}
            </p>
          </div>
        </div>
        <Line
          label="З/П Операційний директор"
          value={data.opsDirectorSalary.amount}
          hint="З/П техдір + премія технічний директор"
        />
      </section>

      <section className="rounded-xl border bg-card p-4 shadow-sm">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-medium">Постійні витрати</h3>
          <FormActions
            accepted={staticCosts.accepted}
            busy={busy === "static"}
            onSave={() =>
              void patch(
                { section: "static", action: "save", ...staticCosts },
                "static"
              )
            }
            onAccept={() =>
              void patch(
                { section: "static", action: "accept", ...staticCosts },
                "static"
              )
            }
            onEdit={() =>
              void patch(
                { section: "static", action: "edit", ...staticCosts },
                "static"
              )
            }
          />
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <MoneyField
            label="Амортизація авто"
            value={staticCosts.amortAuto}
            disabled={staticCosts.accepted}
            onChange={(v) =>
              setStaticCosts((s) => ({ ...s, amortAuto: num(v) }))
            }
          />
          <MoneyField
            label="Витрати фільтра"
            value={staticCosts.filterCost}
            disabled={staticCosts.accepted}
            onChange={(v) =>
              setStaticCosts((s) => ({ ...s, filterCost: num(v) }))
            }
          />
          <MoneyField
            label="Вчасно"
            value={staticCosts.vchasno}
            disabled={staticCosts.accepted}
            onChange={(v) => setStaticCosts((s) => ({ ...s, vchasno: num(v) }))}
          />
          <MoneyField
            label="З/П колцентру"
            value={staticCosts.salaryCallcenter}
            disabled={staticCosts.accepted}
            onChange={(v) =>
              setStaticCosts((s) => ({ ...s, salaryCallcenter: num(v) }))
            }
          />
          <MoneyField
            label="З/П техдір"
            value={staticCosts.salaryTechdir}
            disabled={staticCosts.accepted}
            onChange={(v) =>
              setStaticCosts((s) => ({ ...s, salaryTechdir: num(v) }))
            }
          />
          <MoneyField
            label="З/П фін менеджер"
            value={staticCosts.salaryFinmanager}
            disabled={staticCosts.accepted}
            onChange={(v) =>
              setStaticCosts((s) => ({ ...s, salaryFinmanager: num(v) }))
            }
          />
          <MoneyField
            label="З/П лічильники Олена"
            value={staticCosts.salaryOlena}
            disabled={staticCosts.accepted}
            onChange={(v) =>
              setStaticCosts((s) => ({ ...s, salaryOlena: num(v) }))
            }
          />
        </div>
      </section>

      <section className="space-y-3">
        <h3 className="font-medium">Таблиці (ШІ аналіз)</h3>
        <p className="text-sm text-muted-foreground">
          Кміть БН і Позднякова БН підставляють суми в блок «Каса / безготівка».
          Комуналка і податки лишаються витратами.
        </p>
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          {PNL_SHEET_KINDS.map((kind) => {
            const slot = sheetDraft[kind];
            const locked = slot.accepted;
            const sign = PNL_SHEET_SIGN[kind];
            return (
              <div key={kind} className="rounded-xl border bg-card p-4 shadow-sm">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-medium">{PNL_SHEET_LABELS[kind]}</p>
                    <p className="text-xs text-muted-foreground">
                      {sign === "income" ? "Дохід" : "Витрата"}
                    </p>
                  </div>
                  <FormActions
                    accepted={locked}
                    busy={busy === `sheet-${kind}`}
                    onSave={() =>
                      void patch(
                        {
                          section: "sheet",
                          action: "save",
                          kind,
                          amount: slot.amount ?? 0,
                          note: slot.note ?? "",
                        },
                        `sheet-${kind}`
                      )
                    }
                    onAccept={() =>
                      void patch(
                        {
                          section: "sheet",
                          action: "accept",
                          kind,
                          amount: slot.amount ?? 0,
                          note: slot.note ?? "",
                        },
                        `sheet-${kind}`
                      )
                    }
                    onEdit={() =>
                      void patch(
                        {
                          section: "sheet",
                          action: "edit",
                          kind,
                          amount: slot.amount ?? 0,
                          note: slot.note ?? "",
                        },
                        `sheet-${kind}`
                      )
                    }
                  />
                </div>
                <MoneyField
                  label="Сума"
                  value={slot.amount ?? 0}
                  disabled={locked}
                  onChange={(v) =>
                    setSheetDraft((s) => ({
                      ...s,
                      [kind]: { ...s[kind], amount: num(v) },
                    }))
                  }
                />
                {slot.note ? (
                  <p className="mt-2 text-xs text-muted-foreground">{slot.note}</p>
                ) : null}
                {slot.fileName ? (
                  <p className="mt-1 text-xs text-muted-foreground">
                    Файл: {slot.fileName}
                    {slot.fileUrl ? (
                      <>
                        {" · "}
                        <a
                          href={slot.fileUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="underline"
                        >
                          відкрити
                        </a>
                      </>
                    ) : null}
                  </p>
                ) : null}
                <input
                  ref={(el) => {
                    fileRefs.current[kind] = el;
                  }}
                  type="file"
                  accept=".xlsx,.xls,.csv,.ods"
                  className="hidden"
                  disabled={locked}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    e.target.value = "";
                    if (file) void uploadSheet(kind, file);
                  }}
                />
                <Button
                  className="mt-3"
                  size="sm"
                  variant="outline"
                  disabled={locked || busy === `sheet-${kind}`}
                  onClick={() => fileRefs.current[kind]?.click()}
                >
                  Завантажити таблицю
                </Button>
              </div>
            );
          })}
        </div>
      </section>

      <BalanceTable
        live={live}
        recast={{ income: actualIncome, profit: recastProfit }}
      />
    </div>
  );
}

function BalanceColumn({
  title,
  totalLabel,
  rows,
  total,
  tone,
}: {
  title: string;
  totalLabel: string;
  rows: BalLine[];
  total: number;
  tone: "income" | "expense";
}) {
  const head =
    tone === "income"
      ? "bg-emerald-600 text-white"
      : "bg-rose-600 text-white";
  const wrap =
    tone === "income"
      ? "border-emerald-200 dark:border-emerald-900"
      : "border-rose-200 dark:border-rose-900";
  const sumRow =
    tone === "income"
      ? "bg-emerald-100 text-emerald-950 dark:bg-emerald-950/70 dark:text-emerald-100"
      : "bg-rose-100 text-rose-950 dark:bg-rose-950/70 dark:text-rose-100";
  const amountClass =
    tone === "income"
      ? "text-emerald-700 dark:text-emerald-300"
      : "text-rose-700 dark:text-rose-300";

  return (
    <div className={`overflow-hidden rounded-xl border ${wrap}`}>
      <div className={`px-4 py-2.5 text-sm font-semibold ${head}`}>{title}</div>
      <table className="w-full text-sm">
        <tbody>
          {rows.map((row, i) => (
            <tr
              key={`${row.label}-${i}`}
              className={
                row.indent
                  ? "bg-muted/30 text-muted-foreground"
                  : "odd:bg-background even:bg-muted/20"
              }
            >
              <td
                className={`py-1.5 pr-2 ${row.indent ? "pl-8" : "pl-4"} align-top`}
              >
                <span>{row.label}</span>
                {row.hint ? (
                  <span className="ml-1 text-xs text-muted-foreground">
                    · {row.hint}
                  </span>
                ) : null}
              </td>
              <td
                className={`py-1.5 pr-4 text-right tabular-nums ${
                  row.indent ? "" : amountClass
                } ${row.amount === 0 && !row.indent ? "opacity-40" : ""}`}
              >
                {money(row.amount)}
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className={sumRow}>
            <td className="px-4 py-2.5 font-semibold">{totalLabel}</td>
            <td className="px-4 py-2.5 text-right font-semibold tabular-nums">
              {money(total)}
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

function ProfitBox({
  title,
  profit,
  income,
  expenses,
  layout = "compact",
}: {
  title: string;
  profit: number;
  income: number;
  expenses: number;
  layout?: "compact" | "wide";
}) {
  const ok = profit >= 0;
  const wrap = ok
    ? "border-emerald-200 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/40"
    : "border-rose-200 bg-rose-50 dark:border-rose-900 dark:bg-rose-950/40";
  const amount = ok
    ? "text-emerald-700 dark:text-emerald-300"
    : "text-rose-700 dark:text-rose-300";

  if (layout === "wide") {
    return (
      <div
        className={`flex flex-wrap items-end justify-between gap-3 rounded-xl border px-4 py-4 ${
          ok
            ? "border-emerald-300 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/40"
            : "border-rose-300 bg-rose-50 dark:border-rose-800 dark:bg-rose-950/40"
        }`}
      >
        <div>
          <p className="text-sm font-medium">{title}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {money(income)} − {money(expenses)}
          </p>
        </div>
        <p className={`text-2xl font-semibold tabular-nums ${amount}`}>
          {money(profit)}
        </p>
      </div>
    );
  }

  return (
    <div className={`min-w-[240px] rounded-xl border px-5 py-3 ${wrap}`}>
      <p className="text-xs text-muted-foreground">{title}</p>
      <p className="text-2xl font-semibold tabular-nums">{money(profit)}</p>
      <p className="mt-1 text-xs text-muted-foreground">
        Доходи {money(income)} · витрати {money(expenses)}
      </p>
    </div>
  );
}

function BalanceTable({
  live,
  recast,
}: {
  live: {
    income: BalLine[];
    expenses: BalLine[];
    incomeTotal: number;
    expenseTotal: number;
    profit: number;
  };
  recast: { income: number; profit: number };
}) {
  return (
    <section className="space-y-3">
      <div>
        <h3 className="font-medium">Баланс місяця</h3>
        <p className="text-sm text-muted-foreground">
          Ліва колонка — доходи, права — витрати. Операційний прибуток = разом
          доходів − разом витрат. Перерахунок бере доходи з «Каса / безготівка».
        </p>
      </div>
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <BalanceColumn
          title="Доходи"
          totalLabel="Разом доходів"
          rows={live.income}
          total={live.incomeTotal}
          tone="income"
        />
        <BalanceColumn
          title="Витрати"
          totalLabel="Разом витрат"
          rows={live.expenses}
          total={live.expenseTotal}
          tone="expense"
        />
      </div>
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <ProfitBox
          layout="wide"
          title="Операційний прибуток (баланс)"
          profit={live.profit}
          income={live.incomeTotal}
          expenses={live.expenseTotal}
        />
        <ProfitBox
          layout="wide"
          title="Перерахунок від фактичних надходжень"
          profit={recast.profit}
          income={recast.income}
          expenses={live.expenseTotal}
        />
      </div>
    </section>
  );
}

function BnCostBlock({
  title,
  hint,
  costs,
  busy,
  onChange,
  onSave,
  onAccept,
  onEdit,
}: {
  title: string;
  hint: string;
  costs: PnlBnCosts;
  busy: boolean;
  onChange: (next: PnlBnCosts) => void;
  onSave: () => void;
  onAccept: () => void;
  onEdit: () => void;
}) {
  const locked = costs.accepted;
  return (
    <section className="rounded-xl border bg-card p-4 shadow-sm">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="font-medium">{title}</h3>
          <p className="text-xs text-muted-foreground">{hint}</p>
        </div>
        <FormActions
          accepted={locked}
          busy={busy}
          onSave={onSave}
          onAccept={onAccept}
          onEdit={onEdit}
        />
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <MoneyField
          label="Комунальні"
          value={costs.utilities}
          disabled={locked}
          onChange={(v) => onChange({ ...costs, utilities: num(v) })}
        />
        <MoneyField
          label="Оренда"
          value={costs.rent}
          disabled={locked}
          onChange={(v) => onChange({ ...costs, rent: num(v) })}
        />
        <MoneyField
          label="Податки"
          value={costs.taxes}
          disabled={locked}
          onChange={(v) => onChange({ ...costs, taxes: num(v) })}
        />
        <MoneyField
          label="Банк комісія"
          value={costs.bankFee}
          disabled={locked}
          onChange={(v) => onChange({ ...costs, bankFee: num(v) })}
        />
        <MoneyField
          label="Інше"
          value={costs.other}
          disabled={locked}
          onChange={(v) => onChange({ ...costs, other: num(v) })}
        />
      </div>
    </section>
  );
}

function TerebenetsKasaBlock({
  costs,
  busy,
  onChange,
  onSave,
  onAccept,
  onEdit,
}: {
  costs: PnlTerebenetsKasaCosts;
  busy: boolean;
  onChange: (next: PnlTerebenetsKasaCosts) => void;
  onSave: () => void;
  onAccept: () => void;
  onEdit: () => void;
}) {
  const locked = costs.accepted;
  return (
    <section className="rounded-xl border bg-card p-4 shadow-sm">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="font-medium">Каса Теребенець</h3>
          <p className="text-xs text-muted-foreground">
            Витрати з каси. Входять у зелений прибуток, крім «Рух коштів».
          </p>
        </div>
        <FormActions
          accepted={locked}
          busy={busy}
          onSave={onSave}
          onAccept={onAccept}
          onEdit={onEdit}
        />
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <MoneyField
          label="Комунальні"
          value={costs.utilities}
          disabled={locked}
          onChange={(v) => onChange({ ...costs, utilities: num(v) })}
        />
        <MoneyField
          label="Оренда"
          value={costs.rent}
          disabled={locked}
          onChange={(v) => onChange({ ...costs, rent: num(v) })}
        />
        <MoneyField
          label="Податки"
          value={costs.taxes}
          disabled={locked}
          onChange={(v) => onChange({ ...costs, taxes: num(v) })}
        />
        <MoneyField
          label="Банк комісія"
          value={costs.bankFee}
          disabled={locked}
          onChange={(v) => onChange({ ...costs, bankFee: num(v) })}
        />
        <MoneyField
          label="Інше"
          value={costs.other}
          disabled={locked}
          onChange={(v) => onChange({ ...costs, other: num(v) })}
        />
        <MoneyField
          label="Маркетинг"
          value={costs.marketing}
          disabled={locked}
          onChange={(v) => onChange({ ...costs, marketing: num(v) })}
        />
        <MoneyField
          label="Зарплата"
          value={costs.salary}
          disabled={locked}
          onChange={(v) => onChange({ ...costs, salary: num(v) })}
        />
        <MoneyField
          label="Кредит"
          value={costs.credit}
          disabled={locked}
          onChange={(v) => onChange({ ...costs, credit: num(v) })}
        />
        <MoneyField
          label="Паливо"
          value={costs.fuel}
          disabled={locked}
          onChange={(v) => onChange({ ...costs, fuel: num(v) })}
        />
        <MoneyField
          label="Рух коштів (довідково)"
          value={costs.cashMovement}
          disabled={locked}
          onChange={(v) => onChange({ ...costs, cashMovement: num(v) })}
        />
        <MoneyField
          label="Поліграфія"
          value={costs.printing}
          disabled={locked}
          onChange={(v) => onChange({ ...costs, printing: num(v) })}
        />
        <MoneyField
          label="Поточні витрати"
          value={costs.currentExpenses}
          disabled={locked}
          onChange={(v) => onChange({ ...costs, currentExpenses: num(v) })}
        />
      </div>
    </section>
  );
}

function FormActions({
  accepted,
  busy,
  onSave,
  onAccept,
  onEdit,
}: {
  accepted: boolean;
  busy: boolean;
  onSave: () => void;
  onAccept: () => void;
  onEdit: () => void;
}) {
  if (accepted) {
    return (
      <Button size="sm" variant="outline" disabled={busy} onClick={onEdit}>
        Редагувати
      </Button>
    );
  }
  return (
    <div className="flex flex-wrap gap-2">
      <Button size="sm" variant="outline" disabled={busy} onClick={onSave}>
        Зберегти
      </Button>
      <Button size="sm" disabled={busy} onClick={onAccept}>
        Прийняти
      </Button>
    </div>
  );
}
