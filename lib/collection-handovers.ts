import prismadb from "@/lib/prismadb";
import { addCashierExtraPackage } from "@/lib/collection-lifecycle";
import { ensureCollectionMvpSchema } from "@/lib/collection-schema";
import { asInt, intList } from "@/lib/collection-sql";

export type PendingHandoverStats = {
  collectionCount: number;
  machineCount: number;
  collectionIds: number[];
  since: string | null;
};

export type HandoverRecord = {
  id: number;
  technicianId: number;
  cashierId: number;
  claimedPackages: number;
  receivedPackages: number;
  machineCount: number;
  collectionCount: number;
  createdAt: Date;
  recountClosedAt: Date | null;
};

type HandoverRow = {
  id: number;
  technician_id: number;
  cashier_id: number;
  claimed_packages: number;
  received_packages: number;
  machine_count: number;
  collection_count: number;
  created_at: Date;
  recount_closed_at: Date | null;
};

function mapHandover(r: HandoverRow): HandoverRecord {
  return {
    id: r.id,
    technicianId: r.technician_id,
    cashierId: r.cashier_id,
    claimedPackages: r.claimed_packages,
    receivedPackages: r.received_packages,
    machineCount: r.machine_count,
    collectionCount: r.collection_count,
    createdAt: r.created_at,
    recountClosedAt: r.recount_closed_at ?? null,
  };
}

function emptyPending(): PendingHandoverStats {
  return {
    collectionCount: 0,
    machineCount: 0,
    collectionIds: [],
    since: null,
  };
}

let noDeviceColReady = false;

export async function ensureCollectionsNoDeviceDataColumn() {
  if (noDeviceColReady) return;
  await ensureCollectionMvpSchema();
  noDeviceColReady = true;
}

/** Закрити відкриті здачі, де були пакети, але жодна інкасація не привʼязана. */
export async function closeOrphanOpenHandovers(): Promise<number> {
  try {
    const result = await prismadb.$executeRawUnsafe(`
      UPDATE collection_handovers h
      SET recount_closed_at = NOW()
      WHERE h.recount_closed_at IS NULL
        AND (h.claimed_packages > 0 OR h.received_packages > 0)
        AND NOT EXISTS (
          SELECT 1 FROM collections c WHERE c."handoverId" = h.id
        )
    `);
    return typeof result === "number" ? result : 0;
  } catch (error) {
    console.error("[HANDOVER_CLOSE_ORPHANS]", error);
    return 0;
  }
}

async function technicianMachineIds(technicianId: number): Promise<number[]> {
  const machines = await prismadb.vending_machines.findMany({
    where: { technicianId },
    select: { id: true },
  });
  return machines.map((m) => m.id);
}

export async function getLastHandoverAt(
  technicianId: number
): Promise<Date | null> {
  try {
    const sql =
      "SELECT created_at FROM collection_handovers WHERE technician_id = " +
      asInt(technicianId) +
      " ORDER BY created_at DESC LIMIT 1";
    const rows = await prismadb.$queryRawUnsafe<Array<{ created_at: Date }>>(
      sql
    );
    return rows[0]?.created_at ?? null;
  } catch (error) {
    console.error("[HANDOVER_LAST]", error);
    return null;
  }
}

export async function getPendingHandoverStats(
  technicianId: number
): Promise<PendingHandoverStats> {
  try {
    await ensureCollectionMvpSchema();
    const techId = asInt(technicianId);
    const machineIds = await technicianMachineIds(technicianId);
    const machineFilter =
      machineIds.length > 0
        ? ` OR c.device_id IN (${intList(machineIds)})`
        : "";

    const rows = await prismadb.$queryRawUnsafe<
      Array<{ id: number; device_id: number | null; date: Date }>
    >(
      `SELECT c.id, c.device_id, c.date
       FROM collections c
       WHERE c."handoverId" IS NULL
         AND COALESCE(c.status, 'on_hand') = 'on_hand'
         AND c.date >= TIMESTAMPTZ '2026-09-10 00:00:00+03'
         AND (c."technicianId" = ${techId}${machineFilter})`
    );

    const machines = new Set<number>();
    for (const row of rows) {
      if (row.device_id != null) machines.add(row.device_id);
    }

    const latest = rows.reduce<Date | null>((acc, row) => {
      if (!acc || row.date.getTime() > acc.getTime()) return row.date;
      return acc;
    }, null);

    return {
      collectionCount: rows.length,
      machineCount: machines.size,
      collectionIds: rows.map((r) => r.id),
      since: latest ? latest.toISOString() : null,
    };
  } catch (error) {
    console.error("[HANDOVER_PENDING]", error);
    return emptyPending();
  }
}

export async function listHandovers(
  cashierId?: number
): Promise<HandoverRecord[]> {
  try {
    await closeOrphanOpenHandovers();
    const sql =
      cashierId != null
        ? "SELECT id, technician_id, cashier_id, claimed_packages, received_packages, machine_count, collection_count, created_at, recount_closed_at FROM collection_handovers WHERE cashier_id = " +
          asInt(cashierId) +
          " ORDER BY created_at DESC"
        : "SELECT id, technician_id, cashier_id, claimed_packages, received_packages, machine_count, collection_count, created_at, recount_closed_at FROM collection_handovers ORDER BY created_at DESC";
    const rows = await prismadb.$queryRawUnsafe<HandoverRow[]>(sql);
    return rows.map(mapHandover);
  } catch (error) {
    console.error("[HANDOVER_LIST]", error);
    return [];
  }
}

export async function createHandover(input: {
  technicianId: number;
  cashierId: number;
  claimedPackages: number;
  receivedPackages: number;
}): Promise<HandoverRecord> {
  const pending = await getPendingHandoverStats(input.technicianId);
  const technicianId = asInt(input.technicianId);
  const cashierId = asInt(input.cashierId);
  const claimed = asInt(input.claimedPackages);
  const received = asInt(input.receivedPackages);

  const sql =
    "INSERT INTO collection_handovers (technician_id, cashier_id, claimed_packages, received_packages, machine_count, collection_count, created_at) VALUES (" +
    technicianId +
    ", " +
    cashierId +
    ", " +
    claimed +
    ", " +
    received +
    ", " +
    asInt(pending.machineCount) +
    ", " +
    asInt(pending.collectionCount) +
    ", NOW()) RETURNING id, technician_id, cashier_id, claimed_packages, received_packages, machine_count, collection_count, created_at, recount_closed_at";

  const inserted = await prismadb.$queryRawUnsafe<HandoverRow[]>(sql);
  const row = inserted[0];
  if (!row) {
    throw new Error("Не вдалося створити здачу");
  }

  if (pending.collectionIds.length > 0) {
    await prismadb.$executeRawUnsafe(
      'UPDATE collections SET "handoverId" = ' +
        asInt(row.id) +
        ', "technicianId" = COALESCE("technicianId", ' +
        technicianId +
        "), status = 'handed', updated_at = NOW() WHERE id IN (" +
        intList(pending.collectionIds) +
        ') AND "handoverId" IS NULL'
    );
  }

  return mapHandover(row);
}

export async function addManualHandoverPackage(input: {
  cashierId: number;
  cashierName?: string;
  handoverId: number;
  deviceId: number;
  amount: number;
  comment?: string | null;
}): Promise<{ collectionId: number; handoverClosed: boolean }> {
  return addCashierExtraPackage({
    cashierId: input.cashierId,
    cashierName: input.cashierName || "Касир",
    handoverId: input.handoverId,
    deviceId: input.deviceId,
    amount: input.amount,
    comment: input.comment,
  });
}
