import prismadb from "@/lib/prismadb";
import {
  addDays,
  format,
  isWithinInterval,
  parseISO,
  startOfDay,
  subDays,
} from "date-fns";

export type LowBotDevice = {
  deviceId: number;
  networkWater: number;
  botWater: number;
  botShare: number;
};

export type CashHeavyDevice = {
  deviceId: number;
  cash: number;
  totalPaid: number;
  cashShare: number;
};

export type GoalProgress = {
  botShare: number;
  botTarget: number;
  cashShare: number;
  cashTargetMax: number;
  networkWater: number;
  botWater: number;
  cashRevenue: number;
  totalRevenue: number;
};

export type DashboardInsightCards = {
  lowBotDevices: LowBotDevice[];
  cashHeavyDevices: CashHeavyDevice[];
  goals: GoalProgress;
};

function toDayKey(raw: string | null | undefined): string | null {
  const s = raw?.trim();
  if (!s) return null;
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);

  const dmy = s.match(/^(\d{1,2})[./](\d{1,2})[./](\d{4})/);
  if (dmy) {
    return `${dmy[3]}-${dmy[2].padStart(2, "0")}-${dmy[1].padStart(2, "0")}`;
  }

  const parsed = new Date(s);
  if (!Number.isNaN(parsed.getTime())) return format(parsed, "yyyy-MM-dd");
  return null;
}

function pct(part: number, whole: number): number {
  if (!whole || whole <= 0) return 0;
  return Math.round((part / whole) * 1000) / 10;
}

const BOT_TARGET = 25;
const CASH_TARGET_MAX = 40;

export const getDashboardInsightCards =
  async (): Promise<DashboardInsightCards> => {
    const end = startOfDay(subDays(new Date(), 2));
    const start = subDays(end, 29);
    const endExclusive = addDays(end, 1);
    const fetchFrom = subDays(start, 3);
    const fetchTo = addDays(end, 3);

    const startKey = format(start, "yyyy-MM-dd");
    const endKey = format(end, "yyyy-MM-dd");

    const [networkGrouped, botRows, dailyStats, botSnapshots] =
      await Promise.all([
        prismadb.transactions.groupBy({
          by: ["device"],
          where: {
            date: { gte: start, lt: endExclusive },
          },
          _sum: {
            waterFullfilled: true,
            cashPaymant: true,
            cardPaymant: true,
            onlinePaymant: true,
          },
        }),
        // date — рядок; беремо з запасом і фільтруємо в JS
        prismadb.bot_transactions.findMany({
          where: {
            date: { gte: startKey },
          },
          select: {
            device: true,
            date: true,
            waterFullfilled: true,
          },
        }),
        prismadb.daily_statistics.findMany({
          where: { createdAt: { gte: fetchFrom, lt: fetchTo } },
          select: {
            date: true,
            createdAt: true,
            totalWater: true,
            cashRevenue: true,
            totalRevenue: true,
          },
        }),
        prismadb.botAnalyticsDaylySnapshot.findMany({
          where: { createdAt: { gte: fetchFrom, lt: fetchTo } },
          select: { totalWater: true, createdAt: true },
        }),
      ]);

    const botWaterByDevice = new Map<number, number>();
    for (const row of botRows) {
      const key = toDayKey(row.date);
      if (!key || key < startKey || key > endKey) continue;
      const prev = botWaterByDevice.get(row.device) || 0;
      botWaterByDevice.set(
        row.device,
        prev + Math.round(row.waterFullfilled || 0)
      );
    }

    const deviceStats = networkGrouped.map((row) => {
      const networkWater = Math.round(row._sum.waterFullfilled || 0);
      const cash = Math.round(row._sum.cashPaymant || 0);
      const card = Math.round(row._sum.cardPaymant || 0);
      const online = Math.round(row._sum.onlinePaymant || 0);
      const totalPaid = cash + card + online;
      const botWater = botWaterByDevice.get(row.device) || 0;

      return {
        deviceId: row.device,
        networkWater,
        botWater,
        botShare: pct(botWater, networkWater),
        cash,
        totalPaid,
        cashShare: pct(cash, totalPaid),
      };
    });

    // #5: багато наливів мережі, низька частка бота
    const lowBotDevices = [...deviceStats]
      .filter((d) => d.networkWater > 0)
      .sort((a, b) => {
        if (a.botShare !== b.botShare) return a.botShare - b.botShare;
        return b.networkWater - a.networkWater;
      })
      .slice(0, 5)
      .map(({ deviceId, networkWater, botWater, botShare }) => ({
        deviceId,
        networkWater,
        botWater,
        botShare,
      }));

    // #8: найвища частка готівки (з мінімальним оборотом, щоб відсіяти шум)
    const cashHeavyDevices = [...deviceStats]
      .filter((d) => d.totalPaid >= 100)
      .sort((a, b) => {
        if (b.cashShare !== a.cashShare) return b.cashShare - a.cashShare;
        return b.cash - a.cash;
      })
      .slice(0, 5)
      .map(({ deviceId, cash, totalPaid, cashShare }) => ({
        deviceId,
        cash,
        totalPaid,
        cashShare,
      }));

    // #11: ціль vs факт за період
    let networkWater = 0;
    let cashRevenue = 0;
    let totalRevenue = 0;
    for (const row of dailyStats) {
      const key =
        row.date?.match(/^\d{4}-\d{2}-\d{2}/)?.[0] ||
        toDayKey(row.date) ||
        format(row.createdAt, "yyyy-MM-dd");
      if (key < startKey || key > endKey) continue;
      networkWater += Math.round(row.totalWater || 0);
      cashRevenue += Math.round(row.cashRevenue || 0);
      totalRevenue += Math.round(row.totalRevenue || 0);
    }

    let botWater = 0;
    for (const row of botSnapshots) {
      const key = format(row.createdAt, "yyyy-MM-dd");
      const day = parseISO(key);
      if (
        Number.isNaN(day.getTime()) ||
        !isWithinInterval(day, { start, end })
      ) {
        continue;
      }
      botWater += Math.round(row.totalWater || 0);
    }

    const goals: GoalProgress = {
      botShare: pct(botWater, networkWater),
      botTarget: BOT_TARGET,
      cashShare: pct(cashRevenue, totalRevenue),
      cashTargetMax: CASH_TARGET_MAX,
      networkWater,
      botWater,
      cashRevenue,
      totalRevenue,
    };

    return { lowBotDevices, cashHeavyDevices, goals };
  };
