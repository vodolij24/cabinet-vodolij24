import prismadb from "@/lib/prismadb";
import { cashierMachineLabel } from "@/lib/collection-fields";
import { closeHandoverRecountIfDone } from "@/lib/collection-recount";

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

function asInt(n: number) {
  const v = Number(n);
  if (!Number.isInteger(v) || v < 0) {
    throw new Error("Invalid int");
  }
  return v;
}

function intList(ids: number[]) {
  return ids.map(asInt).join(",");
}

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
  await prismadb.$executeRawUnsafe(`
    ALTER TABLE collections
    ADD COLUMN IF NOT EXISTS no_device_data BOOLEAN NOT NULL DEFAULT FALSE
  `);
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
    const since = await getLastHandoverAt(technicianId);
    const machineIds = await technicianMachineIds(technicianId);

    const rows = machineIds.length
      ? await prismadb.collections.findMany({
          where: { device_id: { in: machineIds } },
          select: { id: true, device_id: true, date: true },
        })
      : await prismadb.collections.findMany({
          where: { technicianId },
          select: { id: true, device_id: true, date: true },
        });

    const afterCutoff = since
      ? rows.filter((r) => r.date.getTime() > since.getTime())
      : rows;

    const machines = new Set<number>();
    for (const row of afterCutoff) {
      if (row.device_id != null) machines.add(row.device_id);
    }

    return {
      collectionCount: afterCutoff.length,
      machineCount: machines.size,
      collectionIds: afterCutoff.map((r) => r.id),
      since: since ? since.toISOString() : null,
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
        "), updated_at = NOW() WHERE id IN (" +
        intList(pending.collectionIds) +
        ') AND "handoverId" IS NULL'
    );
  }

  return mapHandover(row);
}

export async function addManualHandoverPackage(input: {
  cashierId: number;
  handoverId: number;
  deviceId: number;
  amount: number;
}): Promise<{ collectionId: number; handoverClosed: boolean }> {
  await ensureCollectionsNoDeviceDataColumn();

  const cashierId = asInt(input.cashierId);
  const handoverId = asInt(input.handoverId);
  const deviceId = asInt(input.deviceId);
  if (!Number.isFinite(input.amount) || input.amount < 0) {
    throw new Error("AMOUNT_REQUIRED");
  }
  const amount = Math.round(input.amount * 100) / 100;

  const owned = await prismadb.$queryRawUnsafe<
    Array<{
      id: number;
      technician_id: number;
      received_packages: number;
      recount_closed_at: Date | null;
    }>
  >(
    `SELECT id, technician_id, received_packages, recount_closed_at
     FROM collection_handovers
     WHERE id = ${handoverId} AND cashier_id = ${cashierId}
     LIMIT 1`
  );
  const handover = owned[0];
  if (!handover) throw new Error("NOT_FOUND");
  if (handover.recount_closed_at) throw new Error("HANDOVER_CLOSED");

  const machine = await prismadb.vending_machines.findFirst({
    where: { id: deviceId },
    select: { id: true, location: true, address: true, name: true },
  });
  const location =
    machine?.location?.trim() || machine?.address?.trim() || null;
  const label = cashierMachineLabel(deviceId, location, null);
  const labelSql = label.replace(/'/g, "''");
  const noteSql = "Апарат не передав дані інкасації".replace(/'/g, "''");

  const inserted = await prismadb.$queryRawUnsafe<Array<{ id: number }>>(
    `INSERT INTO collections (
       date, count_banknotes, sum_banknotes, count_coins, sum_coins, total_sum,
       note, machine, device_id, "technicianId", "handoverId",
       "actualReceived", "recountStatus", no_device_data, created_at, updated_at
     ) VALUES (
       NOW(), 0, 0, 0, 0, ${amount.toFixed(2)},
       '${noteSql}', '${labelSql}', ${deviceId}, ${asInt(handover.technician_id)}, ${handoverId},
       ${amount.toFixed(2)}, 'done', TRUE, NOW(), NOW()
     )
     RETURNING id`
  );
  const collectionId = inserted[0]?.id;
  if (!collectionId) throw new Error("CREATE_FAILED");

  await prismadb.$executeRawUnsafe(`
    UPDATE collection_handovers
    SET collection_count = (
          SELECT COUNT(*)::int FROM collections WHERE "handoverId" = ${handoverId}
        ),
        machine_count = (
          SELECT COUNT(DISTINCT device_id)::int
          FROM collections
          WHERE "handoverId" = ${handoverId} AND device_id IS NOT NULL
        )
    WHERE id = ${handoverId}
  `);

  const close = await closeHandoverRecountIfDone(handoverId);
  return { collectionId, handoverClosed: close.closed };
}
