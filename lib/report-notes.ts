import prismadb from "@/lib/prismadb";

export const EXPENSE_FUNDS_REPORT = "expense-funds";

export const REPORT_FUNDS = ["salary", "rent", "utilities"] as const;

export type ReportFund = (typeof REPORT_FUNDS)[number];

export type ReportFundNote = {
  id: number;
  fund: ReportFund;
  fromPeriod: string;
  toPeriod: string;
  body: string;
  authorName: string;
  createdAt: string;
};

const SEED_KEY = "salary-aug-sep-2026-techdir";

const SEED_BODY =
  "ЗП фонд у вересні вищий за серпень приблизно на 80 000 грн. Це премія технічного директора: 25 761 грн у серпні і 100 486 грн у вересні (+74 725 грн). Решта близько +5 300 грн складається так: З/П Володимир +35 000, каса Теребенець −25 873, техніки −4 425, колцентр +600.";

function isReportFund(value: string): value is ReportFund {
  return (REPORT_FUNDS as readonly string[]).includes(value);
}

let tableReady = false;

async function ensureReportNotesTable() {
  if (tableReady) return;
  await prismadb.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS report_fund_notes (
      id SERIAL PRIMARY KEY,
      report_key VARCHAR(64) NOT NULL,
      fund VARCHAR(32) NOT NULL,
      from_period VARCHAR(7) NOT NULL,
      to_period VARCHAR(7) NOT NULL,
      body TEXT NOT NULL,
      author_name VARCHAR(255) NOT NULL,
      author_id VARCHAR(255),
      seed_key VARCHAR(64) UNIQUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await prismadb.$executeRaw`
    INSERT INTO report_fund_notes (
      report_key, fund, from_period, to_period, body, author_name, seed_key
    )
    SELECT
      ${EXPENSE_FUNDS_REPORT},
      'salary',
      '2026-08',
      '2026-09',
      ${SEED_BODY},
      'Кабінет',
      ${SEED_KEY}
    WHERE NOT EXISTS (
      SELECT 1 FROM report_fund_notes WHERE seed_key = ${SEED_KEY}
    )
  `;
  tableReady = true;
}

type NoteRow = {
  id: number;
  fund: string;
  from_period: string;
  to_period: string;
  body: string;
  author_name: string;
  created_at: Date;
};

function mapNote(row: NoteRow): ReportFundNote | null {
  if (!isReportFund(row.fund)) return null;
  return {
    id: row.id,
    fund: row.fund,
    fromPeriod: row.from_period,
    toPeriod: row.to_period,
    body: row.body,
    authorName: row.author_name,
    createdAt: row.created_at.toISOString(),
  };
}

export async function listReportFundNotes(
  reportKey = EXPENSE_FUNDS_REPORT
): Promise<ReportFundNote[]> {
  await ensureReportNotesTable();
  const rows = await prismadb.$queryRaw<NoteRow[]>`
    SELECT id, fund, from_period, to_period, body, author_name, created_at
    FROM report_fund_notes
    WHERE report_key = ${reportKey}
    ORDER BY created_at DESC, id DESC
  `;
  return rows.flatMap((row) => {
    const note = mapNote(row);
    return note ? [note] : [];
  });
}

export async function createReportFundNote(input: {
  reportKey?: string;
  fund: ReportFund;
  fromPeriod: string;
  toPeriod: string;
  body: string;
  authorName: string;
  authorId: string;
}): Promise<ReportFundNote> {
  await ensureReportNotesTable();
  const rows = await prismadb.$queryRaw<NoteRow[]>`
    INSERT INTO report_fund_notes (
      report_key, fund, from_period, to_period, body, author_name, author_id
    )
    VALUES (
      ${input.reportKey ?? EXPENSE_FUNDS_REPORT},
      ${input.fund},
      ${input.fromPeriod},
      ${input.toPeriod},
      ${input.body},
      ${input.authorName},
      ${input.authorId}
    )
    RETURNING id, fund, from_period, to_period, body, author_name, created_at
  `;
  const note = mapNote(rows[0]);
  if (!note) throw new Error("Не вдалося зберегти примітку");
  return note;
}

export async function deleteReportFundNote(id: number): Promise<void> {
  await ensureReportNotesTable();
  await prismadb.$executeRaw`
    DELETE FROM report_fund_notes WHERE id = ${id}
  `;
}
