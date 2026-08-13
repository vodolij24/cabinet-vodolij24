"use client";

import { useEffect, useState } from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Overview } from "@/components/overview";
import { Water30DaysChart } from "@/components/water-30-days-chart";
import { BotWater30DaysChart } from "@/components/bot-water-30-days-chart";
import { BotSuccess30DaysChart } from "@/components/bot-success-30-days-chart";
import { BotInactive30DaysChart } from "@/components/bot-inactive-30-days-chart";
import type { MonthRevenuePoint } from "@/actions/get-graph-revenue";
import type { WaterDayPoint } from "@/actions/get-water-last-30-days";
import type { BotSuccessDayPoint } from "@/actions/get-bot-success-30-days";

export function AnalyticsCharts({
  graphRevenue,
  waterLast30Days,
  botSuccess30Days,
}: {
  graphRevenue: MonthRevenuePoint[];
  waterLast30Days: WaterDayPoint[];
  botSuccess30Days: BotSuccessDayPoint[];
}) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="h-[390px] animate-pulse rounded-xl border bg-muted/40"
          />
        ))}
      </div>
    );
  }

  return (
    <>
      <Card className="col-span-4">
        <CardHeader>
          <CardTitle>
            Мережа за 30 днів: налито води та частка готівки
          </CardTitle>
        </CardHeader>
        <CardContent className="pl-2">
          <Water30DaysChart data={waterLast30Days} />
        </CardContent>
      </Card>

      <Card className="col-span-4">
        <CardHeader>
          <CardTitle>
            Бот: налито води та активні користувачі за останні 30 днів
          </CardTitle>
        </CardHeader>
        <CardContent className="pl-2">
          <BotWater30DaysChart data={waterLast30Days} />
        </CardContent>
      </Card>

      <Card className="col-span-4">
        <CardHeader>
          <CardTitle>Отримано коштів за останні 12 місяців</CardTitle>
        </CardHeader>
        <CardContent className="pl-2">
          <Overview data={graphRevenue} />
        </CardContent>
      </Card>

      <Card className="col-span-4">
        <CardHeader>
          <CardTitle>Успіх бота за 30 днів: частка та повернення</CardTitle>
        </CardHeader>
        <CardContent className="pl-2">
          <BotSuccess30DaysChart data={botSuccess30Days} />
        </CardContent>
      </Card>

      <Card className="col-span-4">
        <CardHeader>
          <CardTitle>
            Бот за 30 днів: усього, активні, неактивні та недореєстровані (шт)
          </CardTitle>
        </CardHeader>
        <CardContent className="pl-2">
          <BotInactive30DaysChart data={botSuccess30Days} />
        </CardContent>
      </Card>
    </>
  );
}
