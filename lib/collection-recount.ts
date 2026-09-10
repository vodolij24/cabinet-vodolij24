import prismadb from "@/lib/prismadb";
import { decimalToNumber } from "@/lib/collection-fields";
import {
  applyCollectionFact,
  closeHandoverIfComplete,
} from "@/lib/collection-lifecycle";
import { asInt } from "@/lib/collection-sql";
import type { CollectionActor } from "@/lib/collection-status";

export type RecountResult = {
  id: number;
  missing: boolean;
  actualReceived: number | null;
  handoverClosed: boolean;
  missingNotified: number;
  status?: string;
};

export async function applyCollectionRecount(input: {
  collectionId: number;
  actualReceived?: number | null;
  actualCoins?: number | null;
  actualBanknotes?: number | null;
  missing?: boolean;
  comment?: string | null;
  actor?: CollectionActor;
}): Promise<RecountResult> {
  const result = await applyCollectionFact({
    collectionId: input.collectionId,
    actor: input.actor || { role: "cashier", name: "Касир" },
    actualReceived: input.actualReceived,
    actualCoins: input.actualCoins,
    actualBanknotes: input.actualBanknotes,
    missing: input.missing,
    comment: input.comment,
  });
  return result;
}

export async function closeHandoverRecountIfDone(handoverId: number): Promise<{
  closed: boolean;
  missingNotified: number;
}> {
  return closeHandoverIfComplete(handoverId);
}

export type ManagerMissingEvent = {
  id: number;
  collectionId: number;
  handoverId: number;
  technicianName: string;
  machine: string;
  expectedSum: number;
  createdAt: Date;
};

export type NoDeviceDataEvent = {
  id: number;
  handoverId: number;
  technicianId: number | null;
  technicianName: string;
  machine: string;
  amount: number;
  date: Date;
};

export async function listOpenNoDeviceDataPackages(): Promise<
  NoDeviceDataEvent[]
> {
  try {
    const { ensureCollectionsNoDeviceDataColumn } = await import(
      "@/lib/collection-handovers"
    );
    await ensureCollectionsNoDeviceDataColumn();
    const rows = await prismadb.$queryRawUnsafe<
      Array<{
        id: number;
        handoverId: number;
        technicianId: number | null;
        technician_name: string | null;
        machine: string;
        total_sum: unknown;
        actualReceived: unknown;
        date: Date;
      }>
    >(`
      SELECT c.id, c."handoverId", c."technicianId", w.name AS technician_name,
             c.machine, c.total_sum, c."actualReceived", c.date
      FROM collections c
      LEFT JOIN workers w ON w.id = c."technicianId"
      JOIN collection_handovers h ON h.id = c."handoverId"
      WHERE c.no_device_data = TRUE
        AND h.recount_closed_at IS NULL
      ORDER BY c.date DESC
      LIMIT 100
    `);
    return rows.map((r) => ({
      id: r.id,
      handoverId: r.handoverId,
      technicianId: r.technicianId,
      technicianName:
        r.technician_name ||
        (r.technicianId != null ? `Технік #${r.technicianId}` : "—"),
      machine: r.machine || "—",
      amount: decimalToNumber(r.actualReceived ?? r.total_sum),
      date: r.date,
    }));
  } catch (error) {
    console.error("[NO_DEVICE_DATA_LIST]", error);
    return [];
  }
}

export async function listOpenMissingEvents(): Promise<ManagerMissingEvent[]> {
  try {
    const rows = await prismadb.$queryRawUnsafe<
      Array<{
        id: number;
        collection_id: number;
        handover_id: number;
        technician_name: string | null;
        machine: string;
        expected_sum: unknown;
        created_at: Date;
      }>
    >(
      `SELECT id, collection_id, handover_id, technician_name, machine, expected_sum, created_at
       FROM collection_missing_events
       WHERE manager_acked_at IS NULL
       ORDER BY created_at DESC`
    );
    return rows.map((r) => ({
      id: r.id,
      collectionId: r.collection_id,
      handoverId: r.handover_id,
      technicianName: r.technician_name || "—",
      machine: r.machine,
      expectedSum: decimalToNumber(r.expected_sum),
      createdAt: r.created_at,
    }));
  } catch (error) {
    console.error("[MISSING_EVENTS_LIST]", error);
    return [];
  }
}

export async function ackMissingEvent(eventId: number, managerId: number) {
  await prismadb.$executeRawUnsafe(
    `UPDATE collection_missing_events
     SET manager_acked_at = NOW(), manager_id = ${asInt(managerId)}
     WHERE id = ${asInt(eventId)} AND manager_acked_at IS NULL`
  );
}
