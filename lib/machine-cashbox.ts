import prismadb from "@/lib/prismadb";

export type MachineCashbox = {
  /** Готівка в автоматі після останньої інкасації */
  cashInMachine: number;
  /** Дата останньої інкасації (uk-UA) */
  lastCollectionDate: string | null;
  lastCollectionMs: number | null;
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

function intList(ids: number[]) {
  return ids.filter((id) => Number.isInteger(id) && id > 0).join(",");
}

function formatLastDate(date: Date) {
  return date.toLocaleString("uk-UA", {
    timeZone: "Europe/Kyiv",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
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
      lastCollectionMs: null,
      lastCollectionSum: null,
    });
  }
  const list = intList(deviceIds);
  if (!list) return map;

  try {
    const rows = await prismadb.$queryRawUnsafe<
      Array<{
        device_id: number;
        last_date: Date | null;
        last_sum: unknown;
        cash: unknown;
      }>
    >(
      `WITH last_col AS (
         SELECT DISTINCT ON (device_id)
           device_id,
           date AS last_date,
           COALESCE(NULLIF(total_sum, 0), sum_banknotes + sum_coins) AS last_sum
         FROM collections
         WHERE device_id IN (${list})
         ORDER BY device_id, date DESC
       ),
       cash_after AS (
         SELECT t.device AS device_id, SUM(t."cashPaymant") AS cash
         FROM transactions t
         JOIN last_col lc ON lc.device_id = t.device AND t.date > lc.last_date
         WHERE t.device IN (${list}) AND t."cashPaymant" > 0
         GROUP BY t.device
       ),
       cash_never AS (
         SELECT t.device AS device_id, SUM(t."cashPaymant") AS cash
         FROM transactions t
         WHERE t.device IN (${list})
           AND t."cashPaymant" > 0
           AND t.device NOT IN (SELECT device_id FROM last_col)
         GROUP BY t.device
       )
       SELECT
         d.device_id,
         lc.last_date,
         lc.last_sum,
         COALESCE(ca.cash, cn.cash, 0) AS cash
       FROM (SELECT unnest(ARRAY[${list}]::int[]) AS device_id) d
       LEFT JOIN last_col lc ON lc.device_id = d.device_id
       LEFT JOIN cash_after ca ON ca.device_id = d.device_id
       LEFT JOIN cash_never cn ON cn.device_id = d.device_id`
    );

    for (const row of rows) {
      map.set(row.device_id, {
        cashInMachine: roundMoney(toNumber(row.cash)),
        lastCollectionDate: row.last_date ? formatLastDate(row.last_date) : null,
        lastCollectionMs: row.last_date ? row.last_date.getTime() : null,
        lastCollectionSum:
          row.last_sum == null ? null : roundMoney(toNumber(row.last_sum)),
      });
    }
  } catch (error) {
    console.error("[MACHINE_CASHBOX_SQL]", error);
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
