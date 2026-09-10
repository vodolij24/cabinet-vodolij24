import prismadb from "@/lib/prismadb";

let schemaReady = false;
let schemaPromise: Promise<void> | null = null;

async function applyCollectionMvpSchema() {
  await prismadb.$executeRawUnsafe(`
    ALTER TABLE collections
      ADD COLUMN IF NOT EXISTS no_device_data BOOLEAN NOT NULL DEFAULT FALSE,
      ADD COLUMN IF NOT EXISTS status VARCHAR(32) DEFAULT 'on_hand',
      ADD COLUMN IF NOT EXISTS close_mode VARCHAR(16),
      ADD COLUMN IF NOT EXISTS closed_at TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS closed_by_name VARCHAR(255),
      ADD COLUMN IF NOT EXISTS close_reason TEXT,
      ADD COLUMN IF NOT EXISTS is_phantom BOOLEAN NOT NULL DEFAULT FALSE,
      ADD COLUMN IF NOT EXISTS is_manual BOOLEAN NOT NULL DEFAULT FALSE,
      ADD COLUMN IF NOT EXISTS actual_received_coins DECIMAL(10, 2),
      ADD COLUMN IF NOT EXISTS actual_received_banknotes DECIMAL(10, 2),
      ADD COLUMN IF NOT EXISTS review_claimed_at TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS review_claimed_by VARCHAR(255)
  `);

  await prismadb.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS collections_status_idx ON collections (status)
  `);

  await prismadb.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS collection_comments (
      id SERIAL PRIMARY KEY,
      collection_id INTEGER NOT NULL,
      author_role VARCHAR(32) NOT NULL,
      author_name VARCHAR(255) NOT NULL,
      author_id VARCHAR(255),
      body TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await prismadb.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS collection_comments_collection_id_idx
      ON collection_comments (collection_id)
  `);

  await prismadb.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS collection_status_events (
      id SERIAL PRIMARY KEY,
      collection_id INTEGER NOT NULL,
      from_status VARCHAR(32),
      to_status VARCHAR(32) NOT NULL,
      actor_role VARCHAR(32) NOT NULL,
      actor_name VARCHAR(255) NOT NULL,
      actor_id VARCHAR(255),
      payload TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await prismadb.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS collection_status_events_collection_id_idx
      ON collection_status_events (collection_id)
  `);
  await prismadb.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS collection_status_events_created_at_idx
      ON collection_status_events (created_at)
  `);

  await prismadb.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS collection_antifraud_reminders (
      id SERIAL PRIMARY KEY,
      collection_id INTEGER NOT NULL UNIQUE,
      technician_id INTEGER,
      sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await prismadb.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS collection_antifraud_reminders_technician_id_idx
      ON collection_antifraud_reminders (technician_id)
  `);

  await prismadb.$executeRawUnsafe(`
    UPDATE collections
    SET is_manual = TRUE
    WHERE no_device_data = TRUE AND is_manual = FALSE
  `);

  await prismadb.$executeRawUnsafe(`
    UPDATE collections c
    SET status = CASE
      WHEN c."handoverId" IS NULL THEN 'on_hand'
      WHEN c."recountStatus" = 'missing' THEN 'review'
      WHEN c."recountStatus" = 'done' AND h.recount_closed_at IS NOT NULL THEN 'closed_auto'
      WHEN c."recountStatus" = 'done' THEN 'accepted'
      ELSE 'handed'
    END
    FROM collection_handovers h
    WHERE (c.status IS NULL OR c.status = '')
      AND h.id = c."handoverId"
  `);

  await prismadb.$executeRawUnsafe(`
    UPDATE collections
    SET status = 'on_hand'
    WHERE (status IS NULL OR status = '')
      AND "handoverId" IS NULL
  `);

  await prismadb.$executeRawUnsafe(`
    UPDATE collections
    SET status = 'handed'
    WHERE (status IS NULL OR status = '')
      AND "handoverId" IS NOT NULL
  `);
}

export async function ensureCollectionMvpSchema() {
  if (schemaReady) return;
  if (!schemaPromise) {
    schemaPromise = applyCollectionMvpSchema()
      .then(() => {
        schemaReady = true;
      })
      .catch((error) => {
        schemaPromise = null;
        throw error;
      });
  }
  await schemaPromise;
}
