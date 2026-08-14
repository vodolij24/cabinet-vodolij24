import prismadb from "@/lib/prismadb";
import { kyivTodayBounds } from "@/lib/kyiv-date";

export type MachineTodayStats = {
  liters: number;
  cash: number;
  cashless: number;
};

function roundLiters(n: number): number {
  return Math.round(n * 10) / 10;
}

function roundMoney(n: number): number {
  return Math.round(n * 100) / 100;
}

function looksLikeName(value: string | null | undefined): value is string {
  const s = value?.trim() || "";
  if (s.length < 2) return false;
  if (/^\d+$/.test(s)) return false;
  if (s.startsWith("{") || s.startsWith("[")) return false;
  return true;
}

function botClientName(
  apiName: string | null | undefined,
  bot: {
    firstname: string | null;
    lastname: string | null;
    fathersname: string | null;
  } | null
): string | null {
  if (looksLikeName(apiName)) return apiName.trim();
  if (bot && looksLikeName(bot.firstname) && looksLikeName(bot.lastname)) {
    const full = [bot.lastname, bot.firstname, bot.fathersname]
      .filter((p) => looksLikeName(p))
      .join(" ")
      .trim();
    if (full) return full;
  }
  if (bot && looksLikeName(bot.firstname)) return bot.firstname.trim();
  return null;
}

/** Суми по автоматах за поточний день (Europe/Kyiv) з таблиці transactions */
export async function getMachineTodayStatsMap(): Promise<
  Map<number, MachineTodayStats>
> {
  const { from, to } = kyivTodayBounds();

  const grouped = await prismadb.transactions.groupBy({
    by: ["device"],
    where: {
      date: { gte: from, lte: to },
    },
    _sum: {
      waterFullfilled: true,
      cashPaymant: true,
      cardPaymant: true,
      onlinePaymant: true,
    },
  });

  const map = new Map<number, MachineTodayStats>();
  for (const row of grouped) {
    const cash = row._sum.cashPaymant || 0;
    const card = row._sum.cardPaymant || 0;
    const online = row._sum.onlinePaymant || 0;
    map.set(row.device, {
      liters: roundLiters(row._sum.waterFullfilled || 0),
      cash: roundMoney(cash),
      cashless: roundMoney(card + online),
    });
  }

  return map;
}

export type MachineTxFilter = "all" | "cash" | "cashless";

export type MachineTodayTransaction = {
  id: number;
  date: string;
  liters: number;
  cash: number;
  card: number;
  online: number;
  cashless: number;
  cardId: number | null;
  cardOwner: {
    name: string | null;
    phone: string | null;
    cardNumber: string | null;
  } | null;
};

export async function getMachineTodayTransactions(
  deviceId: number,
  filter: MachineTxFilter = "all",
  range?: { from: Date; to: Date }
): Promise<MachineTodayTransaction[]> {
  const bounds = range ?? kyivTodayBounds();

  const rows = await prismadb.transactions.findMany({
    where: {
      device: deviceId,
      date: { gte: bounds.from, lte: bounds.to },
      ...(filter === "cash"
        ? { cashPaymant: { gt: 0 } }
        : filter === "cashless"
          ? {
              OR: [{ cardPaymant: { gt: 0 } }, { onlinePaymant: { gt: 0 } }],
            }
          : {}),
    },
    orderBy: { date: "desc" },
    select: {
      id: true,
      date: true,
      waterFullfilled: true,
      cashPaymant: true,
      cardPaymant: true,
      onlinePaymant: true,
      cardId: true,
    },
  });

  const cardIds = [
    ...new Set(
      rows
        .map((r) => r.cardId)
        .filter((id): id is number => id != null && id > 0)
    ),
  ];

  const ownerByCardId = new Map<
    number,
    { name: string | null; phone: string | null; cardNumber: string | null }
  >();

  if (cardIds.length > 0) {
    const [apiUsers, cardRows] = await Promise.all([
      prismadb.apiusers.findMany({
        where: { cardId: { in: cardIds } },
        select: {
          cardId: true,
          name: true,
          phone: true,
          chat_id: true,
        },
      }),
      prismadb.cards.findMany({
        where: { cardId: { in: cardIds } },
        select: { cardId: true, Number: true },
      }),
    ]);

    const cardNumberById = new Map(
      cardRows.map((c) => [c.cardId, c.Number || null])
    );

    const chatIds = apiUsers.map((u) => u.chat_id);
    const botUsers =
      chatIds.length > 0
        ? await prismadb.users.findMany({
            where: { chat_id: { in: chatIds } },
            select: {
              chat_id: true,
              firstname: true,
              lastname: true,
              fathersname: true,
              phone: true,
            },
          })
        : [];

    const userByChat = new Map(botUsers.map((u) => [u.chat_id.toString(), u]));

    for (const api of apiUsers) {
      if (api.cardId == null) continue;
      const bot = userByChat.get(api.chat_id.toString());
      ownerByCardId.set(api.cardId, {
        name: botClientName(api.name, bot ?? null),
        phone: (bot?.phone || api.phone || "").trim() || null,
        cardNumber: cardNumberById.get(api.cardId) || null,
      });
    }

    for (const id of cardIds) {
      if (ownerByCardId.has(id)) continue;
      const num = cardNumberById.get(id);
      if (num) {
        ownerByCardId.set(id, {
          name: null,
          phone: null,
          cardNumber: num,
        });
      }
    }
  }

  return rows.map((row) => {
    const cash = roundMoney(row.cashPaymant || 0);
    const card = roundMoney(row.cardPaymant || 0);
    const online = roundMoney(row.onlinePaymant || 0);
    const owner =
      row.cardId != null && row.cardId > 0
        ? ownerByCardId.get(row.cardId) || null
        : null;

    return {
      id: row.id,
      date: row.date.toLocaleString("uk-UA", {
        timeZone: "Europe/Kyiv",
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      }),
      liters: roundLiters(row.waterFullfilled || 0),
      cash,
      card,
      online,
      cashless: roundMoney(card + online),
      cardId: row.cardId,
      cardOwner: owner,
    };
  });
}
