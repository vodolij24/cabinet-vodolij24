import prismadb from "@/lib/prismadb";
import { cashierMachineLabel, decimalToNumber } from "@/lib/collection-fields";
import { kyivDateLabel, kyivTimeLabel } from "@/lib/kyiv-date";
import { ensureCollectionMvpSchema } from "@/lib/collection-schema";
import {
  actorIdString,
  collectionAgingDays,
  collectionStatusLabel,
  decideAfterFact,
  expectedCollectionSum,
  type CollectionActor,
  type CollectionIssueType,
  type CollectionStatus,
  collectionIssueType,
  COLLECTION_ISSUE_LABEL,
} from "@/lib/collection-status";
import { asInt, intList, roundMoney, sqlLit, sqlNum } from "@/lib/collection-sql";
import { sendStaffTextNotification } from "@/lib/telegram";
import { digitsOnlyPhone } from "@/lib/phone";

export type CollectionCommentDto = {
  id: number;
  collectionId: number;
  authorRole: string;
  authorName: string;
  authorId: string | null;
  body: string;
  createdAt: string;
  dateLabel: string;
  timeLabel: string;
};

export type CollectionStatusEventDto = {
  id: number;
  collectionId: number;
  fromStatus: string | null;
  fromLabel: string;
  toStatus: string;
  toLabel: string;
  actorRole: string;
  actorName: string;
  payload: string | null;
  createdAt: string;
  dateLabel: string;
  timeLabel: string;
};

export async function addCollectionComment(input: {
  collectionId: number;
  actor: CollectionActor;
  body: string;
}): Promise<CollectionCommentDto> {
  await ensureCollectionMvpSchema();
  const text = input.body.trim();
  if (!text) throw new Error("COMMENT_REQUIRED");
  const id = asInt(input.collectionId, 1);
  const rows = await prismadb.$queryRawUnsafe<
    Array<{
      id: number;
      collection_id: number;
      author_role: string;
      author_name: string;
      author_id: string | null;
      body: string;
      created_at: Date;
    }>
  >(
    `INSERT INTO collection_comments (
       collection_id, author_role, author_name, author_id, body, created_at
     ) VALUES (
       ${id},
       ${sqlLit(input.actor.role)},
       ${sqlLit(input.actor.name)},
       ${sqlLit(actorIdString(input.actor))},
       ${sqlLit(text)},
       NOW()
     )
     RETURNING id, collection_id, author_role, author_name, author_id, body, created_at`
  );
  const row = rows[0];
  if (!row) throw new Error("COMMENT_FAILED");
  return mapComment(row);
}

export async function listCollectionComments(
  collectionId: number
): Promise<CollectionCommentDto[]> {
  await ensureCollectionMvpSchema();
  const id = asInt(collectionId, 1);
  const rows = await prismadb.$queryRawUnsafe<
    Array<{
      id: number;
      collection_id: number;
      author_role: string;
      author_name: string;
      author_id: string | null;
      body: string;
      created_at: Date;
    }>
  >(
    `SELECT id, collection_id, author_role, author_name, author_id, body, created_at
     FROM collection_comments
     WHERE collection_id = ${id}
     ORDER BY created_at ASC, id ASC`
  );
  return rows.map(mapComment);
}

export async function listCollectionCommentsByIds(
  collectionIds: number[]
): Promise<Map<number, CollectionCommentDto[]>> {
  const map = new Map<number, CollectionCommentDto[]>();
  if (collectionIds.length === 0) return map;
  await ensureCollectionMvpSchema();
  const rows = await prismadb.$queryRawUnsafe<
    Array<{
      id: number;
      collection_id: number;
      author_role: string;
      author_name: string;
      author_id: string | null;
      body: string;
      created_at: Date;
    }>
  >(
    `SELECT id, collection_id, author_role, author_name, author_id, body, created_at
     FROM collection_comments
     WHERE collection_id IN (${intList(collectionIds)})
     ORDER BY created_at ASC, id ASC`
  );
  for (const row of rows) {
    const list = map.get(row.collection_id) ?? [];
    list.push(mapComment(row));
    map.set(row.collection_id, list);
  }
  return map;
}

function mapComment(row: {
  id: number;
  collection_id: number;
  author_role: string;
  author_name: string;
  author_id: string | null;
  body: string;
  created_at: Date;
}): CollectionCommentDto {
  return {
    id: row.id,
    collectionId: row.collection_id,
    authorRole: row.author_role,
    authorName: row.author_name,
    authorId: row.author_id,
    body: row.body,
    createdAt: row.created_at.toISOString(),
    dateLabel: kyivDateLabel(row.created_at),
    timeLabel: kyivTimeLabel(row.created_at),
  };
}

export async function listCollectionStatusEvents(
  collectionId: number
): Promise<CollectionStatusEventDto[]> {
  await ensureCollectionMvpSchema();
  const id = asInt(collectionId, 1);
  const rows = await prismadb.$queryRawUnsafe<
    Array<{
      id: number;
      collection_id: number;
      from_status: string | null;
      to_status: string;
      actor_role: string;
      actor_name: string;
      payload: string | null;
      created_at: Date;
    }>
  >(
    `SELECT id, collection_id, from_status, to_status, actor_role, actor_name, payload, created_at
     FROM collection_status_events
     WHERE collection_id = ${id}
     ORDER BY created_at ASC, id ASC`
  );
  return rows.map(mapEvent);
}

export async function listCollectionStatusEventsByIds(
  collectionIds: number[]
): Promise<Map<number, CollectionStatusEventDto[]>> {
  const map = new Map<number, CollectionStatusEventDto[]>();
  if (collectionIds.length === 0) return map;
  await ensureCollectionMvpSchema();
  const rows = await prismadb.$queryRawUnsafe<
    Array<{
      id: number;
      collection_id: number;
      from_status: string | null;
      to_status: string;
      actor_role: string;
      actor_name: string;
      payload: string | null;
      created_at: Date;
    }>
  >(
    `SELECT id, collection_id, from_status, to_status, actor_role, actor_name, payload, created_at
     FROM collection_status_events
     WHERE collection_id IN (${intList(collectionIds)})
     ORDER BY created_at ASC, id ASC`
  );
  for (const row of rows) {
    const list = map.get(row.collection_id) ?? [];
    list.push(mapEvent(row));
    map.set(row.collection_id, list);
  }
  return map;
}

function mapEvent(row: {
  id: number;
  collection_id: number;
  from_status: string | null;
  to_status: string;
  actor_role: string;
  actor_name: string;
  payload: string | null;
  created_at: Date;
}): CollectionStatusEventDto {
  return {
    id: row.id,
    collectionId: row.collection_id,
    fromStatus: row.from_status,
    fromLabel: collectionStatusLabel(row.from_status),
    toStatus: row.to_status,
    toLabel: collectionStatusLabel(row.to_status),
    actorRole: row.actor_role,
    actorName: row.actor_name,
    payload: row.payload,
    createdAt: row.created_at.toISOString(),
    dateLabel: kyivDateLabel(row.created_at),
    timeLabel: kyivTimeLabel(row.created_at),
  };
}

async function insertStatusEvent(input: {
  collectionId: number;
  fromStatus: string | null;
  toStatus: string;
  actor: CollectionActor;
  payload?: Record<string, unknown> | null;
}) {
  const payload =
    input.payload == null ? null : JSON.stringify(input.payload);
  await prismadb.$executeRawUnsafe(
    `INSERT INTO collection_status_events (
       collection_id, from_status, to_status, actor_role, actor_name, actor_id, payload, created_at
     ) VALUES (
       ${asInt(input.collectionId, 1)},
       ${sqlLit(input.fromStatus)},
       ${sqlLit(input.toStatus)},
       ${sqlLit(input.actor.role)},
       ${sqlLit(input.actor.name)},
       ${sqlLit(actorIdString(input.actor))},
       ${sqlLit(payload)},
       NOW()
     )`
  );
}

export async function transitionCollectionStatus(input: {
  collectionId: number;
  toStatus: CollectionStatus;
  actor: CollectionActor;
  extraSql?: string;
  payload?: Record<string, unknown> | null;
  allowSame?: boolean;
}): Promise<{ fromStatus: string | null; toStatus: CollectionStatus }> {
  await ensureCollectionMvpSchema();
  const id = asInt(input.collectionId, 1);
  const rows = await prismadb.$queryRawUnsafe<
    Array<{ status: string | null }>
  >(`SELECT status FROM collections WHERE id = ${id} LIMIT 1`);
  if (!rows[0]) throw new Error("NOT_FOUND");
  const fromStatus = rows[0].status;
  if (!input.allowSame && fromStatus === input.toStatus) {
    return { fromStatus, toStatus: input.toStatus };
  }
  const extra = input.extraSql ? `, ${input.extraSql}` : "";
  await prismadb.$executeRawUnsafe(
    `UPDATE collections
     SET status = ${sqlLit(input.toStatus)}, updated_at = NOW()${extra}
     WHERE id = ${id}`
  );
  await insertStatusEvent({
    collectionId: id,
    fromStatus,
    toStatus: input.toStatus,
    actor: input.actor,
    payload: input.payload,
  });
  return { fromStatus, toStatus: input.toStatus };
}

const SYSTEM_ACTOR: CollectionActor = { role: "system", name: "Система" };

type CollectionRow = {
  id: number;
  handoverId: number | null;
  recountStatus: string | null;
  status: string | null;
  total_sum: unknown;
  sum_coins: unknown;
  sum_banknotes: unknown;
  actualReceived: unknown;
  is_phantom: boolean | null;
  is_manual: boolean | null;
  no_device_data: boolean | null;
  review_claimed_at: Date | null;
  technicianId: number | null;
  machine: string;
  device_id: number | null;
};

async function loadCollection(id: number): Promise<CollectionRow> {
  const rows = await prismadb.$queryRawUnsafe<CollectionRow[]>(
    `SELECT id, "handoverId", "recountStatus", status, total_sum, sum_coins, sum_banknotes,
            "actualReceived", is_phantom, is_manual, no_device_data, review_claimed_at,
            "technicianId", machine, device_id
     FROM collections WHERE id = ${asInt(id, 1)} LIMIT 1`
  );
  if (!rows[0]) throw new Error("NOT_FOUND");
  return rows[0];
}

export async function createTechnicianManualCollection(input: {
  technicianId: number;
  technicianName: string;
  deviceId: number;
  date: Date;
  comment: string;
}): Promise<{ collectionId: number }> {
  await ensureCollectionMvpSchema();
  const comment = input.comment.trim();
  if (!comment) throw new Error("COMMENT_REQUIRED");
  const technicianId = asInt(input.technicianId, 1);
  const deviceId = asInt(input.deviceId, 1);

  const machine = await prismadb.vending_machines.findFirst({
    where: { id: deviceId, technicianId },
    select: { id: true, location: true, address: true, name: true },
  });
  if (!machine) throw new Error("MACHINE_NOT_FOUND");

  const location =
    machine.location?.trim() || machine.address?.trim() || null;
  const label = cashierMachineLabel(deviceId, location, machine.name);
  const iso = input.date.toISOString();

  const inserted = await prismadb.$queryRawUnsafe<Array<{ id: number }>>(
    `INSERT INTO collections (
       date, count_banknotes, sum_banknotes, count_coins, sum_coins, total_sum,
       note, machine, device_id, "technicianId", is_manual, status, created_at, updated_at
     ) VALUES (
       ${sqlLit(iso)}::timestamptz, 0, 0, 0, 0, 0,
       ${sqlLit("Ручне додавання техніком")},
       ${sqlLit(label)},
       ${deviceId},
       ${technicianId},
       TRUE,
       'on_hand',
       NOW(),
       NOW()
     )
     RETURNING id`
  );
  const collectionId = inserted[0]?.id;
  if (!collectionId) throw new Error("CREATE_FAILED");

  const actor: CollectionActor = {
    role: "technician",
    id: technicianId,
    name: input.technicianName,
  };
  await insertStatusEvent({
    collectionId,
    fromStatus: null,
    toStatus: "on_hand",
    actor,
    payload: { source: "technician_manual" },
  });
  await addCollectionComment({ collectionId, actor, body: comment });
  return { collectionId };
}

export async function markCollectionPhantom(input: {
  collectionId: number;
  technicianId: number;
  technicianName: string;
  comment: string;
}) {
  await ensureCollectionMvpSchema();
  const comment = input.comment.trim();
  if (!comment) throw new Error("COMMENT_REQUIRED");
  const row = await loadCollection(input.collectionId);
  if (row.technicianId !== input.technicianId) throw new Error("FORBIDDEN");
  if (row.handoverId != null || row.status !== "on_hand") {
    throw new Error("NOT_ON_HAND");
  }

  const actor: CollectionActor = {
    role: "technician",
    id: input.technicianId,
    name: input.technicianName,
  };
  await prismadb.$executeRawUnsafe(
    `UPDATE collections
     SET is_phantom = TRUE, updated_at = NOW()
     WHERE id = ${asInt(input.collectionId, 1)}`
  );
  await addCollectionComment({
    collectionId: input.collectionId,
    actor,
    body: `Фантом / збій картки. ${comment}`,
  });
  await insertStatusEvent({
    collectionId: input.collectionId,
    fromStatus: row.status,
    toStatus: row.status || "on_hand",
    actor,
    payload: { phantom: true },
  });
}

export async function createHandoverFromSelection(input: {
  technicianId: number;
  technicianName: string;
  cashierId: number;
  collectionIds: number[];
}): Promise<{ handoverId: number; collectionCount: number }> {
  await ensureCollectionMvpSchema();
  const technicianId = asInt(input.technicianId, 1);
  const cashierId = asInt(input.cashierId, 1);
  const ids = [...new Set(input.collectionIds.map((id) => asInt(id, 1)))];
  if (ids.length === 0) throw new Error("SELECT_PACKAGES");

  const cashier = await prismadb.workers.findFirst({
    where: {
      id: cashierId,
      role: "cashier",
      OR: [{ active: true }, { active: null }],
    },
    select: { id: true, name: true, chat_id: true, phone: true },
  });
  if (!cashier) throw new Error("CASHIER_NOT_FOUND");

  const rows = await prismadb.$queryRawUnsafe<
    Array<{
      id: number;
      handoverId: number | null;
      status: string | null;
      technicianId: number | null;
      device_id: number | null;
    }>
  >(
    `SELECT id, "handoverId", status, "technicianId", device_id
     FROM collections
     WHERE id IN (${intList(ids)})`
  );
  if (rows.length !== ids.length) throw new Error("NOT_FOUND");

  const machines = await prismadb.vending_machines.findMany({
    where: { technicianId },
    select: { id: true },
  });
  const machineIds = new Set(machines.map((m) => m.id));

  for (const row of rows) {
    const own =
      row.technicianId === technicianId ||
      (row.device_id != null && machineIds.has(row.device_id));
    if (!own) throw new Error("FORBIDDEN");
    if (row.handoverId != null) throw new Error("ALREADY_HANDED");
    if (row.status && row.status !== "on_hand") throw new Error("NOT_ON_HAND");
  }

  const machineCount = new Set(
    rows.map((r) => r.device_id).filter((v): v is number => v != null)
  ).size;

  const inserted = await prismadb.$queryRawUnsafe<Array<{ id: number }>>(
    `INSERT INTO collection_handovers (
       technician_id, cashier_id, claimed_packages, received_packages,
       machine_count, collection_count, created_at
     ) VALUES (
       ${technicianId}, ${cashierId}, ${ids.length}, ${ids.length},
       ${machineCount}, ${ids.length}, NOW()
     )
     RETURNING id`
  );
  const handoverId = inserted[0]?.id;
  if (!handoverId) throw new Error("CREATE_FAILED");

  const actor: CollectionActor = {
    role: "technician",
    id: technicianId,
    name: input.technicianName,
  };

  await prismadb.$executeRawUnsafe(
    `UPDATE collections
     SET "handoverId" = ${handoverId},
         "technicianId" = COALESCE("technicianId", ${technicianId}),
         status = 'handed',
         updated_at = NOW()
     WHERE id IN (${intList(ids)}) AND "handoverId" IS NULL`
  );

  for (const row of rows) {
    await insertStatusEvent({
      collectionId: row.id,
      fromStatus: row.status || "on_hand",
      toStatus: "handed",
      actor,
      payload: { handoverId },
    });
  }

  if (cashier.chat_id != null) {
    const phone = digitsOnlyPhone(cashier.phone);
    const link = phone ? `/${phone}` : "";
    await sendStaffTextNotification(
      String(cashier.chat_id),
      `Технік ${input.technicianName} передав ${ids.length} пакет(ів) на прийом.${link ? `\n${link}` : ""}`
    );
  }

  return { handoverId, collectionCount: ids.length };
}

export type FactResult = {
  id: number;
  missing: boolean;
  actualReceived: number | null;
  status: CollectionStatus;
  handoverClosed: boolean;
  missingNotified: number;
};

export async function applyCollectionFact(input: {
  collectionId: number;
  actor: CollectionActor;
  actualReceived?: number | null;
  actualCoins?: number | null;
  actualBanknotes?: number | null;
  missing?: boolean;
  comment?: string | null;
}): Promise<FactResult> {
  await ensureCollectionMvpSchema();
  const row = await loadCollection(input.collectionId);
  if (row.handoverId == null) throw new Error("NOT_HANDED");
  if (row.status === "closed_manual") throw new Error("ALREADY_CLOSED");
  if (row.review_claimed_at && input.actor.role === "cashier") {
    throw new Error("REVIEW_CLAIMED");
  }

  const closed = await prismadb.$queryRawUnsafe<
    Array<{ recount_closed_at: Date | null }>
  >(
    `SELECT recount_closed_at FROM collection_handovers WHERE id = ${asInt(row.handoverId)} LIMIT 1`
  );
  if (closed[0]?.recount_closed_at && input.actor.role === "cashier") {
    // після закриття здачі касир ще може змінити факт, поки немає ручного закриття / claim
  }

  let actual: number | null = null;
  let coins = input.actualCoins ?? null;
  let notes = input.actualBanknotes ?? null;
  if (!input.missing) {
    if (coins != null || notes != null) {
      actual = roundMoney((coins ?? 0) + (notes ?? 0));
    } else if (input.actualReceived != null) {
      actual = roundMoney(input.actualReceived);
    }
    if (actual == null || !Number.isFinite(actual) || actual < 0) {
      throw new Error("AMOUNT_REQUIRED");
    }
  }

  const expected = expectedCollectionSum(row);
  const decision = decideAfterFact({
    expected,
    actual: actual ?? 0,
    isPhantom: Boolean(row.is_phantom),
    isManual: Boolean(row.is_manual),
    noDeviceData: Boolean(row.no_device_data),
    missing: Boolean(input.missing),
  });

  const extra =
    input.missing
      ? `"recountStatus" = 'missing', "actualReceived" = NULL, actual_received_coins = NULL, actual_received_banknotes = NULL, close_mode = NULL, closed_at = NULL, closed_by_name = NULL`
      : `"recountStatus" = 'done', "actualReceived" = ${sqlNum(actual)}, actual_received_coins = ${sqlNum(coins)}, actual_received_banknotes = ${sqlNum(notes)}, ` +
        (decision.nextStatus === "closed_auto"
          ? `close_mode = 'auto', closed_at = NOW(), closed_by_name = ${sqlLit(input.actor.name)}, close_reason = NULL`
          : `close_mode = NULL, closed_at = NULL, closed_by_name = NULL`);

  await transitionCollectionStatus({
    collectionId: row.id,
    toStatus: decision.nextStatus,
    actor: decision.nextStatus === "closed_auto" ? SYSTEM_ACTOR : input.actor,
    allowSame: true,
    extraSql: extra,
    payload: {
      missing: Boolean(input.missing),
      actual,
      expected,
      deltaUah: decision.deltaUah,
      deltaPct: decision.deltaPct,
      issueType: decision.issueType,
    },
  });

  if (row.status === "handed" || row.status === "on_hand") {
    await insertStatusEvent({
      collectionId: row.id,
      fromStatus: row.status,
      toStatus: "accepted",
      actor: input.actor,
    });
  }

  if (input.comment?.trim()) {
    await addCollectionComment({
      collectionId: row.id,
      actor: input.actor,
      body: input.comment.trim(),
    });
  }

  let missingNotified = 0;
  if (input.missing && row.handoverId != null) {
    missingNotified = await recordMissingPackage(row, row.handoverId);
  }

  const close = await closeHandoverIfComplete(row.handoverId);
  return {
    id: row.id,
    missing: Boolean(input.missing),
    actualReceived: input.missing ? null : actual,
    status: decision.nextStatus,
    handoverClosed: close.closed,
    missingNotified: missingNotified || close.missingNotified,
  };
}

async function recordMissingPackage(row: CollectionRow, handoverId: number) {
  const expected = expectedCollectionSum(row);
  let name: string | null = null;
  if (row.technicianId != null) {
    const tech = await prismadb.workers.findFirst({
      where: { id: row.technicianId },
      select: { name: true },
    });
    name = tech?.name || `Технік #${row.technicianId}`;
  }
  await prismadb.$executeRawUnsafe(
    `INSERT INTO collection_missing_events (
       collection_id, handover_id, technician_id, technician_name,
       machine, expected_sum, created_at
     )
     VALUES (
       ${asInt(row.id, 1)}, ${asInt(handoverId, 1)},
       ${row.technicianId != null ? asInt(row.technicianId) : "NULL"},
       ${sqlLit(name)},
       ${sqlLit(row.machine || "—")},
       ${sqlNum(expected)},
       NOW()
     )
     ON CONFLICT (collection_id) DO NOTHING`
  );
  await notifyManagersAboutMissing(handoverId, 1);
  return 1;
}

export async function closeHandoverIfComplete(handoverId: number): Promise<{
  closed: boolean;
  missingNotified: number;
}> {
  const hid = asInt(handoverId, 1);
  const meta = await prismadb.$queryRawUnsafe<
    Array<{ received_packages: number; recount_closed_at: Date | null }>
  >(
    `SELECT received_packages, recount_closed_at
     FROM collection_handovers WHERE id = ${hid} LIMIT 1`
  );
  if (!meta[0]) return { closed: false, missingNotified: 0 };
  if (meta[0].recount_closed_at) return { closed: true, missingNotified: 0 };

  const counts = await prismadb.$queryRawUnsafe<
    Array<{ total: number; pending: number }>
  >(
    `SELECT
       COUNT(*)::int AS total,
       COUNT(*) FILTER (
         WHERE "recountStatus" IS NULL OR "recountStatus" = ''
       )::int AS pending
     FROM collections
     WHERE "handoverId" = ${hid}`
  );
  const total = Number(counts[0]?.total ?? 0);
  const pending = Number(counts[0]?.pending ?? 0);
  const received = Number(meta[0].received_packages ?? 0);
  if (pending > 0) return { closed: false, missingNotified: 0 };
  if (total < received) return { closed: false, missingNotified: 0 };
  if (total === 0) return { closed: false, missingNotified: 0 };

  await prismadb.$executeRawUnsafe(
    `UPDATE collection_handovers
     SET recount_closed_at = COALESCE(recount_closed_at, NOW())
     WHERE id = ${hid}`
  );
  return { closed: true, missingNotified: 0 };
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
    select: { chat_id: true },
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

export async function closeCollectionManual(input: {
  collectionId: number;
  actor: CollectionActor;
  reason: string;
}) {
  await ensureCollectionMvpSchema();
  const reason = input.reason.trim();
  if (!reason) throw new Error("REASON_REQUIRED");
  const row = await loadCollection(input.collectionId);
  if (row.status !== "review") throw new Error("NOT_IN_REVIEW");

  await addCollectionComment({
    collectionId: row.id,
    actor: input.actor,
    body: reason,
  });
  await transitionCollectionStatus({
    collectionId: row.id,
    toStatus: "closed_manual",
    actor: input.actor,
    extraSql: `close_mode = 'manual', closed_at = NOW(), closed_by_name = ${sqlLit(input.actor.name)}, close_reason = ${sqlLit(reason)}, review_claimed_at = COALESCE(review_claimed_at, NOW()), review_claimed_by = COALESCE(review_claimed_by, ${sqlLit(input.actor.name)})`,
    payload: { reason },
  });

  if (row.handoverId != null) {
    await closeHandoverIfComplete(row.handoverId);
  }
}

export async function claimCollectionReview(input: {
  collectionId: number;
  actor: CollectionActor;
}) {
  await ensureCollectionMvpSchema();
  const row = await loadCollection(input.collectionId);
  if (row.status !== "review") throw new Error("NOT_IN_REVIEW");
  await prismadb.$executeRawUnsafe(
    `UPDATE collections
     SET review_claimed_at = COALESCE(review_claimed_at, NOW()),
         review_claimed_by = COALESCE(review_claimed_by, ${sqlLit(input.actor.name)}),
         updated_at = NOW()
     WHERE id = ${asInt(row.id, 1)}`
  );
}

export async function addCashierExtraPackage(input: {
  cashierId: number;
  cashierName: string;
  handoverId: number;
  deviceId: number;
  amount: number;
  comment?: string | null;
}): Promise<{ collectionId: number; handoverClosed: boolean }> {
  await ensureCollectionMvpSchema();
  const cashierId = asInt(input.cashierId, 1);
  const handoverId = asInt(input.handoverId, 1);
  const deviceId = asInt(input.deviceId, 1);
  const amount = roundMoney(input.amount);
  if (amount < 0) throw new Error("AMOUNT_REQUIRED");

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

  const actor: CollectionActor = {
    role: "cashier",
    id: cashierId,
    name: input.cashierName,
  };

  const inserted = await prismadb.$queryRawUnsafe<Array<{ id: number }>>(
    `INSERT INTO collections (
       date, count_banknotes, sum_banknotes, count_coins, sum_coins, total_sum,
       note, machine, device_id, "technicianId", "handoverId",
       "actualReceived", "recountStatus", no_device_data, is_manual, status,
       created_at, updated_at
     ) VALUES (
       NOW(), 0, 0, 0, 0, 0,
       ${sqlLit("Зайвий пакет / немає в списку передачі")},
       ${sqlLit(label)}, ${deviceId}, ${asInt(handover.technician_id)}, ${handoverId},
       ${sqlNum(amount)}, 'done', TRUE, TRUE, 'review',
       NOW(), NOW()
     )
     RETURNING id`
  );
  const collectionId = inserted[0]?.id;
  if (!collectionId) throw new Error("CREATE_FAILED");

  await insertStatusEvent({
    collectionId,
    fromStatus: null,
    toStatus: "on_hand",
    actor,
    payload: { source: "cashier_extra" },
  });
  await insertStatusEvent({
    collectionId,
    fromStatus: "on_hand",
    toStatus: "handed",
    actor,
    payload: { handoverId },
  });
  await insertStatusEvent({
    collectionId,
    fromStatus: "handed",
    toStatus: "review",
    actor,
    payload: { actual: amount, issueType: "manual" },
  });
  if (input.comment?.trim()) {
    await addCollectionComment({
      collectionId,
      actor,
      body: input.comment.trim(),
    });
  }

  await prismadb.$executeRawUnsafe(`
    UPDATE collection_handovers
    SET collection_count = (
          SELECT COUNT(*)::int FROM collections WHERE "handoverId" = ${handoverId}
        ),
        machine_count = (
          SELECT COUNT(DISTINCT device_id)::int
          FROM collections
          WHERE "handoverId" = ${handoverId} AND device_id IS NOT NULL
        ),
        received_packages = GREATEST(received_packages, (
          SELECT COUNT(*)::int FROM collections WHERE "handoverId" = ${handoverId}
        ))
    WHERE id = ${handoverId}
  `);

  const close = await closeHandoverIfComplete(handoverId);
  return { collectionId, handoverClosed: close.closed };
}

export type ReviewQueueItem = {
  id: number;
  machine: string;
  deviceId: number | null;
  technicianId: number | null;
  technicianName: string;
  dateLabel: string;
  timeLabel: string;
  dateMs: number;
  expected: number;
  actualReceived: number | null;
  deltaUah: number | null;
  deltaPct: number | null;
  issueType: CollectionIssueType | null;
  issueLabel: string;
  isPhantom: boolean;
  isManual: boolean;
  noDeviceData: boolean;
  missing: boolean;
  claimedBy: string | null;
  comments: CollectionCommentDto[];
  events: CollectionStatusEventDto[];
};

export async function listReviewQueue(
  options?: { includeThreads?: boolean }
): Promise<ReviewQueueItem[]> {
  await ensureCollectionMvpSchema();
  const includeThreads = options?.includeThreads === true;
  const rows = await prismadb.$queryRawUnsafe<
    Array<{
      id: number;
      machine: string;
      device_id: number | null;
      location: string | null;
      technicianId: number | null;
      technician_name: string | null;
      date: Date;
      total_sum: unknown;
      sum_coins: unknown;
      sum_banknotes: unknown;
      actualReceived: unknown;
      recountStatus: string | null;
      is_phantom: boolean | null;
      is_manual: boolean | null;
      no_device_data: boolean | null;
      review_claimed_by: string | null;
    }>
  >(
    `SELECT c.id, c.machine, c.device_id, c.date, c.total_sum, c.sum_coins, c.sum_banknotes,
            c."actualReceived", c."recountStatus", c."technicianId",
            c.is_phantom, c.is_manual, c.no_device_data, c.review_claimed_by,
            w.name AS technician_name,
            COALESCE(NULLIF(TRIM(vm.location), ''), NULLIF(TRIM(vm.address), '')) AS location
     FROM collections c
     LEFT JOIN workers w ON w.id = c."technicianId"
     LEFT JOIN vending_machines vm ON vm.id = c.device_id
     WHERE c.status = 'review'
     ORDER BY c.date DESC
     LIMIT 50`
  );

  const ids = rows.map((r) => r.id);
  const [comments, events] = includeThreads
    ? await Promise.all([
        listCollectionCommentsByIds(ids),
        listCollectionStatusEventsByIds(ids),
      ])
    : [new Map<number, CollectionCommentDto[]>(), new Map<number, CollectionStatusEventDto[]>()];

  return rows.map((r) => {
    const expected = expectedCollectionSum(r);
    const missing = r.recountStatus === "missing";
    const actual =
      missing || r.actualReceived == null
        ? null
        : decimalToNumber(r.actualReceived);
    const issueType = collectionIssueType({
      isPhantom: Boolean(r.is_phantom),
      isManual: Boolean(r.is_manual),
      noDeviceData: Boolean(r.no_device_data),
      recountStatus: r.recountStatus,
      expected,
      actual,
    });
    const decision =
      actual == null && !missing
        ? null
        : decideAfterFact({
            expected,
            actual: actual ?? 0,
            isPhantom: Boolean(r.is_phantom),
            isManual: Boolean(r.is_manual),
            noDeviceData: Boolean(r.no_device_data),
            missing,
          });
    return {
      id: r.id,
      machine: cashierMachineLabel(r.device_id, r.location, r.machine),
      deviceId: r.device_id,
      technicianId: r.technicianId,
      technicianName:
        r.technician_name ||
        (r.technicianId != null ? `Технік #${r.technicianId}` : "—"),
      dateLabel: kyivDateLabel(r.date),
      timeLabel: kyivTimeLabel(r.date),
      dateMs: r.date.getTime(),
      expected,
      actualReceived: actual,
      deltaUah: decision?.deltaUah ?? null,
      deltaPct: decision?.deltaPct ?? null,
      issueType,
      issueLabel: issueType ? COLLECTION_ISSUE_LABEL[issueType] : "—",
      isPhantom: Boolean(r.is_phantom),
      isManual: Boolean(r.is_manual),
      noDeviceData: Boolean(r.no_device_data),
      missing,
      claimedBy: r.review_claimed_by,
      comments: comments.get(r.id) ?? [],
      events: events.get(r.id) ?? [],
    };
  });
}

export type AntifraudItem = {
  id: number;
  machine: string;
  technicianId: number | null;
  technicianName: string;
  dateLabel: string;
  timeLabel: string;
  agingDays: number;
};

export async function listOnHandOverdue(
  minDays = 7,
  limit = 200
): Promise<AntifraudItem[]> {
  await ensureCollectionMvpSchema();
  const rows = await prismadb.$queryRawUnsafe<
    Array<{
      id: number;
      machine: string;
      device_id: number | null;
      location: string | null;
      technicianId: number | null;
      technician_name: string | null;
      date: Date;
    }>
  >(
    `SELECT c.id, c.machine, c.device_id, c.date, c."technicianId", w.name AS technician_name,
            COALESCE(NULLIF(TRIM(vm.location), ''), NULLIF(TRIM(vm.address), '')) AS location
     FROM collections c
     LEFT JOIN workers w ON w.id = c."technicianId"
     LEFT JOIN vending_machines vm ON vm.id = c.device_id
     WHERE COALESCE(c.status, 'on_hand') = 'on_hand'
       AND c."handoverId" IS NULL
       AND c.date < (CURRENT_TIMESTAMP AT TIME ZONE 'Europe/Kyiv')::date - INTERVAL '${asInt(minDays)} days'
     ORDER BY c.date ASC
     LIMIT ${asInt(limit, 1)}`
  );
  return rows.map((r) => ({
    id: r.id,
    machine: cashierMachineLabel(r.device_id, r.location, r.machine),
    technicianId: r.technicianId,
    technicianName:
      r.technician_name ||
      (r.technicianId != null ? `Технік #${r.technicianId}` : "—"),
    dateLabel: kyivDateLabel(r.date),
    timeLabel: kyivTimeLabel(r.date),
    agingDays: collectionAgingDays(r.date),
  }));
}

export async function countOnHandOverdue(minDays = 7): Promise<number> {
  await ensureCollectionMvpSchema();
  const rows = await prismadb.$queryRawUnsafe<Array<{ total: number }>>(
    `SELECT COUNT(*)::int AS total
     FROM collections c
     WHERE COALESCE(c.status, 'on_hand') = 'on_hand'
       AND c."handoverId" IS NULL
       AND c.date < (CURRENT_TIMESTAMP AT TIME ZONE 'Europe/Kyiv')::date - INTERVAL '${asInt(minDays)} days'`
  );
  return Number(rows[0]?.total ?? 0);
}

export async function sendAntifraudReminders(minDays = 7): Promise<{
  notified: number;
}> {
  const overdue = await listOnHandOverdue(minDays);
  if (overdue.length === 0) return { notified: 0 };

  const already = await prismadb.$queryRawUnsafe<Array<{ collection_id: number }>>(
    `SELECT collection_id FROM collection_antifraud_reminders
     WHERE collection_id IN (${intList(overdue.map((o) => o.id))})`
  );
  const sent = new Set(already.map((r) => r.collection_id));
  const fresh = overdue.filter((o) => !sent.has(o.id));
  if (fresh.length === 0) return { notified: 0 };

  const techIds = [
    ...new Set(
      fresh.map((f) => f.technicianId).filter((v): v is number => v != null)
    ),
  ];
  const techs =
    techIds.length > 0
      ? await prismadb.workers.findMany({
          where: { id: { in: techIds } },
          select: { id: true, name: true, chat_id: true, phone: true },
        })
      : [];
  const byId = new Map(techs.map((t) => [t.id, t]));

  const grouped = new Map<number, AntifraudItem[]>();
  for (const item of fresh) {
    if (item.technicianId == null) continue;
    const list = grouped.get(item.technicianId) ?? [];
    list.push(item);
    grouped.set(item.technicianId, list);
  }

  let notified = 0;
  for (const [techId, items] of grouped) {
    const worker = byId.get(techId);
    const phone = digitsOnlyPhone(worker?.phone);
    const text =
      `На руках більше ${minDays} днів: ${items.length} пакет(ів).\n` +
      items
        .slice(0, 8)
        .map((i) => `• ${i.machine} · ${i.dateLabel}`)
        .join("\n") +
      (items.length > 8 ? `\n… ще ${items.length - 8}` : "") +
      (phone ? `\nЗдайте касиру: /${phone}?tab=collections` : "");
    if (worker?.chat_id != null) {
      await sendStaffTextNotification(String(worker.chat_id), text);
    }
    notified += items.length;
  }

  const managers = await prismadb.workers.findMany({
    where: { role: "manager", OR: [{ active: true }, { active: null }] },
    select: { chat_id: true },
  });
  const managerText = `Антифрод: ${fresh.length} інкасацій на руках понад ${minDays} днів.`;
  await Promise.all(
    managers
      .filter((m) => m.chat_id != null)
      .map((m) => sendStaffTextNotification(String(m.chat_id), managerText))
  );

  for (const item of fresh) {
    await prismadb.$executeRawUnsafe(
      `INSERT INTO collection_antifraud_reminders (collection_id, technician_id, sent_at)
       VALUES (${asInt(item.id, 1)}, ${item.technicianId != null ? asInt(item.technicianId) : "NULL"}, NOW())
       ON CONFLICT (collection_id) DO NOTHING`
    );
  }

  return { notified };
}
