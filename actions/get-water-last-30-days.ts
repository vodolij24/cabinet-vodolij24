import prismadb from "@/lib/prismadb";
import {
  addDays,
  eachDayOfInterval,
  format,
  isWithinInterval,
  parseISO,
  startOfDay,
  subDays,
} from "date-fns";
import { uk } from "date-fns/locale";

export type WaterDayPoint = {
  name: string;
  network: number;
  /** Частка готівки від виручки, % */
  cashShare: number;
  bot: number;
  botUsers: number;
};

/** Нормалізує рядок дати з БД до yyyy-MM-dd */
function toDayKey(raw: string | null | undefined, fallback: Date): string {
  const s = raw?.trim();
  if (!s) return format(fallback, "yyyy-MM-dd");

  if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
    return s.slice(0, 10);
  }

  const dmy = s.match(/^(\d{1,2})[./](\d{1,2})[./](\d{4})/);
  if (dmy) {
    const day = dmy[1].padStart(2, "0");
    const month = dmy[2].padStart(2, "0");
    return `${dmy[3]}-${month}-${day}`;
  }

  const parsed = new Date(s);
  if (!Number.isNaN(parsed.getTime())) {
    return format(parsed, "yyyy-MM-dd");
  }

  return format(fallback, "yyyy-MM-dd");
}

export const getWaterLast30Days = async (): Promise<WaterDayPoint[]> => {
  // Без останніх 2 днів (сьогодні + вчора)
  const end = startOfDay(subDays(new Date(), 2));
  const start = subDays(end, 29);

  // Ширше вікно по createdAt: денний джоб часто пише статистику за день D вже на D+1
  const fetchFrom = subDays(start, 3);
  const fetchTo = addDays(end, 3);

  const [networkStats, botStats, activeBotUsers] = await Promise.all([
    prismadb.daily_statistics.findMany({
      where: { createdAt: { gte: fetchFrom, lt: fetchTo } },
      select: {
        totalWater: true,
        cashRevenue: true,
        totalRevenue: true,
        date: true,
        createdAt: true,
      },
    }),
    prismadb.botAnalyticsDaylySnapshot.findMany({
      where: { createdAt: { gte: fetchFrom, lt: fetchTo } },
      select: { totalWater: true, createdAt: true },
    }),
    prismadb.users.findMany({
      where: {
        updatedAt: { gte: start, lt: addDays(end, 1) },
      },
      select: { id: true, updatedAt: true },
    }),
  ]);

  const networkByDay = new Map<
    string,
    { water: number; cashShare: number }
  >();
  for (const row of networkStats) {
    // Ключ — бізнес-дата зі статистики, не дата запису в БД
    const key = toDayKey(row.date, row.createdAt);
    const day = parseISO(key);
    if (
      Number.isNaN(day.getTime()) ||
      !isWithinInterval(day, { start, end })
    ) {
      continue;
    }

    const cash = row.cashRevenue || 0;
    const total = row.totalRevenue || 0;
    const cashShare =
      total > 0 ? Math.round((cash / total) * 1000) / 10 : 0;

    networkByDay.set(key, {
      water: Math.round(row.totalWater || 0),
      cashShare,
    });
  }

  const botWaterByDay = new Map<string, number>();
  for (const row of botStats) {
    // Для снапшота бізнес-день ≈ календарний день createdAt (локальний)
    const key = format(row.createdAt, "yyyy-MM-dd");
    const day = parseISO(key);
    if (
      Number.isNaN(day.getTime()) ||
      !isWithinInterval(day, { start, end })
    ) {
      continue;
    }
    botWaterByDay.set(
      key,
      (botWaterByDay.get(key) || 0) + Math.round(row.totalWater || 0)
    );
  }

  const botActiveByDay = new Map<string, Set<number>>();
  for (const user of activeBotUsers) {
    const key = format(user.updatedAt, "yyyy-MM-dd");
    if (!botActiveByDay.has(key)) {
      botActiveByDay.set(key, new Set());
    }
    botActiveByDay.get(key)!.add(user.id);
  }

  return eachDayOfInterval({ start, end }).map((day) => {
    const key = format(day, "yyyy-MM-dd");
    const network = networkByDay.get(key);
    return {
      name: format(day, "d MMM", { locale: uk }),
      network: network?.water || 0,
      cashShare: network?.cashShare || 0,
      bot: botWaterByDay.get(key) || 0,
      botUsers: botActiveByDay.get(key)?.size || 0,
    };
  });
};
