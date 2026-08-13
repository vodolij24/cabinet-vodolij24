import axios from "axios";

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

export async function fetchSensorsForDevices(
  deviceIds: number[]
): Promise<Map<number, SolitonSensor[]>> {
  const map = new Map<number, SolitonSensor[]>();
  if (deviceIds.length === 0) return map;

  await mapPool(deviceIds, 6, async (id) => {
    map.set(id, await fetchDeviceSensors(id));
  });

  return map;
}
