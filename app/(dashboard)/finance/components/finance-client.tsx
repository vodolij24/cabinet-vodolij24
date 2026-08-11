"use client";

import { useMemo, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import axios from "axios";
import { toast } from "react-hot-toast";
import { ChevronDown, ChevronRight, Plus, Trash2, Wallet } from "lucide-react";

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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  FINANCE_PERIOD_PRESETS,
  type FinancePeriodPreset,
} from "@/lib/finance-constants";
import type { FinanceReport } from "@/lib/finance-report";

function money(n: number) {
  return `${n.toLocaleString("uk-UA")} грн`;
}

function Section({
  title,
  total,
  open,
  onToggle,
  children,
}: {
  title: string;
  total: number;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-lg border">
      <button
        type="button"
        className="flex w-full items-center justify-between gap-3 bg-muted/40 px-4 py-3 text-left"
        onClick={onToggle}
      >
        <span className="flex items-center gap-2 font-medium">
          {open ? (
            <ChevronDown className="h-4 w-4 shrink-0" />
          ) : (
            <ChevronRight className="h-4 w-4 shrink-0" />
          )}
          {title}
        </span>
        <span className="tabular-nums text-lg font-semibold">{money(total)}</span>
      </button>
      {open ? <div className="border-t px-2 py-2 sm:px-4">{children}</div> : null}
    </section>
  );
}

export function FinanceClient({ initial }: { initial: FinanceReport }) {
  const router = useRouter();
  const [data, setData] = useState(initial);
  const [preset, setPreset] = useState<FinancePeriodPreset>(initial.preset);
  const [customFrom, setCustomFrom] = useState(initial.from);
  const [customTo, setCustomTo] = useState(initial.to);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [openFuel, setOpenFuel] = useState(false);
  const [openOther, setOpenOther] = useState(false);
  const [openSalary, setOpenSalary] = useState(true);
  const [openStatements, setOpenStatements] = useState(true);
  const [expandedWorkerId, setExpandedWorkerId] = useState<number | null>(null);
  const [bonusOpen, setBonusOpen] = useState(false);
  const [bonusBusy, setBonusBusy] = useState(false);
  const [bonusWorkerId, setBonusWorkerId] = useState("");
  const [bonusAmount, setBonusAmount] = useState("");
  const [bonusReason, setBonusReason] = useState("");
  const [bonusDate, setBonusDate] = useState(() =>
    new Date().toISOString().slice(0, 10)
  );

  const loadReport = async (next: {
    preset: FinancePeriodPreset;
    from?: string;
    to?: string;
  }) => {
    try {
      setLoading(true);
      const params = new URLSearchParams({ preset: next.preset });
      if (next.preset === "custom") {
        if (!next.from || !next.to) {
          toast.error("Вкажіть період від і до");
          return;
        }
        params.set("from", next.from);
        params.set("to", next.to);
      }
      const { data: report } = await axios.get<FinanceReport>(
        `/api/finance/report?${params.toString()}`
      );
      setData(report);
      setPreset(report.preset);
      setCustomFrom(report.from);
      setCustomTo(report.to);
      setExpandedWorkerId(null);
    } catch (error) {
      const msg = axios.isAxiosError(error)
        ? error.response?.data || "Помилка"
        : "Помилка";
      toast.error(typeof msg === "string" ? msg : "Не вдалося завантажити");
    } finally {
      setLoading(false);
    }
  };

  const onPresetChange = (value: string) => {
    const next = value as FinancePeriodPreset;
    setPreset(next);
    if (next !== "custom") {
      void loadReport({ preset: next });
    }
  };

  const onGenerateMonthly = async () => {
    try {
      setGenerating(true);
      const { data: result } = await axios.post("/api/tasks/generate-monthly");
      toast.success(
        `Фінзадачі: створено ${result.created}, пропущено ${result.skipped} (${result.periodKey})`
      );
      router.refresh();
    } catch {
      toast.error("Не вдалося створити фінзадачі");
    } finally {
      setGenerating(false);
    }
  };

  const onCreateBonus = async () => {
    try {
      setBonusBusy(true);
      await axios.post("/api/finance/bonuses", {
        workerId: bonusWorkerId,
        amount: bonusAmount,
        reason: bonusReason,
        bonusDate,
      });
      toast.success("Ручну премію додано");
      setBonusAmount("");
      setBonusReason("");
      setBonusOpen(false);
      await loadReport({
        preset,
        from: customFrom,
        to: customTo,
      });
    } catch (error) {
      const msg = axios.isAxiosError(error)
        ? error.response?.data || "Помилка"
        : "Помилка";
      toast.error(typeof msg === "string" ? msg : "Не вдалося зберегти");
    } finally {
      setBonusBusy(false);
    }
  };

  const onDeleteBonus = async (id: number) => {
    try {
      setBonusBusy(true);
      await axios.delete(`/api/finance/bonuses/${id}`);
      toast.success("Премію видалено");
      await loadReport({ preset, from: customFrom, to: customTo });
    } catch {
      toast.error("Не вдалося видалити");
    } finally {
      setBonusBusy(false);
    }
  };

  const salaryHint = useMemo(
    () =>
      "ЗП = база + премія за літри + ручні премії − утримання (по місяцях у періоді)",
    []
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <label className="text-sm text-muted-foreground">Період</label>
          <Select
            value={preset}
            disabled={loading}
            onValueChange={onPresetChange}
          >
            <SelectTrigger className="w-[220px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {FINANCE_PERIOD_PRESETS.map((p) => (
                <SelectItem key={p.value} value={p.value}>
                  {p.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {preset === "custom" ? (
          <>
            <div className="space-y-1">
              <label className="text-sm text-muted-foreground">Від</label>
              <Input
                type="date"
                value={customFrom}
                disabled={loading}
                onChange={(e) => setCustomFrom(e.target.value)}
                className="w-[160px]"
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm text-muted-foreground">До</label>
              <Input
                type="date"
                value={customTo}
                disabled={loading}
                onChange={(e) => setCustomTo(e.target.value)}
                className="w-[160px]"
              />
            </div>
            <Button
              disabled={loading}
              onClick={() =>
                loadReport({
                  preset: "custom",
                  from: customFrom,
                  to: customTo,
                })
              }
            >
              Показати
            </Button>
          </>
        ) : null}

        <Button
          variant="secondary"
          disabled={generating || loading}
          onClick={onGenerateMonthly}
        >
          <Wallet className="mr-2 h-4 w-4" />
          {generating ? "Створення…" : "Створити фінзадачі"}
        </Button>

        <Button
          variant="outline"
          disabled={loading}
          onClick={() => setBonusOpen((v) => !v)}
        >
          <Plus className="mr-2 h-4 w-4" />
          Ручна премія
        </Button>
      </div>

      <p className="text-sm text-muted-foreground">{data.label}</p>

      {bonusOpen ? (
        <div className="space-y-3 rounded-lg border p-4">
          <p className="text-sm font-medium">Нова ручна премія</p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Технік</label>
              <Select
                value={bonusWorkerId}
                onValueChange={setBonusWorkerId}
                disabled={bonusBusy}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Обрати" />
                </SelectTrigger>
                <SelectContent>
                  {data.technicians.map((t) => (
                    <SelectItem key={t.id} value={String(t.id)}>
                      {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Сума, грн</label>
              <Input
                value={bonusAmount}
                disabled={bonusBusy}
                inputMode="numeric"
                placeholder="1000"
                onChange={(e) => setBonusAmount(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Дата</label>
              <Input
                type="date"
                value={bonusDate}
                disabled={bonusBusy}
                onChange={(e) => setBonusDate(e.target.value)}
              />
            </div>
            <div className="space-y-1 sm:col-span-2 lg:col-span-4">
              <label className="text-xs text-muted-foreground">Причина</label>
              <Input
                value={bonusReason}
                disabled={bonusBusy}
                placeholder="Причина нарахування"
                onChange={(e) => setBonusReason(e.target.value)}
              />
            </div>
          </div>
          <div className="flex gap-2">
            <Button disabled={bonusBusy} onClick={onCreateBonus}>
              Зберегти
            </Button>
            <Button
              variant="ghost"
              disabled={bonusBusy}
              onClick={() => setBonusOpen(false)}
            >
              Скасувати
            </Button>
          </div>
        </div>
      ) : null}

      <Section
        title="Паливо"
        total={data.fuel.total}
        open={openFuel}
        onToggle={() => setOpenFuel((v) => !v)}
      >
        {data.fuel.rows.length === 0 ? (
          <p className="px-2 py-4 text-sm text-muted-foreground">Немає записів</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Технік</TableHead>
                <TableHead>Коментар</TableHead>
                <TableHead className="text-right">Сума</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.fuel.rows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="font-medium">
                    {row.technicianName}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {row.comment || "—"}
                  </TableCell>
                  <TableCell className="text-right tabular-nums whitespace-nowrap">
                    {money(row.amount)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Section>

      <Section
        title="Інші витрати"
        total={data.other.total}
        open={openOther}
        onToggle={() => setOpenOther((v) => !v)}
      >
        {data.other.rows.length === 0 ? (
          <p className="px-2 py-4 text-sm text-muted-foreground">Немає записів</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Технік</TableHead>
                <TableHead>Коментар</TableHead>
                <TableHead>Дата</TableHead>
                <TableHead className="text-right">Сума</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.other.rows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="font-medium">
                    {row.technicianName}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {row.comment || "—"}
                  </TableCell>
                  <TableCell>{row.date}</TableCell>
                  <TableCell className="text-right tabular-nums whitespace-nowrap">
                    {money(row.amount)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Section>

      <Section
        title="Заробітна плата"
        total={data.salary.total}
        open={openSalary}
        onToggle={() => setOpenSalary((v) => !v)}
      >
        <p className="mb-2 px-2 text-xs text-muted-foreground">{salaryHint}</p>
        {data.salary.rows.length === 0 ? (
          <p className="px-2 py-4 text-sm text-muted-foreground">Немає даних</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Технік</TableHead>
                <TableHead className="text-right">База</TableHead>
                <TableHead className="text-right">Премія</TableHead>
                <TableHead className="text-right">Ручні</TableHead>
                <TableHead className="text-right">Утримання</TableHead>
                <TableHead className="text-right">Підсумок</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.salary.rows.map((row) => (
                <TableRow key={row.workerId}>
                  <TableCell className="font-medium">{row.name}</TableCell>
                  <TableCell className="text-right tabular-nums whitespace-nowrap">
                    {money(row.baseSalary)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums whitespace-nowrap">
                    {money(row.performanceBonus)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums whitespace-nowrap">
                    {money(row.manualBonuses)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums whitespace-nowrap">
                    {money(row.deductions)}
                  </TableCell>
                  <TableCell className="text-right font-medium tabular-nums whitespace-nowrap">
                    {money(row.total)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}

        {data.manualBonusEntries.length > 0 ? (
          <div className="mt-4 border-t pt-3">
            <p className="mb-2 px-2 text-sm font-medium">Ручні премії за період</p>
            <ul className="space-y-2 px-2">
              {data.manualBonusEntries.map((b) => (
                <li
                  key={b.id}
                  className="flex flex-wrap items-start justify-between gap-2 text-sm"
                >
                  <div>
                    <span className="font-medium">{b.technicianName}</span>
                    <span className="text-muted-foreground">
                      {" "}
                      · {b.reason} · {b.bonusDate} · {b.authorName}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="tabular-nums font-medium">
                      {money(b.amount)}
                    </span>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8"
                      disabled={bonusBusy}
                      onClick={() => onDeleteBonus(b.id)}
                      aria-label="Видалити"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </Section>

      <Section
        title="По працівниках (виписка)"
        total={(data.statements || []).reduce((s, w) => s + w.balance, 0)}
        open={openStatements}
        onToggle={() => setOpenStatements((v) => !v)}
      >
        <p className="mb-3 px-2 text-xs text-muted-foreground">
          Деталізація як банківська виписка: нарахування (+), утримання (−),
          компенсація витрат, залишок наростаючим підсумком.
        </p>
        {(data.statements || []).length === 0 ? (
          <p className="px-2 py-4 text-sm text-muted-foreground">
            Немає рухів за період
          </p>
        ) : (
          <ul className="space-y-2">
            {(data.statements || []).map((st) => {
              const open = expandedWorkerId === st.workerId;
              return (
                <li
                  key={st.workerId}
                  className="overflow-hidden rounded-md border"
                >
                  <button
                    type="button"
                    className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left hover:bg-muted/40"
                    onClick={() =>
                      setExpandedWorkerId(open ? null : st.workerId)
                    }
                  >
                    <span className="flex items-center gap-2 font-medium">
                      {open ? (
                        <ChevronDown className="h-4 w-4 shrink-0" />
                      ) : (
                        <ChevronRight className="h-4 w-4 shrink-0" />
                      )}
                      {st.name}
                      <span className="text-xs font-normal text-muted-foreground">
                        {st.lines.length}{" "}
                        {st.lines.length === 1 ? "операція" : "операцій"}
                      </span>
                    </span>
                    <span className="tabular-nums font-semibold whitespace-nowrap">
                      {money(st.balance)}
                    </span>
                  </button>
                  {open ? (
                    <div className="border-t bg-muted/10">
                      <div className="overflow-x-auto">
                        <table className="w-full min-w-[640px] text-sm">
                          <thead>
                            <tr className="border-b text-xs text-muted-foreground">
                              <th className="px-3 py-2 text-left font-medium">
                                Дата
                              </th>
                              <th className="px-3 py-2 text-left font-medium">
                                Призначення платежу
                              </th>
                              <th className="px-3 py-2 text-right font-medium">
                                Надходження
                              </th>
                              <th className="px-3 py-2 text-right font-medium">
                                Списання
                              </th>
                              <th className="px-3 py-2 text-right font-medium">
                                Залишок
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {st.lines.map((line) => (
                              <tr
                                key={line.id}
                                className="border-b border-border/60 last:border-0"
                              >
                                <td className="whitespace-nowrap px-3 py-2 text-muted-foreground">
                                  {line.date}
                                </td>
                                <td className="px-3 py-2">{line.description}</td>
                                <td className="px-3 py-2 text-right tabular-nums text-emerald-700 dark:text-emerald-400">
                                  {line.credit > 0 ? money(line.credit) : "—"}
                                </td>
                                <td className="px-3 py-2 text-right tabular-nums text-rose-700 dark:text-rose-400">
                                  {line.debit > 0 ? money(line.debit) : "—"}
                                </td>
                                <td className="px-3 py-2 text-right tabular-nums font-medium">
                                  {money(line.balance)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                          <tfoot>
                            <tr className="bg-muted/30 text-sm font-medium">
                              <td className="px-3 py-2" colSpan={2}>
                                Разом за період
                              </td>
                              <td className="px-3 py-2 text-right tabular-nums text-emerald-700 dark:text-emerald-400">
                                {money(st.totalCredit)}
                              </td>
                              <td className="px-3 py-2 text-right tabular-nums text-rose-700 dark:text-rose-400">
                                {money(st.totalDebit)}
                              </td>
                              <td className="px-3 py-2 text-right tabular-nums">
                                {money(st.balance)}
                              </td>
                            </tr>
                          </tfoot>
                        </table>
                      </div>
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </Section>
    </div>
  );
}
