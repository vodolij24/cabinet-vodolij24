"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type {
  CashHeavyDevice,
  GoalProgress,
  LowBotDevice,
} from "@/actions/get-dashboard-insight-cards";

export function LowBotDevicesCard({ items }: { items: LowBotDevice[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">
          Топ апаратів без бота (30 днів)
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Наливи карткою клієнта бота за 30 днів, включно з сьогодні
        </p>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">Немає даних</p>
        ) : (
          <ul className="space-y-3">
            {items.map((item) => (
              <li
                key={item.deviceId}
                className="flex items-center justify-between gap-3 text-sm"
              >
                <div>
                  <div className="font-medium">Апарат №{item.deviceId}</div>
                  <div className="text-muted-foreground">
                    Мережа {item.networkWater} л · бот {item.botWater} л
                  </div>
                </div>
                <div className="text-right font-semibold text-amber-600 dark:text-amber-400">
                  {item.botShare}% бот
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

export function CashHeavyDevicesCard({ items }: { items: CashHeavyDevice[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">
          Апарати-«кешоїди» (30 днів)
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Найвища частка готівки в оплатах — операційний фокус
        </p>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">Немає даних</p>
        ) : (
          <ul className="space-y-3">
            {items.map((item) => (
              <li
                key={item.deviceId}
                className="flex items-center justify-between gap-3 text-sm"
              >
                <div>
                  <div className="font-medium">Апарат №{item.deviceId}</div>
                  <div className="text-muted-foreground">
                    Готівка ₴{item.cash} · усього ₴{item.totalPaid}
                  </div>
                </div>
                <div className="text-right font-semibold text-rose-600 dark:text-rose-400">
                  {item.cashShare}% cash
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

export function GoalsCard({ goals }: { goals: GoalProgress }) {
  const botOk = goals.botShare >= goals.botTarget;
  const cashOk = goals.cashShare <= goals.cashTargetMax;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Ціль vs факт (30 днів)</CardTitle>
        <p className="text-sm text-muted-foreground">
          Бот ≥ {goals.botTarget}% · готівка ≤ {goals.cashTargetMax}%
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span>Частка бота</span>
            <span
              className={
                botOk
                  ? "font-semibold text-emerald-600 dark:text-emerald-400"
                  : "font-semibold text-amber-600 dark:text-amber-400"
              }
            >
              {goals.botShare}% / {goals.botTarget}%
            </span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
            <div
              className={`h-full rounded-full ${
                botOk ? "bg-emerald-500" : "bg-amber-500"
              }`}
              style={{
                width: `${Math.min(
                  (goals.botShare / goals.botTarget) * 100,
                  100
                )}%`,
              }}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            {goals.botWater} л бот / {goals.networkWater} л мережа
          </p>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span>Частка готівки</span>
            <span
              className={
                cashOk
                  ? "font-semibold text-emerald-600 dark:text-emerald-400"
                  : "font-semibold text-rose-600 dark:text-rose-400"
              }
            >
              {goals.cashShare}% / ≤{goals.cashTargetMax}%
            </span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
            <div
              className={`h-full rounded-full ${
                cashOk ? "bg-emerald-500" : "bg-rose-500"
              }`}
              style={{
                width: `${Math.min(goals.cashShare, 100)}%`,
              }}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            ₴{goals.cashRevenue} готівка / ₴{goals.totalRevenue} виручка
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

function moneyUa(n: number) {
  return `${n.toLocaleString("uk-UA", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} грн`;
}

export function CashCard({
  total,
  inMachines,
  withTechnicians,
  machinesWithCash,
  machinesCount,
  technicians,
}: {
  total: number;
  inMachines: number;
  withTechnicians: number;
  machinesWithCash: number;
  machinesCount: number;
  technicians: Array<{
    technicianId: number | null;
    name: string;
    collections: number;
    amount: number;
  }>;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Готівка на руках</CardTitle>
        <p className="text-xs text-muted-foreground">
          Апарати + нездані інкасації
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-2xl font-semibold tabular-nums tracking-tight">
          {moneyUa(total)}
        </p>
        <div className="space-y-1 text-xs">
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-muted-foreground">
              В апаратах
              <span className="ml-1 text-[11px]">
                ({machinesWithCash}/{machinesCount})
              </span>
            </span>
            <span className="font-medium tabular-nums">{moneyUa(inMachines)}</span>
          </div>
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-muted-foreground">У техніків</span>
            <span className="font-medium tabular-nums">
              {moneyUa(withTechnicians)}
            </span>
          </div>
        </div>
        {technicians.length === 0 ? (
          <p className="text-xs text-muted-foreground">Немає незданих</p>
        ) : (
          <ul className="max-h-28 space-y-1 overflow-y-auto pr-1 text-xs">
            {technicians.map((t) => (
              <li
                key={t.technicianId ?? "none"}
                className="flex items-baseline justify-between gap-2"
              >
                <span className="truncate text-muted-foreground">
                  {t.name}
                  <span className="ml-1 tabular-nums">
                    · {t.collections}
                  </span>
                </span>
                <span className="shrink-0 font-medium tabular-nums">
                  {moneyUa(t.amount)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
