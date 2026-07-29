"use client";

import { Bar, BarChart, XAxis, YAxis, CartesianGrid } from "recharts";
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
} from "@/components/ui/chart";
import type { MonthRevenuePoint } from "@/actions/get-graph-revenue";

const chartConfig = {
  total: {
    label: "Дохід",
    color: "#10b981",
  },
} satisfies ChartConfig;

interface OverviewProps {
  data: MonthRevenuePoint[];
}

export const Overview: React.FC<OverviewProps> = ({ data }) => {
  return (
    <ChartContainer
      config={chartConfig}
      className="min-h-[200px] w-full h-[350px]"
    >
      <BarChart accessibilityLayer data={data}>
        <CartesianGrid vertical={false} strokeDasharray="3 3" opacity={0.3} />

        <XAxis
          dataKey="name"
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
          tickFormatter={(value) => `₴${value}`}
        />

        <ChartTooltip
          cursor={{ fill: "rgba(16, 185, 129, 0.04)" }}
          content={<ChartTooltipContent />}
        />

        <ChartLegend content={<ChartLegendContent />} />

        <Bar
          dataKey="total"
          fill="var(--color-total)"
          name="Дохід"
          radius={[4, 4, 0, 0]}
        />
      </BarChart>
    </ChartContainer>
  );
};
