"use client";

import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";
import {
  ChartConfig,
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import type { WaterDayPoint } from "@/actions/get-water-last-30-days";

const chartConfig = {
  network: {
    label: "Налито, л",
    color: "#10b981",
  },
  cashShare: {
    label: "Частка готівки",
    color: "#f59e0b",
  },
} satisfies ChartConfig;

interface Water30DaysChartProps {
  data: WaterDayPoint[];
}

export const Water30DaysChart: React.FC<Water30DaysChartProps> = ({ data }) => {
  return (
    <ChartContainer
      config={chartConfig}
      className="min-h-[200px] w-full h-[350px]"
    >
      <LineChart accessibilityLayer data={data}>
        <CartesianGrid vertical={false} strokeDasharray="3 3" opacity={0.3} />

        <XAxis
          dataKey="name"
          stroke="#888888"
          fontSize={12}
          tickLine={false}
          axisLine={false}
          interval="preserveStartEnd"
          minTickGap={24}
        />

        <YAxis
          yAxisId="left"
          stroke="#10b981"
          fontSize={12}
          tickLine={false}
          axisLine={false}
          tickFormatter={(value) => `${value} л`}
        />

        <YAxis
          yAxisId="right"
          orientation="right"
          stroke="#f59e0b"
          fontSize={12}
          tickLine={false}
          axisLine={false}
          domain={[0, 100]}
          tickFormatter={(value) => `${value}%`}
        />

        <ChartTooltip
          cursor={{ stroke: "rgba(16, 185, 129, 0.35)" }}
          content={<ChartTooltipContent />}
        />

        <ChartLegend content={<ChartLegendContent />} />

        <Line
          yAxisId="left"
          type="monotone"
          dataKey="network"
          stroke="var(--color-network)"
          strokeWidth={2}
          dot={false}
          name="Налито, л"
        />
        <Line
          yAxisId="right"
          type="monotone"
          dataKey="cashShare"
          stroke="var(--color-cashShare)"
          strokeWidth={2}
          dot={false}
          name="Частка готівки"
        />
      </LineChart>
    </ChartContainer>
  );
};
