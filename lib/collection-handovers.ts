import prismadb from "@/lib/prismadb";

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
    const sql =
      cashierId != null
        ? "SELECT id, technician_id, cashier_id, claimed_packages, received_packages, machine_count, collection_count, created_at FROM collection_handovers WHERE cashier_id = " +
          asInt(cashierId) +
          " ORDER BY created_at DESC"
        : "SELECT id, technician_id, cashier_id, claimed_packages, received_packages, machine_count, collection_count, created_at FROM collection_handovers ORDER BY created_at DESC";
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
    ", NOW()) RETURNING id, technician_id, cashier_id, claimed_packages, received_packages, machine_count, collection_count, created_at";

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
