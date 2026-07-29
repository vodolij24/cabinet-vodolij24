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
import type { BotSuccessDayPoint } from "@/actions/get-bot-success-30-days";

const chartConfig = {
  botShare: {
    label: "Частка бота",
    color: "#10b981",
  },
  returningPct: {
    label: "Повернення (retention)",
    color: "#3b82f6",
  },
} satisfies ChartConfig;

interface BotSuccess30DaysChartProps {
  data: BotSuccessDayPoint[];
}

export const BotSuccess30DaysChart: React.FC<BotSuccess30DaysChartProps> = ({
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
          stroke="#888888"
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
          type="monotone"
          dataKey="botShare"
          stroke="var(--color-botShare)"
          strokeWidth={2}
          dot={false}
          name="Частка бота"
        />
        <Line
          type="monotone"
          dataKey="returningPct"
          stroke="var(--color-returningPct)"
          strokeWidth={2}
          dot={false}
          name="Повернення (retention)"
        />
      </LineChart>
    </ChartContainer>
  );
};
