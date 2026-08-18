import { Heading } from "@/components/ui/heading";
import { Separator } from "@/components/ui/separator";
import prismadb from "@/lib/prismadb";
import { requireApprovedAccess } from "@/lib/cabinet-access";
import { getMachineCashboxMap } from "@/lib/machine-cashbox";
import { getMachineTodayStatsMap } from "@/lib/machine-today-stats";
import { getMachineWaterMetricsMap } from "@/lib/soliton-water-metrics";
import { getLastSolitonSyncAt } from "@/lib/soliton-sync";
import { getOpenCollectionTaskCreatedMap } from "@/lib/machine-collection-tasks";
import { kyivDateLabel, kyivTimeLabel, kyivTodayBounds } from "@/lib/kyiv-date";
import { MachinesClient } from "./components/machines-client";

export const dynamic = "force-dynamic";

export default async function MachinesPage() {
  await requireApprovedAccess();

  const [machines, technicianWorkers, todayStats, lastSolitonAt] = await Promise.all([
    prismadb.vending_machines.findMany({
      orderBy: { id: "asc" },
      include: {
        technicianWorker: { select: { id: true, name: true, phone: true } },
      },
    }),
    prismadb.workers.findMany({
      where: {
        role: "technician",
        OR: [{ active: true }, { active: null }],
      },
      orderBy: { name: "asc" },
      select: { id: true, name: true, phone: true },
    }),
    getMachineTodayStatsMap(),
    getLastSolitonSyncAt(),
  ]);

  const deviceIds = machines.map((m) => m.id);
  const [cashboxMap, waterMetrics, collectionTasks] = await Promise.all([
    getMachineCashboxMap(deviceIds),
    getMachineWaterMetricsMap(deviceIds),
    getOpenCollectionTaskCreatedMap(deviceIds),
  ]);
  const { dayKey } = kyivTodayBounds();

  const rows = machines.map((m) => {
    const stats = todayStats.get(m.id);
    const cashbox = cashboxMap.get(m.id);
    const water = waterMetrics.get(m.id);
    return {
      id: m.id,
      name: m.name,
      location: m.location,
      technicianId: m.technicianId,
      technicianName: m.technicianWorker?.name ?? null,
      status: m.status,
      todayLiters: stats?.liters ?? 0,
      todayCash: stats?.cash ?? 0,
      todayCashless: stats?.cashless ?? 0,
      cashInMachine: cashbox?.cashInMachine ?? 0,
      lastCollectionDate: cashbox?.lastCollectionDate ?? null,
      lastCollectionMs: cashbox?.lastCollectionMs ?? null,
      lastCollectionSum: cashbox?.lastCollectionSum ?? null,
      collectionTaskCreatedMs: collectionTasks.get(m.id) ?? null,
      filterSpeed: water?.filterSpeed ?? null,
      waterTds: water?.tds ?? null,
      waterQualityValue: water?.qualityValue ?? null,
      waterMetricsDate: water?.metricsDate ?? null,
    };
  });

  const technicians = technicianWorkers.map((w) => ({
    id: w.id,
    name: w.phone ? `${w.name || "Без імені"} · ${w.phone}` : w.name || `Технік #${w.id}`,
  }));

  return (
    <div className="flex-col">
      <div className="flex-1 space-y-4 p-8 pt-6">
        <Heading
          title="Облік автоматів"
          description="Локація, TDS і датчики — кеш Soliton (щоночі о 03:00). Каса з інкасацій."
        />
        <Separator />
        <MachinesClient
          machines={rows}
          technicians={technicians}
          todayLabel={dayKey}
          lastSolitonSync={
            lastSolitonAt
              ? `${kyivDateLabel(lastSolitonAt)} ${kyivTimeLabel(lastSolitonAt)}`
              : null
          }
        />
      </div>
    </div>
  );
}
