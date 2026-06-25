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

// Налаштування приємного зеленого кольору відповідно до попереднього графіка
const chartConfig = {
  total: {
    label: "Overall",
    color: "#10b981", // Насичений смарагдовий зелений
  },
} satisfies ChartConfig;

interface OverviewProps {
  data: unknown[];
}

export const Overview: React.FC<OverviewProps> = ({ data }) => {
  return (
    <ChartContainer
      config={chartConfig}
      className="min-h-[200px] w-full h-[350px]"
    >
      <BarChart accessibilityLayer data={data}>
        {/* Додано легку горизонтальну сітку */}
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

        {/* Додано інтерактивну підказку з кастомним зеленим фокусом ховера */}
        <ChartTooltip
          cursor={{ fill: "rgba(16, 185, 129, 0.04)" }}
          content={<ChartTooltipContent hideLabel />}
        />

        {/* Додано легенду під графіком */}
        <ChartLegend content={<ChartLegendContent />} />

        {/* Змінено fill на CSS-змінну, що береться з конфігу вище */}
        <Bar
          dataKey="total"
          fill="var(--color-total)"
          name="Загальний дохід"
          radius={[4, 4, 0, 0]}
        />
      </BarChart>
    </ChartContainer>
  );
};
