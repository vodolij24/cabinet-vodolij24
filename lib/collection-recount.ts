import prismadb from "@/lib/prismadb";
import { decimalToNumber } from "@/lib/collection-fields";
import { sendStaffTextNotification } from "@/lib/telegram";

function asInt(n: number) {
  const v = Number(n);
  if (!Number.isInteger(v) || v <= 0) throw new Error("Invalid id");
  return v;
}

export type RecountResult = {
  id: number;
  missing: boolean;
  actualReceived: number | null;
  handoverClosed: boolean;
  missingNotified: number;
};

export async function applyCollectionRecount(input: {
  collectionId: number;
  actualReceived?: number | null;
  missing?: boolean;
}): Promise<RecountResult> {
  const id = asInt(input.collectionId);
  const rows = await prismadb.$queryRawUnsafe<
    Array<{
      id: number;
      handoverId: number | null;
      recountStatus: string | null;
    }>
  >(
    `SELECT id, "handoverId", "recountStatus" FROM collections WHERE id = ${id} LIMIT 1`
  );
  const row = rows[0];
  if (!row) throw new Error("NOT_FOUND");
  if (row.handoverId == null) throw new Error("NOT_HANDED");

  const closed = await prismadb.$queryRawUnsafe<
    Array<{ recount_closed_at: Date | null }>
  >(
    `SELECT recount_closed_at FROM collection_handovers WHERE id = ${asInt(row.handoverId)} LIMIT 1`
  );
  if (closed[0]?.recount_closed_at) throw new Error("HANDOVER_CLOSED");

  if (input.missing) {
    await prismadb.$executeRawUnsafe(
      `UPDATE collections
       SET "recountStatus" = 'missing',
           "actualReceived" = NULL,
           updated_at = NOW()
       WHERE id = ${id}`
    );
  } else {
    const actual = input.actualReceived;
    if (actual == null || !Number.isFinite(actual) || actual < 0) {
      throw new Error("AMOUNT_REQUIRED");
    }
    await prismadb.$executeRawUnsafe(
      `UPDATE collections
       SET "recountStatus" = 'done',
           "actualReceived" = ${actual.toFixed(2)},
           updated_at = NOW()
       WHERE id = ${id}`
    );
  }

  const close = await closeHandoverRecountIfDone(row.handoverId);

  return {
    id,
    missing: Boolean(input.missing),
    actualReceived: input.missing ? null : (input.actualReceived ?? null),
    handoverClosed: close.closed,
    missingNotified: close.missingNotified,
  };
}

async function closeHandoverRecountIfDone(handoverId: number): Promise<{
  closed: boolean;
  missingNotified: number;
}> {
  const hid = asInt(handoverId);
  const pending = await prismadb.$queryRawUnsafe<Array<{ n: bigint | number }>>(
    `SELECT COUNT(*)::int AS n
     FROM collections
     WHERE "handoverId" = ${hid}
       AND ("recountStatus" IS NULL OR "recountStatus" = '')`
  );
  const left = Number(pending[0]?.n ?? 1);
  if (left > 0) return { closed: false, missingNotified: 0 };

  await prismadb.$executeRawUnsafe(
    `UPDATE collection_handovers
     SET recount_closed_at = COALESCE(recount_closed_at, NOW())
     WHERE id = ${hid}`
  );

  const missing = await prismadb.$queryRawUnsafe<
    Array<{
      id: number;
      technicianId: number | null;
      machine: string;
      total_sum: unknown;
    }>
  >(
    `SELECT id, "technicianId", machine, total_sum
     FROM collections
     WHERE "handoverId" = ${hid} AND "recountStatus" = 'missing'`
  );

  if (missing.length === 0) return { closed: true, missingNotified: 0 };

  const techIds = [
    ...new Set(
      missing.map((m) => m.technicianId).filter((v): v is number => v != null)
    ),
  ];
  const techs =
    techIds.length > 0
      ? await prismadb.workers.findMany({
          where: { id: { in: techIds } },
          select: { id: true, name: true },
        })
      : [];
  const techName = new Map(techs.map((t) => [t.id, t.name || `Технік #${t.id}`]));

  let created = 0;
  for (const item of missing) {
    const expected = decimalToNumber(item.total_sum);
    const name =
      item.technicianId != null
        ? techName.get(item.technicianId) || null
        : null;
    const nameSql = name ? `'${name.replace(/'/g, "''")}'` : "NULL";
    const machineSql = String(item.machine || "—").replace(/'/g, "''");
    const techSql = item.technicianId != null ? String(item.technicianId) : "NULL";
    await prismadb.$executeRawUnsafe(
      `INSERT INTO collection_missing_events (
         collection_id, handover_id, technician_id, technician_name,
         machine, expected_sum, created_at
       )
       VALUES (
         ${asInt(item.id)}, ${hid}, ${techSql}, ${nameSql},
         '${machineSql}', ${expected.toFixed(2)}, NOW()
       )
       ON CONFLICT (collection_id) DO NOTHING`
    );
    created += 1;
  }

  await notifyManagersAboutMissing(hid, missing.length);
  return { closed: true, missingNotified: created };
}

async function notifyManagersAboutMissing(
  handoverId: number,
  missingCount: number
) {
  const managers = await prismadb.workers.findMany({
    where: {
      role: "manager",
      OR: [{ active: true }, { active: null }],
    },
    select: { chat_id: true, phone: true, name: true },
  });

  const text =
    `Відсутні інкасації після перерахунку здачі #${handoverId}: ${missingCount} пакет(ів).\n` +
    `Перевірте персональну сторінку керівника.`;

  await Promise.all(
    managers
      .filter((m) => m.chat_id != null)
      .map((m) => sendStaffTextNotification(String(m.chat_id), text))
  );
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
