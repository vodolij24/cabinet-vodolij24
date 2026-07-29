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
  bot: {
    label: "Налито через бота",
    color: "#3b82f6",
  },
  botUsers: {
    label: "Активні в боті",
    color: "#f59e0b",
  },
} satisfies ChartConfig;

interface BotWater30DaysChartProps {
  data: WaterDayPoint[];
}

export const BotWater30DaysChart: React.FC<BotWater30DaysChartProps> = ({
  data,
}) => {
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
          stroke="#3b82f6"
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
          tickFormatter={(value) => `${value}`}
        />

        <ChartTooltip
          cursor={{ stroke: "rgba(59, 130, 246, 0.35)" }}
          content={<ChartTooltipContent />}
        />

        <ChartLegend content={<ChartLegendContent />} />

        <Line
          yAxisId="left"
          type="monotone"
          dataKey="bot"
          stroke="var(--color-bot)"
          strokeWidth={2}
          dot={false}
          name="Налито через бота"
        />
        <Line
          yAxisId="right"
          type="monotone"
          dataKey="botUsers"
          stroke="var(--color-botUsers)"
          strokeWidth={2}
          dot={false}
          name="Активні в боті"
        />
      </LineChart>
    </ChartContainer>
  );
};
