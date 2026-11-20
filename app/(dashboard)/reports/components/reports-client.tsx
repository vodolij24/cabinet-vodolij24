"use client";

import { useEffect, useState } from "react";
import axios from "axios";
import { toast } from "react-hot-toast";
import { Trash2 } from "lucide-react";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
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
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import type { ExpenseFundsReport } from "@/lib/expense-funds-report";
import { periodKeyLabel } from "@/lib/pnl-constants";
import type { ReportFund, ReportFundNote } from "@/lib/report-notes";

const chartConfig = {
  salary: { label: "ЗП фонд", color: "#10b981" },
  rent: { label: "Оренда фонд", color: "#3b82f6" },
  utilities: { label: "Комуналка фонд", color: "#f59e0b" },
} satisfies ChartConfig;

const ROWS = [
  { key: "salary", label: "ЗП фонд", color: "#10b981" },
  { key: "rent", label: "Оренда фонд", color: "#3b82f6" },
  { key: "utilities", label: "Комуналка фонд", color: "#f59e0b" },
] as const;

function money(n: number) {
  return `${n.toLocaleString("uk-UA")} грн`;
}

function FundLabel({ label, color }: { label: string; color: string }) {
  return (
    <span className="inline-flex items-center gap-2">
      <span
        className="inline-block h-2.5 w-2.5 shrink-0 rounded-[2px]"
        style={{ backgroundColor: color }}
      />
      {label}
    </span>
  );
}

function fundMeta(fund: ReportFund) {
  return ROWS.find((row) => row.key === fund) ?? ROWS[0];
}

function FundNotes({
  months,
  initialNotes,
}: {
  months: ExpenseFundsReport["months"];
  initialNotes: ReportFundNote[];
}) {
  const [notes, setNotes] = useState(initialNotes);
  const [fund, setFund] = useState<ReportFund>("salary");
  const [fromPeriod, setFromPeriod] = useState(months[0]?.periodKey ?? "");
  const [toPeriod, setToPeriod] = useState(
    months[1]?.periodKey ?? months[0]?.periodKey ?? ""
  );
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);

  const addNote = async () => {
    try {
      setBusy(true);
      const { data } = await axios.post<ReportFundNote>("/api/reports/notes", {
        fund,
        fromPeriod,
        toPeriod,
        body,
      });
      setNotes((current) => [data, ...current]);
      setBody("");
      toast.success("Примітку додано");
    } catch (error) {
      const msg = axios.isAxiosError(error)
        ? error.response?.data || "Помилка"
        : "Помилка";
      toast.error(typeof msg === "string" ? msg : "Не вдалося зберегти");
    } finally {
      setBusy(false);
    }
  };

  const removeNote = async (id: number) => {
    try {
      setBusy(true);
      await axios.delete(`/api/reports/notes/${id}`);
      setNotes((current) => current.filter((note) => note.id !== id));
      toast.success("Примітку видалено");
    } catch {
      toast.error("Не вдалося видалити");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-medium">Примітки до різниць</h3>
      {notes.length === 0 ? (
        <p className="text-sm text-muted-foreground">Поки немає приміток.</p>
      ) : (
        <ul className="space-y-2">
          {notes.map((note) => {
            const meta = fundMeta(note.fund);
            return (
              <li
                key={note.id}
                className="flex items-start justify-between gap-3 rounded-lg border px-3 py-2"
                style={{ borderLeftColor: meta.color, borderLeftWidth: 3 }}
              >
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">
                    {meta.label} · {periodKeyLabel(note.fromPeriod)} →{" "}
                    {periodKeyLabel(note.toPeriod)}
                  </p>
                  <p className="text-sm whitespace-pre-wrap">{note.body}</p>
                  <p className="text-xs text-muted-foreground">
                    {note.authorName} ·{" "}
                    {new Date(note.createdAt).toLocaleDateString("uk-UA")}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  disabled={busy}
                  aria-label="Видалити примітку"
                  onClick={() => void removeNote(note.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </li>
            );
          })}
        </ul>
      )}

      {months.length >= 2 ? (
        <div className="space-y-2 rounded-lg border bg-muted/30 p-3">
          <div className="flex flex-wrap gap-2">
            <Select
              value={fund}
              onValueChange={(value) => setFund(value as ReportFund)}
              disabled={busy}
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ROWS.map((row) => (
                  <SelectItem key={row.key} value={row.key}>
                    {row.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={fromPeriod}
              onValueChange={setFromPeriod}
              disabled={busy}
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Від" />
              </SelectTrigger>
              <SelectContent>
                {months.map((month) => (
                  <SelectItem key={month.periodKey} value={month.periodKey}>
                    {month.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={toPeriod} onValueChange={setToPeriod} disabled={busy}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="До" />
              </SelectTrigger>
              <SelectContent>
                {months.map((month) => (
                  <SelectItem key={month.periodKey} value={month.periodKey}>
                    {month.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Textarea
            value={body}
            disabled={busy}
            placeholder="Чому фонд відрізняється між цими місяцями"
            onChange={(event) => setBody(event.target.value)}
          />
          <Button
            type="button"
            disabled={busy || !body.trim()}
            onClick={() => void addNote()}
          >
            Додати примітку
          </Button>
        </div>
      ) : null}
    </div>
  );
}

export function ReportsClient({
  expenses,
  notes,
}: {
  expenses: ExpenseFundsReport;
  notes: ReportFundNote[];
}) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const range =
    expenses.months.length > 0
      ? `${expenses.months[0].label} – ${expenses.months[expenses.months.length - 1].label}`
      : "";

  return (
    <Card>
      <CardHeader>
        <CardTitle>Витрати за останні 3 місяці</CardTitle>
        <p className="text-sm text-muted-foreground">{range}</p>
      </CardHeader>
      <CardContent className="space-y-6">
        {mounted ? (
          <ChartContainer
            config={chartConfig}
            className="aspect-auto h-[350px] w-full"
          >
            <BarChart accessibilityLayer data={expenses.months} barGap={4}>
              <CartesianGrid
                vertical={false}
                strokeDasharray="3 3"
                opacity={0.3}
              />
              <XAxis
                dataKey="shortLabel"
                stroke="#888888"
                fontSize={12}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                stroke="#888888"
                fontSize={12}
                tickLine={false}
                axisLine={false}
                width={88}
                tickFormatter={(value) =>
                  `₴${Number(value).toLocaleString("uk-UA")}`
                }
              />
              <ChartTooltip
                cursor={{ fill: "rgba(16, 185, 129, 0.04)" }}
                content={<ChartTooltipContent />}
              />
              <ChartLegend content={<ChartLegendContent />} />
              <Bar
                dataKey="salary"
                fill="var(--color-salary)"
                radius={[4, 4, 0, 0]}
              />
              <Bar
                dataKey="rent"
                fill="var(--color-rent)"
                radius={[4, 4, 0, 0]}
              />
              <Bar
                dataKey="utilities"
                fill="var(--color-utilities)"
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ChartContainer>
        ) : (
          <div className="h-[350px] animate-pulse rounded-xl border bg-muted/40" />
        )}

        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Фонд</TableHead>
                {expenses.months.map((month) => (
                  <TableHead key={month.periodKey} className="text-right">
                    {month.label}
                  </TableHead>
                ))}
                <TableHead className="text-right">Разом</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {ROWS.map((row) => (
                <TableRow key={row.key}>
                  <TableCell>
                    <FundLabel label={row.label} color={row.color} />
                  </TableCell>
                  {expenses.months.map((month) => (
                    <TableCell
                      key={month.periodKey}
                      className="text-right tabular-nums"
                    >
                      {money(month[row.key])}
                    </TableCell>
                  ))}
                  <TableCell className="text-right font-medium tabular-nums">
                    {money(expenses.totals[row.key])}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
            <TableFooter>
              <TableRow>
                <TableCell className="font-medium">Разом</TableCell>
                {expenses.months.map((month) => (
                  <TableCell
                    key={month.periodKey}
                    className="text-right font-medium tabular-nums"
                  >
                    {money(month.total)}
                  </TableCell>
                ))}
                <TableCell className="text-right font-medium tabular-nums">
                  {money(expenses.totals.total)}
                </TableCell>
              </TableRow>
            </TableFooter>
          </Table>
        </div>

        <FundNotes months={expenses.months} initialNotes={notes} />

        <div className="space-y-1 text-xs text-muted-foreground">
          <p>
            ЗП фонд: техніки, Володимир, Теребинець, колцентр, техдиректор,
            фінменеджер, Олена, премія техдиректора, каса Теребенець, каса
            Кміть.
          </p>
          <p>
            Оренда фонд: загальна оренда і платіжний календар, Позднякова,
            Кміть, каса Теребенець.
          </p>
          <p>
            Комуналка фонд: таблиця комуналки і платіжний календар, Позднякова,
            Кміть, каса Теребенець, каса Кміть.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
