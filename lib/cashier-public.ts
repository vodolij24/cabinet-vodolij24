import prismadb from "@/lib/prismadb";
import { digitsOnlyPhone } from "@/lib/phone";
import { kyivDateLabel, kyivTimeLabel } from "@/lib/kyiv-date";
import { listHandovers } from "@/lib/collection-handovers";
import { decimalToNumber } from "@/lib/collection-fields";

export type CashierPublicHandover = {
  id: number;
  technicianId: number;
  technicianName: string;
  claimedPackages: number;
  receivedPackages: number;
  machineCount: number;
  collectionCount: number;
  createdAt: string;
  dateLabel: string;
  timeLabel: string;
};

export type CashierPublicTechnician = {
  id: number;
  name: string;
};

export type CashierPublicPackage = {
  id: number;
  machine: string;
  technicianName: string;
  dateLabel: string;
  timeLabel: string;
  sumCoins: number;
  sumBanknotes: number;
  total: number;
  actualReceived: number | null;
  recountStatus: string | null;
  handoverId: number;
};

export type CashierPublicPage = {
  cashier: {
    id: number;
    name: string | null;
    phoneDigits: string;
  };
  technicians: CashierPublicTechnician[];
  handovers: CashierPublicHandover[];
  packages: CashierPublicPackage[];
};

export async function findCashierByPhoneDigits(phoneDigits: string) {
  const workers = await prismadb.workers.findMany({
    where: {
      role: "cashier",
      OR: [{ active: true }, { active: null }],
      phone: { not: null },
    },
    select: { id: true, name: true, phone: true },
  });

  return (
    workers.find((w) => digitsOnlyPhone(w.phone) === phoneDigits) || null
  );
}

export async function getCashierPublicPage(
  phoneDigits: string
): Promise<CashierPublicPage | null> {
  const cashier = await findCashierByPhoneDigits(phoneDigits);
  if (!cashier) return null;

  const [technicians, handovers] = await Promise.all([
    prismadb.workers.findMany({
      where: {
        role: "technician",
        OR: [{ active: true }, { active: null }],
      },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    listHandovers(cashier.id).catch((error) => {
      console.error("[CASHIER_HANDOVERS_LIST]", error);
      return [] as Awaited<ReturnType<typeof listHandovers>>;
    }),
  ]);

  const techById = new Map(technicians.map((t) => [t.id, t.name]));
  const extraIds = [
    ...new Set(
      handovers
        .map((h) => h.technicianId)
        .filter((id) => !techById.has(id))
    ),
  ];
  if (extraIds.length > 0) {
    const extra = await prismadb.workers.findMany({
      where: { id: { in: extraIds } },
      select: { id: true, name: true },
    });
    for (const t of extra) {
      techById.set(t.id, t.name);
    }
  }

  return {
    cashier: {
      id: cashier.id,
      name: cashier.name,
      phoneDigits,
    },
    technicians: technicians.map((t) => ({
      id: t.id,
      name: t.name || `Технік #${t.id}`,
    })),
    packages: await loadCashierPackages(cashier.id, techById),
    handovers: handovers.map((h) => ({
      id: h.id,
      technicianId: h.technicianId,
      technicianName: techById.get(h.technicianId) || `Технік #${h.technicianId}`,
      claimedPackages: h.claimedPackages,
      receivedPackages: h.receivedPackages,
      machineCount: h.machineCount,
      collectionCount: h.collectionCount,
      createdAt: h.createdAt.toISOString(),
      dateLabel: kyivDateLabel(h.createdAt),
      timeLabel: kyivTimeLabel(h.createdAt),
    })),
  };
}

async function loadCashierPackages(
  cashierId: number,
  techById: Map<number, string | null>
): Promise<CashierPublicPackage[]> {
  try {
    const rows = await prismadb.$queryRawUnsafe<
      Array<{
        id: number;
        machine: string;
        date: Date;
        total_sum: unknown;
        sum_coins: unknown;
        sum_banknotes: unknown;
        actualReceived: unknown;
        recountStatus: string | null;
        handoverId: number;
        technicianId: number | null;
      }>
    >(
      `SELECT c.id, c.machine, c.date, c.total_sum, c.sum_coins, c.sum_banknotes,
              c."actualReceived", c."recountStatus", c."handoverId", c."technicianId"
       FROM collections c
       JOIN collection_handovers h ON h.id = c."handoverId"
       WHERE h.cashier_id = ${cashierId}
         AND h.recount_closed_at IS NULL
       ORDER BY c.date DESC`
    );
    return rows.map((r) => ({
      id: r.id,
      machine: r.machine || "—",
      technicianName:
        (r.technicianId != null ? techById.get(r.technicianId) : null) ||
        "—",
      dateLabel: kyivDateLabel(r.date),
      timeLabel: kyivTimeLabel(r.date),
      sumCoins: decimalToNumber(r.sum_coins),
      sumBanknotes: decimalToNumber(r.sum_banknotes),
      total: decimalToNumber(r.total_sum),
      actualReceived:
        r.actualReceived == null ? null : decimalToNumber(r.actualReceived),
      recountStatus: r.recountStatus,
      handoverId: r.handoverId,
    }));
  } catch (error) {
    console.error("[CASHIER_PACKAGES]", error);
    return [];
  }
}
