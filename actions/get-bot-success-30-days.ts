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

export type BotSuccessDayPoint = {
  name: string;
  botShare: number;
  returningPct: number;
  totalCount: number;
  activeCount: number;
  inactiveCount: number;
  unregisteredCount: number;
};

function toDayKey(
  raw: string | Date | null | undefined,
  fallback?: Date
): string | null {
  if (raw instanceof Date && !Number.isNaN(raw.getTime())) {
    return format(raw, "yyyy-MM-dd");
  }

  const s = typeof raw === "string" ? raw.trim() : "";
  if (!s) {
    return fallback ? format(fallback, "yyyy-MM-dd") : null;
  }

  const iso = s.match(/^(\d{4}-\d{2}-\d{2})/);
  if (iso) return iso[1];

  const dmy = s.match(/^(\d{1,2})[./](\d{1,2})[./](\d{4})/);
  if (dmy) {
    return `${dmy[3]}-${dmy[2].padStart(2, "0")}-${dmy[1].padStart(2, "0")}`;
  }

  const parsed = new Date(s);
  if (!Number.isNaN(parsed.getTime())) return format(parsed, "yyyy-MM-dd");
  return fallback ? format(fallback, "yyyy-MM-dd") : null;
}

function pct(part: number, whole: number): number {
  if (!whole || whole <= 0) return 0;
  return Math.round((part / whole) * 1000) / 10;
}

export const getBotSuccessLast30Days = async (): Promise<
  BotSuccessDayPoint[]
> => {
  const end = startOfDay(subDays(new Date(), 2));
  const start = subDays(end, 29);
  const fetchFrom = subDays(start, 3);
  const fetchTo = addDays(end, 3);
  // Для вікна «30 днів без наливу» на перший день графіка
  const poursFrom = subDays(start, 30);

  const [networkStats, snapshots, menuUsers, allUsers, apiUsers, lastPours] =
    await Promise.all([
      prismadb.daily_statistics.findMany({
        where: { createdAt: { gte: fetchFrom, lt: fetchTo } },
        select: { totalWater: true, date: true, createdAt: true },
      }),
      prismadb.botAnalyticsDaylySnapshot.findMany({
        where: { createdAt: { gte: fetchFrom, lt: fetchTo } },
        select: { totalWater: true, createdAt: true },
      }),
      prismadb.users.findMany({
        where: {
          updatedAt: { gte: start, lt: addDays(end, 1) },
        },
        select: { id: true, createdAt: true, updatedAt: true },
      }),
      prismadb.users.findMany({
        select: { id: true, chat_id: true, createdAt: true },
      }),
      prismadb.apiusers.findMany({
        select: { chat_id: true, cardId: true },
      }),
      // Активність = налив у transactions по cardId
      prismadb.transactions.groupBy({
        by: ["cardId"],
        where: {
          cardId: { not: null, gt: 0 },
          date: { gte: poursFrom, lt: addDays(end, 1) },
          OR: [
            { waterFullfilled: { gt: 0 } },
            { waterRequested: { gt: 0 } },
          ],
        },
        _max: { date: true },
      }),
    ]);

  const userIdByChatId = new Map<string, number>();
  for (const u of allUsers) {
    userIdByChatId.set(u.chat_id.toString(), u.id);
  }

  const userIdByCardId = new Map<number, number>();
  for (const api of apiUsers) {
    const uid = userIdByChatId.get(api.chat_id.toString());
    if (uid == null || api.cardId == null || api.cardId <= 0) continue;
    userIdByCardId.set(api.cardId, uid);
  }

  const registeredUserIds: number[] = [];
  const unregisteredUserIds: number[] = [];
  const userCreatedKey = new Map<number, string>();
  const registeredSet = new Set<number>();

  for (const u of allUsers) {
    userCreatedKey.set(u.id, format(u.createdAt, "yyyy-MM-dd"));
  }

  for (const uid of userIdByCardId.values()) {
    registeredSet.add(uid);
  }

  for (const u of allUsers) {
    if (registeredSet.has(u.id)) {
      registeredUserIds.push(u.id);
    } else {
      unregisteredUserIds.push(u.id);
    }
  }

  // Останній день наливу по user_id (через cardId з transactions)
  const lastPourByUserId = new Map<number, string>();
  for (const row of lastPours) {
    if (row.cardId == null || row.cardId <= 0) continue;
    const uid = userIdByCardId.get(row.cardId);
    if (uid == null) continue;
    const dayKey = toDayKey(row._max.date);
    if (!dayKey) continue;
    const prev = lastPourByUserId.get(uid);
    if (!prev || dayKey > prev) {
      lastPourByUserId.set(uid, dayKey);
    }
  }

  const networkByDay = new Map<string, number>();
  for (const row of networkStats) {
    const key = toDayKey(row.date, row.createdAt);
    if (!key) continue;
    const day = parseISO(key);
    if (Number.isNaN(day.getTime()) || !isWithinInterval(day, { start, end })) {
      continue;
    }
    networkByDay.set(key, Math.round(row.totalWater || 0));
  }

  const botWaterByDay = new Map<string, number>();
  for (const row of snapshots) {
    const key = format(row.createdAt, "yyyy-MM-dd");
    const day = parseISO(key);
    if (Number.isNaN(day.getTime()) || !isWithinInterval(day, { start, end })) {
      continue;
    }
    botWaterByDay.set(
      key,
      (botWaterByDay.get(key) || 0) + Math.round(row.totalWater || 0)
    );
  }

  const menuActiveByDay = new Map<
    string,
    { total: number; returning: number }
  >();
  for (const user of menuUsers) {
    const key = format(user.updatedAt, "yyyy-MM-dd");
    const dayStart = startOfDay(user.updatedAt);
    const bucket = menuActiveByDay.get(key) || { total: 0, returning: 0 };
    bucket.total += 1;
    if (user.createdAt < dayStart) {
      bucket.returning += 1;
    }
    menuActiveByDay.set(key, bucket);
  }

  return eachDayOfInterval({ start, end }).map((day) => {
    const key = format(day, "yyyy-MM-dd");
    const windowStartKey = format(subDays(day, 29), "yyyy-MM-dd");

    let registeredTotal = 0;
    let activeRegistered = 0;
    for (const uid of registeredUserIds) {
      const created = userCreatedKey.get(uid)!;
      if (created > key) continue;
      registeredTotal += 1;

      const lastPour = lastPourByUserId.get(uid);
      if (lastPour && lastPour >= windowStartKey && lastPour <= key) {
        activeRegistered += 1;
      }
    }

    let unregisteredTotal = 0;
    for (const uid of unregisteredUserIds) {
      const created = userCreatedKey.get(uid)!;
      if (created > key) continue;
      unregisteredTotal += 1;
    }

    const network = networkByDay.get(key) || 0;
    const bot = botWaterByDay.get(key) || 0;
    const menuActive = menuActiveByDay.get(key);

    return {
      name: format(day, "d MMM", { locale: uk }),
      botShare: pct(bot, network),
      returningPct: menuActive
        ? pct(menuActive.returning, menuActive.total)
        : 0,
      totalCount: registeredTotal + unregisteredTotal,
      activeCount: activeRegistered,
      inactiveCount: registeredTotal - activeRegistered,
      unregisteredCount: unregisteredTotal,
    };
  });
};
