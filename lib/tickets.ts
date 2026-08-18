import "server-only";

import prismadb from "@/lib/prismadb";
import { decimalToNumber } from "@/lib/collection-fields";
import { kyivDateLabel, kyivTimeLabel } from "@/lib/kyiv-date";
import type { TicketMessage, TicketThread } from "@/lib/ticket-types";

export type TicketAuthor = {
  role: "cabinet" | "manager" | "technician" | "cashier";
  name: string;
  id: string;
};

type TicketRow = {
  id: number;
  collection_id: number;
  handover_id: number | null;
  technician_id: number | null;
  cashier_id: number | null;
  machine: string;
  expected_sum: unknown;
  actual_received: unknown;
  status: string;
  created_by_role: string;
  created_by_name: string;
  created_at: Date;
  closed_at: Date | null;
  closed_by_name: string | null;
  technician_name: string | null;
  cashier_name: string | null;
};

type MessageRow = {
  id: number;
  ticket_id: number;
  author_role: string;
  author_name: string;
  body: string;
  created_at: Date;
};

let tableReady = false;

function asInt(n: number) {
  const v = Number(n);
  if (!Number.isInteger(v) || v <= 0) throw new Error("Invalid id");
  return v;
}

export async function ensureTicketTables() {
  if (tableReady) return;
  await prismadb.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS collection_tickets (
      id SERIAL PRIMARY KEY,
      collection_id INT NOT NULL,
      handover_id INT,
      technician_id INT,
      cashier_id INT,
      machine TEXT NOT NULL DEFAULT '—',
      expected_sum DOUBLE PRECISION NOT NULL DEFAULT 0,
      actual_received DOUBLE PRECISION,
      status VARCHAR(16) NOT NULL DEFAULT 'open',
      created_by_role VARCHAR(32) NOT NULL,
      created_by_name VARCHAR(255) NOT NULL,
      created_by_id VARCHAR(255),
      closed_at TIMESTAMPTZ,
      closed_by_name VARCHAR(255),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await prismadb.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS collection_tickets_collection_idx
      ON collection_tickets (collection_id)
  `);
  await prismadb.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS collection_tickets_status_idx
      ON collection_tickets (status)
  `);
  await prismadb.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS collection_tickets_tech_status_idx
      ON collection_tickets (technician_id, status)
  `);
  await prismadb.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS collection_tickets_cashier_status_idx
      ON collection_tickets (cashier_id, status)
  `);
  await prismadb.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS collection_ticket_messages (
      id SERIAL PRIMARY KEY,
      ticket_id INT NOT NULL,
      author_role VARCHAR(32) NOT NULL,
      author_name VARCHAR(255) NOT NULL,
      author_id VARCHAR(255),
      body TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await prismadb.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS collection_ticket_messages_ticket_idx
      ON collection_ticket_messages (ticket_id)
  `);
  tableReady = true;
}

function mapMessage(r: MessageRow): TicketMessage {
  return {
    id: r.id,
    authorRole: r.author_role,
    authorName: r.author_name,
    body: r.body,
    createdAt: r.created_at.toISOString(),
    dateLabel: kyivDateLabel(r.created_at),
    timeLabel: kyivTimeLabel(r.created_at),
  };
}

function mapTicket(r: TicketRow, messages: TicketMessage[]): TicketThread {
  return {
    id: r.id,
    collectionId: r.collection_id,
    handoverId: r.handover_id,
    technicianId: r.technician_id,
    technicianName: r.technician_name || `Технік #${r.technician_id ?? "—"}`,
    cashierId: r.cashier_id,
    cashierName: r.cashier_name || (r.cashier_id ? `Касир #${r.cashier_id}` : "—"),
    machine: r.machine || "—",
    expectedSum: decimalToNumber(r.expected_sum),
    actualReceived:
      r.actual_received == null ? null : decimalToNumber(r.actual_received),
    status: r.status === "closed" ? "closed" : "open",
    createdByName: r.created_by_name,
    createdAt: r.created_at.toISOString(),
    dateLabel: kyivDateLabel(r.created_at),
    timeLabel: kyivTimeLabel(r.created_at),
    closedAt: r.closed_at ? r.closed_at.toISOString() : null,
    closedByName: r.closed_by_name,
    messages,
  };
}

async function loadMessages(ticketIds: number[]): Promise<Map<number, TicketMessage[]>> {
  const map = new Map<number, TicketMessage[]>();
  if (ticketIds.length === 0) return map;
  const ids = ticketIds.map(asInt).join(",");
  const rows = await prismadb.$queryRawUnsafe<MessageRow[]>(
    `SELECT id, ticket_id, author_role, author_name, body, created_at
     FROM collection_ticket_messages
     WHERE ticket_id IN (${ids})
     ORDER BY created_at ASC, id ASC`
  );
  for (const row of rows) {
    const list = map.get(row.ticket_id) ?? [];
    list.push(mapMessage(row));
    map.set(row.ticket_id, list);
  }
  return map;
}

const TICKET_SELECT = `
  SELECT t.id, t.collection_id, t.handover_id, t.technician_id, t.cashier_id,
         t.machine, t.expected_sum, t.actual_received, t.status,
         t.created_by_role, t.created_by_name, t.created_at,
         t.closed_at, t.closed_by_name,
         tw.name AS technician_name,
         cw.name AS cashier_name
  FROM collection_tickets t
  LEFT JOIN workers tw ON tw.id = t.technician_id
  LEFT JOIN workers cw ON cw.id = t.cashier_id
`;

async function hydrate(rows: TicketRow[]): Promise<TicketThread[]> {
  const messages = await loadMessages(rows.map((r) => r.id));
  return rows.map((r) => mapTicket(r, messages.get(r.id) ?? []));
}

export async function listTickets(filter: {
  status?: "open" | "closed" | "all";
  technicianId?: number;
  cashierId?: number;
}): Promise<TicketThread[]> {
  await ensureTicketTables();
  const where: string[] = [];
  if (filter.status === "open" || filter.status === "closed") {
    where.push(`t.status = '${filter.status}'`);
  }
  if (filter.technicianId != null) {
    where.push(`t.technician_id = ${asInt(filter.technicianId)}`);
  }
  if (filter.cashierId != null) {
    where.push(`t.cashier_id = ${asInt(filter.cashierId)}`);
  }
  const sql =
    TICKET_SELECT +
    (where.length ? ` WHERE ${where.join(" AND ")}` : "") +
    " ORDER BY t.created_at DESC, t.id DESC";
  const rows = await prismadb.$queryRawUnsafe<TicketRow[]>(sql);
  return hydrate(rows);
}

export async function getTicketById(id: number): Promise<TicketThread | null> {
  await ensureTicketTables();
  const rows = await prismadb.$queryRawUnsafe<TicketRow[]>(
    TICKET_SELECT + ` WHERE t.id = ${asInt(id)} LIMIT 1`
  );
  if (!rows[0]) return null;
  const [ticket] = await hydrate(rows);
  return ticket ?? null;
}

export async function getOpenTicketCollectionIds(): Promise<Set<number>> {
  await ensureTicketTables();
  const rows = await prismadb.$queryRawUnsafe<Array<{ collection_id: number }>>(
    `SELECT DISTINCT collection_id FROM collection_tickets WHERE status = 'open'`
  );
  return new Set(rows.map((r) => r.collection_id));
}

export async function findOpenTicketForCollection(collectionId: number) {
  await ensureTicketTables();
  const rows = await prismadb.$queryRawUnsafe<TicketRow[]>(
    TICKET_SELECT +
      ` WHERE t.collection_id = ${asInt(collectionId)} AND t.status = 'open'
        ORDER BY t.id DESC LIMIT 1`
  );
  if (!rows[0]) return null;
  const [ticket] = await hydrate(rows);
  return ticket ?? null;
}

async function loadCollectionContext(collectionId: number) {
  const rows = await prismadb.$queryRawUnsafe<
    Array<{
      id: number;
      machine: string;
      total_sum: unknown;
      actualReceived: unknown;
      recountStatus: string | null;
      handoverId: number | null;
      technicianId: number | null;
      cashier_id: number | null;
      recount_closed_at: Date | null;
    }>
  >(
    `SELECT c.id, c.machine, c.total_sum, c."actualReceived", c."recountStatus",
            c."handoverId", c."technicianId", h.cashier_id, h.recount_closed_at
     FROM collections c
     LEFT JOIN collection_handovers h ON h.id = c."handoverId"
     WHERE c.id = ${asInt(collectionId)}
     LIMIT 1`
  );
  return rows[0] ?? null;
}

export async function createTicketFromCollection(input: {
  collectionId: number;
  body: string;
  author: TicketAuthor;
}): Promise<TicketThread> {
  const body = input.body.trim();
  if (!body) throw new Error("BODY_REQUIRED");

  const existing = await findOpenTicketForCollection(input.collectionId);
  if (existing) {
    return addTicketMessage(existing.id, body, input.author);
  }

  const col = await loadCollectionContext(input.collectionId);
  if (!col) throw new Error("NOT_FOUND");
  if (col.handoverId == null) throw new Error("NOT_HANDED");
  if (!col.recount_closed_at) throw new Error("NOT_CLOSED");

  await ensureTicketTables();
  const inserted = await prismadb.$queryRaw<Array<{ id: number }>>`
    INSERT INTO collection_tickets (
      collection_id, handover_id, technician_id, cashier_id, machine,
      expected_sum, actual_received, status,
      created_by_role, created_by_name, created_by_id, created_at, updated_at
    ) VALUES (
      ${col.id}, ${col.handoverId}, ${col.technicianId}, ${col.cashier_id},
      ${col.machine || "—"}, ${decimalToNumber(col.total_sum)},
      ${col.actualReceived == null ? null : decimalToNumber(col.actualReceived)},
      'open', ${input.author.role}, ${input.author.name}, ${input.author.id},
      NOW(), NOW()
    )
    RETURNING id
  `;
  const ticketId = inserted[0]?.id;
  if (!ticketId) throw new Error("CREATE_FAILED");

  await prismadb.$executeRaw`
    INSERT INTO collection_ticket_messages
      (ticket_id, author_role, author_name, author_id, body, created_at)
    VALUES (${ticketId}, ${input.author.role}, ${input.author.name}, ${input.author.id}, ${body}, NOW())
  `;

  const created = await getTicketById(ticketId);
  if (!created) throw new Error("CREATE_FAILED");
  return created;
}

export async function addTicketMessage(
  ticketId: number,
  body: string,
  author: TicketAuthor
): Promise<TicketThread> {
  const text = body.trim();
  if (!text) throw new Error("BODY_REQUIRED");
  const ticket = await getTicketById(ticketId);
  if (!ticket) throw new Error("NOT_FOUND");
  if (ticket.status === "closed") throw new Error("TICKET_CLOSED");

  if (author.role === "technician" && ticket.technicianId != null) {
    const workerId = parseInt(author.id, 10);
    if (workerId !== ticket.technicianId) throw new Error("FORBIDDEN");
  }
  if (author.role === "cashier" && ticket.cashierId != null) {
    const workerId = parseInt(author.id, 10);
    if (workerId !== ticket.cashierId) throw new Error("FORBIDDEN");
  }

  await prismadb.$executeRaw`
    INSERT INTO collection_ticket_messages
      (ticket_id, author_role, author_name, author_id, body, created_at)
    VALUES (${asInt(ticketId)}, ${author.role}, ${author.name}, ${author.id}, ${text}, NOW())
  `;
  await prismadb.$executeRaw`
    UPDATE collection_tickets SET updated_at = NOW() WHERE id = ${asInt(ticketId)}
  `;
  const next = await getTicketById(ticketId);
  if (!next) throw new Error("NOT_FOUND");
  return next;
}

export async function closeTicket(
  ticketId: number,
  closerName: string
): Promise<TicketThread> {
  const ticket = await getTicketById(ticketId);
  if (!ticket) throw new Error("NOT_FOUND");
  if (ticket.status === "closed") return ticket;

  await prismadb.$executeRaw`
    UPDATE collection_tickets
    SET status = 'closed',
        closed_at = NOW(),
        closed_by_name = ${closerName},
        updated_at = NOW()
    WHERE id = ${asInt(ticketId)}
  `;
  const next = await getTicketById(ticketId);
  if (!next) throw new Error("NOT_FOUND");
  return next;
}
