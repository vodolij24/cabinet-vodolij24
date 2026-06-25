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

// ПРАВИЛЬНО: Ключі мають називатися точно так само, як ваші dataKey у <Bar />
const chartConfig = {
  total: {
    label: "Overall",
    color: "#10b981", // Приємний зелений
  },
  bot: {
    label: "BotOnly",
    color: "#a7f3d0", // М'ятний зелений
  },
} satisfies ChartConfig;

interface OverviewProps {
  data: unknown[];
}

export const RechartBot: React.FC<OverviewProps> = ({ data }) => {
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

        {/* Налаштування підказки при наведенні */}
        <ChartTooltip
          cursor={{ fill: "rgba(16, 185, 129, 0.04)" }}
          content={<ChartTooltipContent hideLabel />}
        />

        {/* Додавання легенди під графіком */}
        <ChartLegend content={<ChartLegendContent />} />

        {/* Тепер var(--color-total) підтягнеться успішно */}
        <Bar
          dataKey="total"
          fill="var(--color-total)"
          name="Загальний дохід"
          radius={[4, 4, 0, 0]}
        />
        {/* Тепер var(--color-bot) підтягнеться успішно */}
        <Bar
          dataKey="bot"
          fill="var(--color-bot)"
          name="Дохід через бота"
          radius={[4, 4, 0, 0]}
        />
      </BarChart>
    </ChartContainer>
  );
};
