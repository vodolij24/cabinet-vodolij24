import prismadb from "@/lib/prismadb";

export type MachineCashbox = {
  /** Готівка в автоматі після останньої інкасації */
  cashInMachine: number;
  /** Дата останньої інкасації (uk-UA) */
  lastCollectionDate: string | null;
  /** Сума останньої інкасації */
  lastCollectionSum: number | null;
};

function roundMoney(n: number): number {
  return Math.round(n * 100) / 100;
}

function toNumber(value: unknown): number {
  if (typeof value === "number") return value;
  if (typeof value === "string") return parseFloat(value) || 0;
  if (value && typeof value === "object" && "toNumber" in value) {
    return (value as { toNumber: () => number }).toNumber();
  }
  return Number(value) || 0;
}

/**
 * Каса по автоматах:
 * - остання інкасація з `collections`
 * - готівка в автоматі = сума cashPaymant після дати останньої інкасації
 */
export async function getMachineCashboxMap(
  deviceIds: number[]
): Promise<Map<number, MachineCashbox>> {
  const map = new Map<number, MachineCashbox>();
  for (const id of deviceIds) {
    map.set(id, {
      cashInMachine: 0,
      lastCollectionDate: null,
      lastCollectionSum: null,
    });
  }
  if (deviceIds.length === 0) return map;

  const collections = await prismadb.collections.findMany({
    where: { device_id: { in: deviceIds } },
    orderBy: { date: "desc" },
    select: {
      device_id: true,
      date: true,
      total_sum: true,
      sum_banknotes: true,
      sum_coins: true,
    },
  });

  const lastByDevice = new Map<
    number,
    { date: Date; sum: number }
  >();

  for (const row of collections) {
    if (row.device_id == null) continue;
    if (lastByDevice.has(row.device_id)) continue;
    const sum =
      toNumber(row.total_sum) ||
      toNumber(row.sum_banknotes) + toNumber(row.sum_coins);
    lastByDevice.set(row.device_id, { date: row.date, sum });
  }

  // Мінімальна дата останньої інкасації — щоб обмежити вибірку транзакцій
  let minSince: Date | null = null;
  for (const last of lastByDevice.values()) {
    if (!minSince || last.date < minSince) minSince = last.date;
  }

  const cashTx = await prismadb.transactions.findMany({
    where: {
      device: { in: deviceIds },
      cashPaymant: { gt: 0 },
      ...(minSince ? { date: { gt: minSince } } : {}),
    },
    select: {
      device: true,
      date: true,
      cashPaymant: true,
    },
  });

  const cashByDevice = new Map<number, number>();
  for (const tx of cashTx) {
    const last = lastByDevice.get(tx.device);
    if (last && tx.date <= last.date) continue;
    cashByDevice.set(
      tx.device,
      (cashByDevice.get(tx.device) || 0) + (tx.cashPaymant || 0)
    );
  }

  // Автомати без інкасації: уся готівка (уже в cashTx якщо minSince=null,
  // або окремо якщо minSince був і відсік їх)
  const devicesWithoutCollection = deviceIds.filter(
    (id) => !lastByDevice.has(id)
  );
  if (devicesWithoutCollection.length > 0 && minSince) {
    const allCash = await prismadb.transactions.groupBy({
      by: ["device"],
      where: {
        device: { in: devicesWithoutCollection },
        cashPaymant: { gt: 0 },
      },
      _sum: { cashPaymant: true },
    });
    for (const row of allCash) {
      cashByDevice.set(row.device, row._sum.cashPaymant || 0);
    }
  }

  for (const id of deviceIds) {
    const last = lastByDevice.get(id);
    map.set(id, {
      cashInMachine: roundMoney(cashByDevice.get(id) || 0),
      lastCollectionDate: last
        ? last.date.toLocaleString("uk-UA", {
            timeZone: "Europe/Kyiv",
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          })
        : null,
      lastCollectionSum: last ? roundMoney(last.sum) : null,
    });
  }

  return map;
}

/** Сума неінкасованої готівки по всіх автоматах мережі */
export async function getTotalCashInMachines(): Promise<{
  total: number;
  machinesWithCash: number;
  machinesCount: number;
}> {
  const machines = await prismadb.vending_machines.findMany({
    select: { id: true },
  });
  const ids = machines.map((m) => m.id);
  const map = await getMachineCashboxMap(ids);

  let total = 0;
  let machinesWithCash = 0;
  for (const row of map.values()) {
    total += row.cashInMachine;
    if (row.cashInMachine > 0) machinesWithCash += 1;
  }

  return {
    total: roundMoney(total),
    machinesWithCash,
    machinesCount: ids.length,
  };
}
