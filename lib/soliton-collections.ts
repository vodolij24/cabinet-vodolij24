import axios from "axios";

import prismadb from "@/lib/prismadb";
import { kyivDateLabel, kyivDayKey, kyivTimeLabel } from "@/lib/kyiv-date";

/**
 * Збір інкасацій із Soliton по автоматах одного техніка.
 * Злиття візиту і запис без дублів повторюють water-vending-maintenance-bot
 * (utils/collection-visit-merge.js, CollectionRepository.upsertVisit),
 * щоб щоденний збір бота о 08:00 не створював другий рядок.
 */

const SOLITON_INKAS_URL = "https://soliton.net.ua/water/api/device_inkas.php";
const VISIT_MERGE_WINDOW_MS = 2 * 60 * 1000;
const DEVICE_CONCURRENCY = 3;
const DEVICE_TIMEOUT_MS = 15_000;

export const COLLECTION_SYNC_COOLDOWN_MS = 5 * 60 * 1000;
/** Збір, що «завис» довше за це, вважається обірваним. */
const RUNNING_STALE_MS = 3 * 60 * 1000;

type SolitonInkasEntry = {
  date?: string;
  banknotes?: unknown;
  coins?: unknown;
  total_sum?: unknown;
  descr?: string | null;
  description?: string | null;
  collector_id?: string | null;
  collector_nik?: string | null;
};

type Visit = {
  date: Date;
  banknotes: number;
  coins: number;
  total_sum: number;
  description: string | null;
  collector_id: string | null;
  collector_nik: string | null;
};

export function cleanNumericString(value: unknown): number {
  if (value === null || value === undefined || value === "") return 0;
  const str = String(value).trim();
  if (str === "" || str === "null" || str === "undefined") return 0;

  const parts = str.split(".");
  if (parts.length <= 2) {
    const parsed = parseFloat(str);
    return Number.isNaN(parsed) ? 0 : parsed;
  }
  if (parts.length === 3) {
    const [first, middle, last] = parts;
    let cleaned: string;
    if (first === "0" && middle.startsWith("0")) cleaned = `${first}.${middle}${last}`;
    else if (middle === "000" || middle === "00") cleaned = `${first}.${last}`;
    else cleaned = `${first}.${middle}${last}`;
    const parsed = parseFloat(cleaned);
    return Number.isNaN(parsed) ? 0 : parsed;
  }
  const parsed = parseFloat(`${parts[0]}.${parts[parts.length - 1]}`);
  return Number.isNaN(parsed) ? 0 : parsed;
}

function kyivWallString(date: Date) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Kyiv",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)?.value;
  return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}:${get("second")}`;
}

function kyivClock(date: Date) {
  return kyivWallString(date).slice(11);
}

/** Soliton віддає «YYYY-MM-DD HH:mm:ss» як київський час без поясу. */
export function parseSolitonDate(value: unknown): Date | null {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  const str = String(value ?? "").trim();
  if (!str) return null;

  const match = str.match(
    /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?/
  );
  if (!match) {
    const fallback = new Date(str);
    return Number.isNaN(fallback.getTime()) ? null : fallback;
  }

  const [, year, month, day, hour, minute = "00", second = "00"] = match;
  if (hour == null) return new Date(`${year}-${month}-${day}T00:00:00.000Z`);
  const wall = `${year}-${month}-${day}T${hour}:${minute}:${second}`;
  for (const offset of ["+03:00", "+02:00"]) {
    const dt = new Date(`${wall}${offset}`);
    if (!Number.isNaN(dt.getTime()) && kyivWallString(dt) === wall) return dt;
  }
  return new Date(`${wall}+03:00`);
}

/** Рядок лише з датою (00:00 UTC або 03:00 Києва) — не справжній час візиту. */
function isDateStub(date: Date) {
  if (
    date.getUTCHours() === 0 &&
    date.getUTCMinutes() === 0 &&
    date.getUTCSeconds() === 0
  ) {
    return true;
  }
  const clock = kyivClock(date);
  return clock === "03:00:00" || clock === "00:00:00";
}

function pickVisitDate(existing: Date, incoming: Date) {
  if (isDateStub(existing) && !isDateStub(incoming)) return incoming;
  if (!isDateStub(existing) && isDateStub(incoming)) return existing;
  return existing.getTime() <= incoming.getTime() ? existing : incoming;
}

function amountsCompatible(
  a: { banknotes: number; coins: number },
  b: { banknotes: number; coins: number }
) {
  const notesOk = !a.banknotes || !b.banknotes || a.banknotes === b.banknotes;
  const coinsOk = !a.coins || !b.coins || a.coins === b.coins;
  return notesOk && coinsOk;
}

function mergeVisitAmounts(
  a: { banknotes: number; coins: number },
  b: { banknotes: number; coins: number }
) {
  return {
    banknotes: Math.max(a.banknotes || 0, b.banknotes || 0),
    coins: Math.max(a.coins || 0, b.coins || 0),
  };
}

/** Купюри й монети Soliton пише окремими рядками з різницею в секунди — це один візит. */
export function mergeSolitonEntries(entries: SolitonInkasEntry[]): Visit[] {
  const prepared: Visit[] = [];
  for (const entry of entries || []) {
    const banknotes = cleanNumericString(entry.banknotes);
    const coins = cleanNumericString(entry.coins);
    if (banknotes + coins === 0) continue;
    const date = parseSolitonDate(entry.date);
    if (!date) continue;
    prepared.push({
      date,
      banknotes,
      coins,
      total_sum: 0,
      description: entry.descr || entry.description || null,
      collector_id: entry.collector_id || null,
      collector_nik: entry.collector_nik || null,
    });
  }

  prepared.sort((a, b) => a.date.getTime() - b.date.getTime());

  const visits: Visit[] = [];
  for (const item of prepared) {
    const last = visits[visits.length - 1];
    if (
      last &&
      Math.abs(item.date.getTime() - last.date.getTime()) <= VISIT_MERGE_WINDOW_MS
    ) {
      const merged = mergeVisitAmounts(last, item);
      last.banknotes = merged.banknotes;
      last.coins = merged.coins;
      last.date = pickVisitDate(last.date, item.date);
      last.description = last.description || item.description;
      last.collector_id = last.collector_id || item.collector_id;
      last.collector_nik = last.collector_nik || item.collector_nik;
    } else {
      visits.push({ ...item });
    }
  }

  for (const visit of visits) visit.total_sum = visit.banknotes + visit.coins;
  return visits;
}

/** Як extractCollectorInfo у боті, включно з його виправленнями кодування. */
function extractCollectorInfo(descr: string | null): {
  id: string | null;
  nik: string | null;
} {
  if (!descr) return { id: null, nik: null };
  let decoded = descr;
  try {
    decoded = decodeURIComponent(descr);
  } catch {
    decoded = descr;
  }
  if (decoded.includes("Р†РіРѕСЂ")) return { id: "Kirk", nik: "Kirk" };
  if (decoded.includes('Р"РјРёС‚СЂРѕ')) return { id: "Anna", nik: "Anna" };
  if (decoded.includes("Ігор")) return { id: "Ігор", nik: "Ігор" };
  const match = decoded.match(/^(.+?)\s*-\s*$/);
  if (match) return { id: null, nik: match[1].trim() };
  return { id: null, nik: decoded.trim() || null };
}

type ExistingRow = {
  id: number;
  date: Date;
  sum_banknotes: unknown;
  sum_coins: unknown;
};

async function findVisitNear(deviceId: number, visitAt: Date) {
  const windowSeconds = Math.round(VISIT_MERGE_WINDOW_MS / 1000);
  const rows = await prismadb.$queryRaw<ExistingRow[]>`
    SELECT id, date, sum_banknotes, sum_coins
    FROM collections
    WHERE device_id = ${deviceId}
      AND ABS(EXTRACT(EPOCH FROM (date - ${visitAt}::timestamptz))) <= ${windowSeconds}
    ORDER BY date ASC, id ASC
    LIMIT 1`;
  return rows[0] ?? null;
}

async function findSameDayStub(deviceId: number, visitAt: Date) {
  const rows = await prismadb.$queryRaw<ExistingRow[]>`
    SELECT id, date, sum_banknotes, sum_coins
    FROM collections
    WHERE device_id = ${deviceId}
      AND (date AT TIME ZONE 'Europe/Kyiv')::date
          = (${visitAt}::timestamptz AT TIME ZONE 'Europe/Kyiv')::date
      AND (
        (date AT TIME ZONE 'Europe/Kyiv')::time = time '03:00:00'
        OR (date AT TIME ZONE 'Europe/Kyiv')::time = time '00:00:00'
      )
    ORDER BY id ASC
    LIMIT 1`;
  return rows[0] ?? null;
}

function rowAmounts(row: ExistingRow) {
  return {
    banknotes: cleanNumericString(row.sum_banknotes),
    coins: cleanNumericString(row.sum_coins),
  };
}

/** Повертає true, якщо рядок створено або доповнено. */
async function upsertVisit(
  deviceId: number,
  machine: string,
  visit: Visit
): Promise<boolean> {
  const incoming = { banknotes: visit.banknotes, coins: visit.coins };

  let existing = await findVisitNear(deviceId, visit.date);
  if (!existing) {
    const stub = await findSameDayStub(deviceId, visit.date);
    if (stub && amountsCompatible(rowAmounts(stub), incoming)) existing = stub;
  }

  if (existing) {
    const current = rowAmounts(existing);
    const merged = mergeVisitAmounts(current, incoming);
    const nextDate = pickVisitDate(new Date(existing.date), visit.date);
    const unchanged =
      current.banknotes === merged.banknotes &&
      current.coins === merged.coins &&
      new Date(existing.date).getTime() === nextDate.getTime() &&
      !isDateStub(new Date(existing.date));
    if (unchanged) return false;

    await prismadb.$executeRaw`
      UPDATE collections
      SET date = ${nextDate},
          sum_banknotes = ${merged.banknotes},
          sum_coins = ${merged.coins},
          total_sum = ${merged.banknotes + merged.coins},
          updated_at = NOW()
      WHERE id = ${existing.id}`;
    return true;
  }

  const collector = extractCollectorInfo(visit.description);
  await prismadb.$executeRaw`
    INSERT INTO collections (
      date, sum_banknotes, sum_coins, total_sum, note, machine,
      collector_id, collector_nik, device_id, created_at, updated_at
    ) VALUES (
      ${visit.date}, ${visit.banknotes}, ${visit.coins}, ${visit.total_sum},
      ${visit.description}, ${machine},
      ${collector.id || visit.collector_id}, ${collector.nik || visit.collector_nik},
      ${deviceId}, NOW(), NOW()
    )`;
  return true;
}

async function fetchDeviceInkas(deviceId: number, ds: string, de: string) {
  const { data } = await axios.post(
    SOLITON_INKAS_URL,
    { device_id: String(deviceId), ds, de },
    { timeout: DEVICE_TIMEOUT_MS }
  );
  if (data?.status !== "success") {
    throw new Error(String(data?.descr || "Soliton error"));
  }
  return (Array.isArray(data.data) ? data.data : []) as SolitonInkasEntry[];
}

let syncTableReady = false;

async function ensureCollectionSyncTable() {
  if (syncTableReady) return;
  await prismadb.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS technician_collection_syncs (
      technician_id INTEGER PRIMARY KEY,
      status VARCHAR(16) NOT NULL,
      started_at TIMESTAMPTZ NOT NULL,
      finished_at TIMESTAMPTZ,
      devices_total INTEGER NOT NULL DEFAULT 0,
      devices_done INTEGER NOT NULL DEFAULT 0,
      found INTEGER NOT NULL DEFAULT 0,
      error TEXT
    )
  `);
  syncTableReady = true;
}

type SyncRow = {
  status: string;
  started_at: Date;
  finished_at: Date | null;
  devices_total: number;
  devices_done: number;
  found: number;
};

export type CollectionSyncState = {
  status: "never" | "running" | "ok" | "error";
  finishedAt: string | null;
  finishedLabel: string | null;
  devicesTotal: number;
  devicesDone: number;
  found: number;
  nextAllowedAt: string | null;
};

function updatedLabel(date: Date) {
  const time = kyivTimeLabel(date);
  return kyivDayKey(date) === kyivDayKey()
    ? `сьогодні о ${time}`
    : `${kyivDateLabel(date)} о ${time}`;
}

function toState(row: SyncRow | null): CollectionSyncState {
  if (!row) {
    return {
      status: "never",
      finishedAt: null,
      finishedLabel: null,
      devicesTotal: 0,
      devicesDone: 0,
      found: 0,
      nextAllowedAt: null,
    };
  }
  const startedMs = new Date(row.started_at).getTime();
  const stale =
    row.status === "running" && Date.now() - startedMs > RUNNING_STALE_MS;
  const status = stale
    ? "error"
    : row.status === "running" || row.status === "ok"
      ? row.status
      : "error";
  const finished = row.finished_at ? new Date(row.finished_at) : null;
  return {
    status,
    finishedAt: finished ? finished.toISOString() : null,
    finishedLabel: finished ? updatedLabel(finished) : null,
    devicesTotal: row.devices_total,
    devicesDone: row.devices_done,
    found: row.found,
    nextAllowedAt: new Date(startedMs + COLLECTION_SYNC_COOLDOWN_MS).toISOString(),
  };
}

export async function getCollectionSyncState(
  technicianId: number
): Promise<CollectionSyncState> {
  await ensureCollectionSyncTable();
  const rows = await prismadb.$queryRaw<SyncRow[]>`
    SELECT status, started_at, finished_at, devices_total, devices_done, found
    FROM technician_collection_syncs
    WHERE technician_id = ${technicianId}`;
  return toState(rows[0] ?? null);
}

/** Займає слот збору, якщо від попереднього старту минуло більше паузи. */
async function claimSync(technicianId: number, devicesTotal: number) {
  const cooldownSeconds = Math.round(COLLECTION_SYNC_COOLDOWN_MS / 1000);
  const rows = await prismadb.$queryRaw<Array<{ technician_id: number }>>`
    INSERT INTO technician_collection_syncs (
      technician_id, status, started_at, devices_total, devices_done, found
    ) VALUES (${technicianId}, 'running', NOW(), ${devicesTotal}, 0, 0)
    ON CONFLICT (technician_id) DO UPDATE
      SET status = 'running',
          started_at = NOW(),
          devices_total = EXCLUDED.devices_total,
          devices_done = 0,
          found = 0,
          error = NULL
      WHERE technician_collection_syncs.started_at
            < NOW() - make_interval(secs => ${cooldownSeconds})
    RETURNING technician_id`;
  return rows.length > 0;
}

/**
 * Перевіряє в Soliton автомати техніка за вчора і сьогодні.
 * Не частіше разу на COLLECTION_SYNC_COOLDOWN_MS; інакше лише повертає стан.
 */
export async function syncTechnicianCollections(
  technicianId: number
): Promise<{ started: boolean; state: CollectionSyncState }> {
  await ensureCollectionSyncTable();

  const machines = await prismadb.vending_machines.findMany({
    where: { technicianId },
    orderBy: { id: "asc" },
    select: { id: true, location: true, name: true },
  });

  const claimed = await claimSync(technicianId, machines.length);
  if (!claimed) {
    return { started: false, state: await getCollectionSyncState(technicianId) };
  }

  const de = kyivDayKey();
  const ds = kyivDayKey(new Date(Date.now() - 24 * 60 * 60 * 1000));
  let found = 0;
  let failed = 0;
  let next = 0;

  const worker = async () => {
    while (next < machines.length) {
      const machine = machines[next++];
      try {
        const entries = await fetchDeviceInkas(machine.id, ds, de);
        const label = machine.location || machine.name || `Device ${machine.id}`;
        for (const visit of mergeSolitonEntries(entries)) {
          if (await upsertVisit(machine.id, label, visit)) found += 1;
        }
      } catch (error) {
        failed += 1;
        console.error("[COLLECTION_SYNC_DEVICE]", machine.id, error);
      }
      await prismadb.$executeRaw`
        UPDATE technician_collection_syncs
        SET devices_done = devices_done + 1, found = ${found}
        WHERE technician_id = ${technicianId}`;
    }
  };

  try {
    await Promise.all(
      Array.from({ length: Math.min(DEVICE_CONCURRENCY, machines.length) }, worker)
    );
    const status = machines.length > 0 && failed === machines.length ? "error" : "ok";
    await prismadb.$executeRaw`
      UPDATE technician_collection_syncs
      SET status = ${status},
          finished_at = NOW(),
          found = ${found},
          error = ${failed > 0 ? `Soliton не відповів по ${failed} автоматах` : null}
      WHERE technician_id = ${technicianId}`;
  } catch (error) {
    console.error("[COLLECTION_SYNC]", error);
    await prismadb.$executeRaw`
      UPDATE technician_collection_syncs
      SET status = 'error', error = ${error instanceof Error ? error.message : "error"}
      WHERE technician_id = ${technicianId}`;
  }

  return { started: true, state: await getCollectionSyncState(technicianId) };
}
