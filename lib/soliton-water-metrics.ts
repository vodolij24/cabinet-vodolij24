import axios from "axios";
import { format, subDays } from "date-fns";

import prismadb from "@/lib/prismadb";

const SOLITON_API = "https://soliton.net.ua/water/api";

export type SolitonWaterMetrics = {
  filterSpeed: number | null;
  filterSpeedDate: string | null;
  tds: number | null;
  qualityValue: number | null;
  qualityDate: string | null;
};

export type MachineWaterMetricsRow = {
  id: number;
  filterSpeed: number | null;
  tds: number | null;
  qualityValue: number | null;
  metricsDate: string | null;
};

function toNum(v: unknown): number | null {
  if (v == null || v === "") return null;
  const n = typeof v === "number" ? v : parseFloat(String(v).replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

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
  const workers = Array.from(
    { length: Math.min(concurrency, Math.max(items.length, 1)) },
    () => worker()
  );
  await Promise.all(workers);
  return results;
}

/** Останні точки якості і швидкості фільтрації за період */
export async function fetchSolitonWaterMetrics(
  deviceId: number,
  daysBack = 14
): Promise<SolitonWaterMetrics> {
  const de = format(new Date(), "yyyy-MM-dd");
  const ds = format(subDays(new Date(), daysBack), "yyyy-MM-dd");
  const body = { device_id: String(deviceId), ds, de };

  const empty: SolitonWaterMetrics = {
    filterSpeed: null,
    filterSpeedDate: null,
    tds: null,
    qualityValue: null,
    qualityDate: null,
  };

  try {
    const [qualityRes, speedRes] = await Promise.all([
      axios.post(`${SOLITON_API}/water_quality.php`, body, { timeout: 15000 }),
      axios.post(`${SOLITON_API}/water_filter_speed.php`, body, {
        timeout: 15000,
      }),
    ]);

    const qData = Array.isArray(qualityRes.data?.data)
      ? qualityRes.data.data
      : [];
    const sData = Array.isArray(speedRes.data?.data)
      ? speedRes.data.data
      : [];

    const lastQ = qData.length ? qData[qData.length - 1] : null;
    const lastS = sData.length ? sData[sData.length - 1] : null;

    return {
      filterSpeed: lastS ? toNum(lastS.speed) : null,
      filterSpeedDate: lastS?.date ? String(lastS.date) : null,
      tds: lastQ ? toNum(lastQ.tds) : null,
      qualityValue: lastQ ? toNum(lastQ.value) : null,
      qualityDate: lastQ?.date ? String(lastQ.date) : null,
    };
  } catch {
    return empty;
  }
}

/** Читає кеш метрик (raw — працює навіть до prisma generate) */
export async function getMachineWaterMetricsMap(
  deviceIds: number[]
): Promise<Map<number, MachineWaterMetricsRow>> {
  const map = new Map<number, MachineWaterMetricsRow>();
  for (const id of deviceIds) {
    map.set(id, {
      id,
      filterSpeed: null,
      tds: null,
      qualityValue: null,
      metricsDate: null,
    });
  }
  if (deviceIds.length === 0) return map;

  try {
    const rows = await prismadb.$queryRawUnsafe<
      Array<{
        id: number;
        solitonFilterSpeed: number | null;
        solitonTds: number | null;
        solitonQualityValue: number | null;
        solitonMetricsDate: string | null;
      }>
    >(
      `SELECT id, "solitonFilterSpeed", "solitonTds", "solitonQualityValue", "solitonMetricsDate"
       FROM vending_machines
       WHERE id = ANY($1::int[])`,
      deviceIds
    );

    for (const row of rows) {
      map.set(row.id, {
        id: row.id,
        filterSpeed: row.solitonFilterSpeed,
        tds: row.solitonTds,
        qualityValue: row.solitonQualityValue,
        metricsDate: row.solitonMetricsDate,
      });
    }
  } catch (error) {
    console.error("[WATER_METRICS_READ]", error);
  }

  return map;
}

/**
 * Оновлює кеш Soliton-метрик на vending_machines (паралельно, з лімітом).
 */
export async function syncWaterMetricsFromSoliton(deviceIds?: number[]) {
  const machines =
    deviceIds && deviceIds.length
      ? deviceIds.map((id) => ({ id }))
      : await prismadb.vending_machines.findMany({
          select: { id: true },
          orderBy: { id: "asc" },
        });

  let updated = 0;
  let failed = 0;

  await mapPool(machines, 8, async (m) => {
    const metrics = await fetchSolitonWaterMetrics(m.id);
    const hasAny =
      metrics.filterSpeed != null ||
      metrics.tds != null ||
      metrics.qualityValue != null;

    if (!hasAny) {
      failed += 1;
      return;
    }

    const metricsDate = metrics.qualityDate || metrics.filterSpeedDate || null;

    try {
      await prismadb.$executeRawUnsafe(
        `UPDATE vending_machines
         SET "solitonFilterSpeed" = $1,
             "solitonTds" = $2,
             "solitonQualityValue" = $3,
             "solitonMetricsDate" = $4,
             "solitonMetricsAt" = NOW(),
             "updatedAt" = NOW()
         WHERE id = $5`,
        metrics.filterSpeed,
        metrics.tds,
        metrics.qualityValue,
        metricsDate,
        m.id
      );
      updated += 1;
    } catch (error) {
      console.error("[WATER_METRICS_UPDATE]", m.id, error);
      failed += 1;
    }
  });

  return { total: machines.length, updated, empty: failed };
}
