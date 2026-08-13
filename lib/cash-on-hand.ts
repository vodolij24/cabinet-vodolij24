import prismadb from "@/lib/prismadb";
import { decimalToNumber } from "@/lib/collection-fields";
import { getTotalCashInMachines } from "@/lib/machine-cashbox";

export type TechnicianCashOnHand = {
  technicianId: number | null;
  name: string;
  collections: number;
  amount: number;
};

export type CashOnHandSnapshot = {
  inMachines: number;
  machinesWithCash: number;
  machinesCount: number;
  withTechnicians: number;
  technicians: TechnicianCashOnHand[];
  total: number;
};

function roundMoney(n: number) {
  return Math.round(n * 100) / 100;
}

function collectionAmount(row: {
  total_sum: unknown;
  sum_coins: unknown;
  sum_banknotes: unknown;
}) {
  return (
    decimalToNumber(row.total_sum) ||
    decimalToNumber(row.sum_coins) + decimalToNumber(row.sum_banknotes)
  );
}

/**
 * Готівка на руках: кеш в автоматах + нездані (і не закриті здачею) інкасації техніків.
 */
export async function getCashOnHandSnapshot(): Promise<CashOnHandSnapshot> {
  const [inMachines, unhanded, machines, technicians] = await Promise.all([
    getTotalCashInMachines(),
    loadUnhandedCollections(),
    prismadb.vending_machines.findMany({
      select: { id: true, technicianId: true },
    }),
    prismadb.workers.findMany({
      where: {
        role: "technician",
        OR: [{ active: true }, { active: null }],
      },
      select: { id: true, name: true },
    }),
  ]);

  const machineTech = new Map(
    machines.map((m) => [m.id, m.technicianId ?? null])
  );
  const techName = new Map(
    technicians.map((t) => [t.id, t.name || `Технік #${t.id}`])
  );

  const byTech = new Map<
    number | "none",
    { technicianId: number | null; amount: number; collections: number }
  >();

  for (const row of unhanded) {
    const technicianId =
      row.technicianId ??
      (row.device_id != null ? machineTech.get(row.device_id) ?? null : null);
    const key = technicianId ?? "none";
    const prev = byTech.get(key) ?? {
      technicianId,
      amount: 0,
      collections: 0,
    };
    prev.amount += collectionAmount(row);
    prev.collections += 1;
    byTech.set(key, prev);
  }

  const list: TechnicianCashOnHand[] = Array.from(byTech.values()).map(
    (row) => ({
      technicianId: row.technicianId,
      name:
        row.technicianId != null
          ? techName.get(row.technicianId) || `Технік #${row.technicianId}`
          : "Без техніка",
      collections: row.collections,
      amount: roundMoney(row.amount),
    })
  );

  const extraIds = list
    .map((t) => t.technicianId)
    .filter((id): id is number => id != null && !techName.has(id));
  if (extraIds.length > 0) {
    const extra = await prismadb.workers.findMany({
      where: { id: { in: extraIds } },
      select: { id: true, name: true },
    });
    const extraMap = new Map(extra.map((w) => [w.id, w.name]));
    for (const row of list) {
      if (row.technicianId != null && extraMap.has(row.technicianId)) {
        row.name = extraMap.get(row.technicianId) || row.name;
      }
    }
  }

  list.sort((a, b) => b.amount - a.amount || a.name.localeCompare(b.name, "uk"));

  const withTechnicians = roundMoney(
    list.reduce((s, t) => s + t.amount, 0)
  );

  return {
    inMachines: inMachines.total,
    machinesWithCash: inMachines.machinesWithCash,
    machinesCount: inMachines.machinesCount,
    withTechnicians,
    technicians: list,
    total: roundMoney(inMachines.total + withTechnicians),
  };
}

async function loadUnhandedCollections() {
  try {
    return await prismadb.$queryRawUnsafe<
      Array<{
        technicianId: number | null;
        device_id: number | null;
        total_sum: unknown;
        sum_coins: unknown;
        sum_banknotes: unknown;
      }>
    >(
      `SELECT c."technicianId", c.device_id, c.total_sum, c.sum_coins, c.sum_banknotes
       FROM collections c
       WHERE c."handoverId" IS NULL`
    );
  } catch (error) {
    console.error("[CASH_ON_HAND_UNHANDED]", error);
    return [];
  }
}
