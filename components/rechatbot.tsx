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
import type { MonthWaterPoint } from "@/actions/get-botvstotal-water";

const chartConfig = {
  total: {
    label: "Мережа",
    color: "#10b981",
  },
  bot: {
    label: "Бот",
    color: "#a7f3d0",
  },
} satisfies ChartConfig;

interface RechartBotProps {
  data: MonthWaterPoint[];
}

export const RechartBot: React.FC<RechartBotProps> = ({ data }) => {
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
          tickFormatter={(value) => `${value} л`}
        />

        <ChartTooltip
          cursor={{ fill: "rgba(16, 185, 129, 0.04)" }}
          content={<ChartTooltipContent />}
        />

        <ChartLegend content={<ChartLegendContent />} />

        <Bar
          dataKey="total"
          fill="var(--color-total)"
          name="Мережа"
          radius={[4, 4, 0, 0]}
        />
        <Bar
          dataKey="bot"
          fill="var(--color-bot)"
          name="Бот"
          radius={[4, 4, 0, 0]}
        />
      </BarChart>
    </ChartContainer>
  );
};
