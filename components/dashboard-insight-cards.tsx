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
          Багато наливів мережі, низька частка бота — куди ставити QR / наклейки
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
    <Card className="xl:col-span-2">
      <CardHeader>
        <CardTitle className="text-base">Готівка на руках</CardTitle>
        <p className="text-sm text-muted-foreground">
          Кеш в апаратах + нездані інкасації техніків
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <p className="text-sm text-muted-foreground">Разом</p>
          <p className="text-3xl font-semibold tabular-nums tracking-tight">
            {moneyUa(total)}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <p className="text-muted-foreground">Кеш в апаратах</p>
            <p className="font-semibold tabular-nums">{moneyUa(inMachines)}</p>
            <p className="text-xs text-muted-foreground">
              {machinesWithCash} з {machinesCount} апаратів
            </p>
          </div>
          <div>
            <p className="text-muted-foreground">На руках у техніків</p>
            <p className="font-semibold tabular-nums">
              {moneyUa(withTechnicians)}
            </p>
            <p className="text-xs text-muted-foreground">нездані інкасації</p>
          </div>
        </div>

        <div>
          <p className="mb-2 text-sm font-medium">По техніках</p>
          {technicians.length === 0 ? (
            <p className="text-sm text-muted-foreground">Немає незданих інкасацій</p>
          ) : (
            <ul className="max-h-56 space-y-2 overflow-y-auto pr-1">
              {technicians.map((t) => (
                <li
                  key={t.technicianId ?? "none"}
                  className="flex items-center justify-between gap-3 text-sm"
                >
                  <div>
                    <div className="font-medium">{t.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {t.collections.toLocaleString("uk-UA")} незданих
                    </div>
                  </div>
                  <div className="text-right font-semibold tabular-nums">
                    {moneyUa(t.amount)}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
