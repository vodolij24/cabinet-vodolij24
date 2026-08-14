import prismadb from "@/lib/prismadb";
import { syncMachinesFromSoliton } from "@/lib/soliton-devices";
import { syncWaterMetricsFromSoliton } from "@/lib/soliton-water-metrics";
import { syncSensorsFromSoliton } from "@/lib/soliton-sensors";

export async function runSolitonSync() {
  const devices = await syncMachinesFromSoliton();
  const metrics = await syncWaterMetricsFromSoliton();
  const sensors = await syncSensorsFromSoliton();
  return { ...devices, metrics, sensors };
}

export async function getLastSolitonSyncAt(): Promise<Date | null> {
  try {
    const rows = await prismadb.$queryRawUnsafe<
      Array<{ last_at: Date | null }>
    >(
      `SELECT MAX("solitonMetricsAt") AS last_at FROM vending_machines`
    );
    return rows[0]?.last_at ?? null;
  } catch (error) {
    console.error("[SOLITON_LAST_SYNC]", error);
    return null;
  }
}
