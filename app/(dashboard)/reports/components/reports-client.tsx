"use client";

import { useEffect, useState } from "react";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";

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
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { ExpenseFundsReport } from "@/lib/expense-funds-report";

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

export function ReportsClient({ expenses }: { expenses: ExpenseFundsReport }) {
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
