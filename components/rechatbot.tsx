"use client";

import { Bar, BarChart, ResponsiveContainer, XAxis, YAxis } from "recharts";
import { ChartContainer, type ChartConfig } from "@/components/ui/chart";

const chartConfig = {
  desktop: {
    label: "Overall",
    color: "#2563eb",
  },
  mobile: {
    label: "BotOnly",
    color: "#60a5fa",
  },
} satisfies ChartConfig;

interface OverviewProps {
  data: unknown[];
}

export const RechartBot: React.FC<OverviewProps> = ({ data }) => {
  console.log(data);
  return (
    <ChartContainer
      config={chartConfig}
      className="min-h-[200px] w-full h-[350px]" // Виправив height на h-[350px]
    >
      <BarChart accessibilityLayer data={data}>
        {/* Додаємо вісь X (Місяці) */}
        <XAxis
          dataKey="name"
          stroke="#888888"
          fontSize={12}
          tickLine={false}
          axisLine={false}
        />
        {/* Додаємо вісь Y (Гривні) */}
        <YAxis
          stroke="#888888"
          fontSize={12}
          tickLine={false}
          axisLine={false}
          tickFormatter={(value) => `₴${value}`}
        />

        {/* Відображаємо обидва стовпці поруч */}
        <Bar dataKey="total" fill="var(--color-total)" radius={[4, 4, 0, 0]} />
        <Bar dataKey="bot" fill="var(--color-bot)" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ChartContainer>
  );
};
