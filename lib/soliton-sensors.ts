import axios from "axios";

import prismadb from "@/lib/prismadb";

const SOLITON_SENSORS_URL =
  "http://soliton.net.ua/water/api/device_sensors.php";

export type SolitonSensor = {
  name: string;
  state: string | null;
  value: string | null;
  descr: string | null;
  date: string | null;
};

async function mapPool<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i]);
    }
  }
  await Promise.all(
    Array.from(
      { length: Math.min(concurrency, Math.max(items.length, 1)) },
      () => worker()
    )
  );
  return results;
}

function asText(v: unknown): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  return s ? s : null;
}

export async function fetchDeviceSensors(
  deviceId: number
): Promise<SolitonSensor[]> {
  try {
    const { data } = await axios.post(
      SOLITON_SENSORS_URL,
      { device_id: String(deviceId) },
      { timeout: 12000 }
    );
    if (data?.status !== "success" || !Array.isArray(data?.data)) {
      return [];
    }
    return data.data
      .map((row: Record<string, unknown>) => ({
        name: asText(row.name) || "Датчик",
        state: asText(row.state),
        value: asText(row.sens_val ?? row.value),
        descr: asText(row.descr),
        date: asText(row.date),
      }))
      .filter(
        (s: SolitonSensor) => s.name || s.value || s.state || s.descr
      );
  } catch {
    return [];
  }
}

function intList(ids: number[]) {
  return ids.filter((id) => Number.isInteger(id) && id > 0).join(",");
}

function parseSensors(raw: unknown): SolitonSensor[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((row) => {
      if (!row || typeof row !== "object") return null;
      const r = row as Record<string, unknown>;
      return {
        name: String(r.name || "Датчик"),
        state: r.state == null ? null : String(r.state),
        value: r.value == null ? null : String(r.value),
        descr: r.descr == null ? null : String(r.descr),
        date: r.date == null ? null : String(r.date),
      } satisfies SolitonSensor;
    })
    .filter((s): s is SolitonSensor => Boolean(s));
}

export async function getCachedSensorsMap(
  deviceIds: number[]
): Promise<Map<number, SolitonSensor[]>> {
  const map = new Map<number, SolitonSensor[]>();
  for (const id of deviceIds) map.set(id, []);
  if (deviceIds.length === 0) return map;
  const list = intList(deviceIds);
  if (!list) return map;

  try {
    const rows = await prismadb.$queryRawUnsafe<
      Array<{ id: number; solitonSensors: unknown }>
    >(
      `SELECT id, "solitonSensors" FROM vending_machines WHERE id IN (${list})`
    );
    for (const row of rows) {
      map.set(row.id, parseSensors(row.solitonSensors));
    }
  } catch (error) {
    console.error("[SENSORS_CACHE_READ]", error);
  }
  return map;
}

export async function syncSensorsFromSoliton(deviceIds?: number[]) {
  const machines =
    deviceIds && deviceIds.length
      ? deviceIds.map((id) => ({ id }))
      : await prismadb.vending_machines.findMany({
          select: { id: true },
          orderBy: { id: "asc" },
        });

  let updated = 0;
  await mapPool(machines, 6, async (m) => {
    const sensors = await fetchDeviceSensors(m.id);
    const json = JSON.stringify(sensors).replace(/'/g, "''");
    try {
      await prismadb.$executeRawUnsafe(
        `UPDATE vending_machines
         SET "solitonSensors" = '${json}'::jsonb,
             "solitonMetricsAt" = NOW(),
             "updatedAt" = NOW()
         WHERE id = ${Number(m.id)}`
      );
      updated += 1;
    } catch (error) {
      console.error("[SENSORS_CACHE_UPDATE]", m.id, error);
    }
  });

  return { total: machines.length, updated };
}

export async function fetchSensorsForDevices(
  deviceIds: number[]
): Promise<Map<number, SolitonSensor[]>> {
  return getCachedSensorsMap(deviceIds);
}
