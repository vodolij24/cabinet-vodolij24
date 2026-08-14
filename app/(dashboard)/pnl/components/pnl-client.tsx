"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import axios from "axios";
import { toast } from "react-hot-toast";
import { ChevronDown, ChevronRight } from "lucide-react";

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
  type PnlSheetKind,
} from "@/lib/pnl-constants";
import type { PnlPage } from "@/lib/pnl-types";

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

export function PnlClient({ initial }: { initial: PnlPage }) {
  const router = useRouter();
  const [data, setData] = useState(initial);
  const [busy, setBusy] = useState<string | null>(null);
  const [openTech, setOpenTech] = useState(false);
  const [manual, setManual] = useState(initial.manual);
  const [staticCosts, setStaticCosts] = useState(initial.staticCosts);
  const [sheetDraft, setSheetDraft] = useState(initial.sheets);
  const fileRefs = useRef<Record<string, HTMLInputElement | null>>({});

  useEffect(() => {
    setData(initial);
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
      setManual(next.manual);
      setStaticCosts(next.staticCosts);
      setSheetDraft(next.sheets);
      toast.success(
        payload.action === "accept"
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

  const profit = data.totals.operatingProfit;

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
        <div
          className={`rounded-xl border px-5 py-3 ${
            profit >= 0
              ? "border-emerald-200 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/40"
              : "border-rose-200 bg-rose-50 dark:border-rose-900 dark:bg-rose-950/40"
          }`}
        >
          <p className="text-xs text-muted-foreground">Операційний прибуток</p>
          <p className="text-2xl font-semibold tabular-nums">{money(profit)}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Доходи {money(data.totals.income)} · витрати {money(data.totals.expenses)}
          </p>
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
            label="Готівка Кміть"
            value={manual.kmitCash}
            disabled={manual.accepted}
            onChange={(v) => setManual((s) => ({ ...s, kmitCash: num(v) }))}
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
    </div>
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
