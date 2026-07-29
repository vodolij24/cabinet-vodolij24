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
  totalCount: {
    label: "Усього користувачів",
    color: "#64748b",
  },
  activeCount: {
    label: "Активні (наливали)",
    color: "#10b981",
  },
  inactiveCount: {
    label: "Неактивні (з карткою)",
    color: "#f59e0b",
  },
  unregisteredCount: {
    label: "Недореєстровані",
    color: "#ef4444",
  },
} satisfies ChartConfig;

interface BotInactive30DaysChartProps {
  data: BotSuccessDayPoint[];
}

export const BotInactive30DaysChart: React.FC<BotInactive30DaysChartProps> = ({
  data,
}) => {
  const last = data[data.length - 1];

  return (
    <div className="space-y-3">
      {last && (
        <p className="px-2 text-sm text-muted-foreground">
          Останній день: усього <strong>{last.totalCount}</strong>, активні{" "}
          <strong>{last.activeCount}</strong>, неактивні{" "}
          <strong>{last.inactiveCount}</strong>, недореєстровані{" "}
          <strong>{last.unregisteredCount}</strong>
        </p>
      )}

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
            allowDecimals={false}
          />

          <ChartTooltip
            cursor={{ stroke: "rgba(245, 158, 11, 0.35)" }}
            content={<ChartTooltipContent />}
          />

          <ChartLegend content={<ChartLegendContent />} />

          <Line
            type="monotone"
            dataKey="totalCount"
            stroke="var(--color-totalCount)"
            strokeWidth={2}
            dot={false}
            name="Усього користувачів, шт"
            isAnimationActive={false}
          />
          <Line
            type="monotone"
            dataKey="activeCount"
            stroke="var(--color-activeCount)"
            strokeWidth={2}
            dot={false}
            name="Активні (наливали), шт"
            isAnimationActive={false}
          />
          <Line
            type="monotone"
            dataKey="inactiveCount"
            stroke="var(--color-inactiveCount)"
            strokeWidth={2}
            dot={false}
            name="Неактивні (з карткою), шт"
            isAnimationActive={false}
          />
          <Line
            type="monotone"
            dataKey="unregisteredCount"
            stroke="var(--color-unregisteredCount)"
            strokeWidth={2}
            dot={false}
            name="Недореєстровані, шт"
            isAnimationActive={false}
          />
        </LineChart>
      </ChartContainer>
    </div>
  );
};
