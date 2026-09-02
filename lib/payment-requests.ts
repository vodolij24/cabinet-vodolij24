import "server-only";

import prismadb from "@/lib/prismadb";
import { kyivDayKey } from "@/lib/kyiv-date";

import {
  formatPaymentRequest,
  paymentCategoryPnlTarget,
  paymentPeriodKey,
  type PaymentCalendarPnlTotals,
  type PaymentRequestRow,
  type PaymentRequestView,
} from "@/lib/payment-requests-shared";

export * from "@/lib/payment-requests-shared";

type RawPaymentRow = {
  id: number;
  title: string;
  description: string | null;
  amount: number;
  due_date: Date;
  period_key: string;
  category: string;
  priority: string;
  status: string;
  fund_source: string | null;
  fund_source_note: string | null;
  paid_at: Date | null;
  paid_amount: number | null;
  paid_by_name: string | null;
  paid_by_id: string | null;
  accounted: boolean;
  accounted_at: Date | null;
  accounted_by_name: string | null;
  author_id: string | null;
  author_name: string | null;
  created_at: Date;
  updated_at: Date;
};

let tableReady = false;

export async function ensurePaymentRequestsTable() {
  if (tableReady) return;
  await prismadb.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS payment_requests (
      id SERIAL PRIMARY KEY,
      title VARCHAR(255) NOT NULL,
      description TEXT,
      amount INT NOT NULL,
      due_date DATE NOT NULL,
      period_key VARCHAR(16) NOT NULL,
      category VARCHAR(32) NOT NULL DEFAULT 'other',
      priority VARCHAR(16) NOT NULL DEFAULT 'normal',
      status VARCHAR(16) NOT NULL DEFAULT 'pending',
      fund_source VARCHAR(32),
      fund_source_note TEXT,
      paid_at TIMESTAMPTZ,
      paid_amount INT,
      paid_by_name VARCHAR(255),
      paid_by_id VARCHAR(255),
      accounted BOOLEAN NOT NULL DEFAULT FALSE,
      accounted_at TIMESTAMPTZ,
      accounted_by_name VARCHAR(255),
      author_id VARCHAR(255),
      author_name VARCHAR(255),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await prismadb.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS payment_requests_due_date_idx
      ON payment_requests (due_date)
  `);
  await prismadb.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS payment_requests_period_key_idx
      ON payment_requests (period_key)
  `);
  await prismadb.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS payment_requests_status_idx
      ON payment_requests (status)
  `);
  tableReady = true;
}

function mapRow(r: RawPaymentRow): PaymentRequestRow {
  return {
    id: r.id,
    title: r.title,
    description: r.description,
    amount: r.amount,
    dueDate: r.due_date,
    periodKey: r.period_key,
    category: r.category,
    priority: r.priority,
    status: r.status,
    fundSource: r.fund_source,
    fundSourceNote: r.fund_source_note,
    paidAt: r.paid_at,
    paidAmount: r.paid_amount,
    paidByName: r.paid_by_name,
    paidById: r.paid_by_id,
    accounted: r.accounted,
    accountedAt: r.accounted_at,
    accountedByName: r.accounted_by_name,
    authorId: r.author_id,
    authorName: r.author_name,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

async function findPaymentById(id: number): Promise<PaymentRequestRow | null> {
  await ensurePaymentRequestsTable();
  const rows = await prismadb.$queryRawUnsafe<RawPaymentRow[]>(
    `SELECT * FROM payment_requests WHERE id = ${id} LIMIT 1`
  );
  return rows[0] ? mapRow(rows[0]) : null;
}

export async function listPaymentRequests(): Promise<PaymentRequestView[]> {
  await ensurePaymentRequestsTable();
  const rows = await prismadb.$queryRawUnsafe<RawPaymentRow[]>(
    `SELECT * FROM payment_requests
     ORDER BY due_date ASC, priority ASC, id DESC`
  );
  return rows.map((r) => formatPaymentRequest(mapRow(r)));
}

export async function createPaymentRequest(input: {
  title: string;
  description: string | null;
  amount: number;
  dueDate: Date;
  category: string;
  priority: string;
  fundSource: string | null;
  fundSourceNote: string | null;
  authorId: string;
  authorName: string;
}): Promise<PaymentRequestView> {
  await ensurePaymentRequestsTable();
  const periodKey = paymentPeriodKey(input.dueDate);
  const esc = (s: string) => s.replace(/'/g, "''");
  const rows = await prismadb.$queryRawUnsafe<RawPaymentRow[]>(`
    INSERT INTO payment_requests (
      title, description, amount, due_date, period_key,
      category, priority, status, fund_source, fund_source_note,
      author_id, author_name, updated_at
    ) VALUES (
      '${esc(input.title)}',
      ${input.description ? `'${esc(input.description)}'` : "NULL"},
      ${input.amount},
      '${kyivDayKey(input.dueDate)}'::date,
      '${esc(periodKey)}',
      '${esc(input.category)}',
      '${esc(input.priority)}',
      'pending',
      ${input.fundSource ? `'${esc(input.fundSource)}'` : "NULL"},
      ${input.fundSourceNote ? `'${esc(input.fundSourceNote)}'` : "NULL"},
      '${esc(input.authorId)}',
      '${esc(input.authorName)}',
      NOW()
    )
    RETURNING *
  `);
  return formatPaymentRequest(mapRow(rows[0]));
}

export async function updatePaymentRequest(
  id: number,
  data: Record<string, unknown>
): Promise<PaymentRequestView | null> {
  await ensurePaymentRequestsTable();
  const sets: string[] = ["updated_at = NOW()"];
  const esc = (s: string) => s.replace(/'/g, "''");

  for (const [key, value] of Object.entries(data)) {
    if (key === "title" && typeof value === "string") {
      sets.push(`title = '${esc(value)}'`);
    } else if (key === "description") {
      sets.push(
        value == null || value === ""
          ? "description = NULL"
          : `description = '${esc(String(value))}'`
      );
    } else if (key === "amount" && typeof value === "number") {
      sets.push(`amount = ${value}`);
    } else if (key === "dueDate" && value instanceof Date) {
      sets.push(`due_date = '${kyivDayKey(value)}'::date`);
      sets.push(`period_key = '${esc(paymentPeriodKey(value))}'`);
    } else if (typeof value === "string") {
      const colMap: Record<string, string> = {
        category: "category",
        priority: "priority",
        status: "status",
        fundSource: "fund_source",
        fundSourceNote: "fund_source_note",
        paidByName: "paid_by_name",
        paidById: "paid_by_id",
        accountedByName: "accounted_by_name",
      };
      const col = colMap[key];
      if (col) sets.push(`${col} = '${esc(value)}'`);
    } else if (key === "fundSource" && value === null) {
      sets.push("fund_source = NULL");
    } else if (key === "paidAmount" && typeof value === "number") {
      sets.push(`paid_amount = ${value}`);
    } else if (key === "paidAt" && value instanceof Date) {
      sets.push(`paid_at = '${value.toISOString()}'::timestamptz`);
    } else if (key === "accounted" && typeof value === "boolean") {
      sets.push(`accounted = ${value}`);
    } else if (key === "accountedAt") {
      sets.push(
        value instanceof Date
          ? `accounted_at = '${value.toISOString()}'::timestamptz`
          : "accounted_at = NULL"
      );
    } else if (key === "accountedByName") {
      sets.push(
        value == null
          ? "accounted_by_name = NULL"
          : `accounted_by_name = '${esc(String(value))}'`
      );
    }
  }

  const rows = await prismadb.$queryRawUnsafe<RawPaymentRow[]>(
    `UPDATE payment_requests SET ${sets.join(", ")} WHERE id = ${id} RETURNING *`
  );
  return rows[0] ? formatPaymentRequest(mapRow(rows[0])) : null;
}

export async function deletePaymentRequest(id: number): Promise<void> {
  await ensurePaymentRequestsTable();
  await prismadb.$executeRawUnsafe(
    `DELETE FROM payment_requests WHERE id = ${id}`
  );
}

export { findPaymentById };

export async function listAccountedPaymentsForPnl(
  periodKey: string
): Promise<PaymentCalendarPnlTotals> {
  await ensurePaymentRequestsTable();
  const esc = (s: string) => s.replace(/'/g, "''");
  const rows = await prismadb.$queryRawUnsafe<RawPaymentRow[]>(`
    SELECT * FROM payment_requests
    WHERE accounted = true
      AND status IN ('paid', 'partial')
      AND period_key = '${esc(periodKey)}'
    ORDER BY paid_at ASC NULLS LAST, id ASC
  `);

  const totals: PaymentCalendarPnlTotals = {
    rent: 0,
    utilities: 0,
    taxes: 0,
    other: 0,
    lines: [],
  };

  for (const raw of rows) {
    const row = mapRow(raw);
    const view = formatPaymentRequest(row);
    const amount = row.paidAmount ?? row.amount;
    const target = paymentCategoryPnlTarget(row.category);
    totals[target] += amount;
    totals.lines.push({
      id: row.id,
      title: row.title,
      amount,
      category: row.category,
      categoryLabel: view.categoryLabel,
      target,
      paidByName: row.paidByName,
      paidAt: row.paidAt ? row.paidAt.toISOString() : null,
    });
  }

  return totals;
}
