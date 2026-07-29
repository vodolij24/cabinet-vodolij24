import prismadb from "@/lib/prismadb";
import {
  addMonths,
  eachMonthOfInterval,
  format,
  startOfMonth,
  subMonths,
} from "date-fns";
import { uk } from "date-fns/locale";

export type MonthWaterPoint = {
  name: string;
  total: number;
  bot: number;
};

function toDayKey(raw: string | null | undefined, fallback: Date): string {
  const s = raw?.trim();
  if (!s) return format(fallback, "yyyy-MM-dd");
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);

  const dmy = s.match(/^(\d{1,2})[./](\d{1,2})[./](\d{4})/);
  if (dmy) {
    return `${dmy[3]}-${dmy[2].padStart(2, "0")}-${dmy[1].padStart(2, "0")}`;
  }

  const parsed = new Date(s);
  if (!Number.isNaN(parsed.getTime())) return format(parsed, "yyyy-MM-dd");
  return format(fallback, "yyyy-MM-dd");
}

export const getBotVsTotalGraphRevenue = async (): Promise<MonthWaterPoint[]> => {
  const end = startOfMonth(new Date());
  const start = startOfMonth(subMonths(end, 11));

  const [statistics, botStatistic] = await Promise.all([
    prismadb.daily_statistics.findMany({
      where: {
        createdAt: {
          gte: subMonths(start, 1),
          lt: addMonths(end, 2),
        },
      },
      select: {
        totalWater: true,
        date: true,
        createdAt: true,
      },
    }),
    prismadb.botAnalyticsDaylySnapshot.findMany({
      where: {
        createdAt: {
          gte: start,
          lt: addMonths(end, 1),
        },
      },
      select: {
        totalWater: true,
        createdAt: true,
      },
    }),
  ]);

  const months = eachMonthOfInterval({ start, end });
  const byMonth = new Map<string, MonthWaterPoint>();
  for (const month of months) {
    const key = format(month, "yyyy-MM");
    byMonth.set(key, {
      name: format(month, "LLL yy", { locale: uk }),
      total: 0,
      bot: 0,
    });
  }

  for (const stat of statistics) {
    const dayKey = toDayKey(stat.date, stat.createdAt);
    const monthKey = dayKey.slice(0, 7);
    const bucket = byMonth.get(monthKey);
    if (!bucket) continue;
    bucket.total += Math.round(stat.totalWater || 0);
  }

  for (const stat of botStatistic) {
    const monthKey = format(stat.createdAt, "yyyy-MM");
    const bucket = byMonth.get(monthKey);
    if (!bucket) continue;
    bucket.bot += Math.round(stat.totalWater || 0);
  }

  return months.map((month) => byMonth.get(format(month, "yyyy-MM"))!);
};
