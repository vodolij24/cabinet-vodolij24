import { endOfMonth, startOfMonth } from "date-fns";

import prismadb from "@/lib/prismadb";
import { digitsOnlyPhone } from "@/lib/phone";
import {
  isTechnicianActionableStatus,
  managerDecisionLabel,
  taskStatusLabel,
  taskTypeLabel,
} from "@/lib/task-fields";
import { parsePhotoUrls } from "@/lib/photo-urls";
import { listTickets } from "@/lib/tickets";
import type { TicketThread } from "@/lib/ticket-types";
import { cashierMachineLabel, machineLabel } from "@/lib/collection-fields";
import { kyivDateLabel, kyivTimeLabel } from "@/lib/kyiv-date";
import { getMachineCashboxMap } from "@/lib/machine-cashbox";
import { getMachineWaterMetricsMap } from "@/lib/soliton-water-metrics";
import { getCachedSensorsMap, type SolitonSensor } from "@/lib/soliton-sensors";
import { ensureCollectionMvpSchema } from "@/lib/collection-schema";
import {
  ANTIFRAUD_DAYS,
  collectionAgingDays,
  collectionStatusLabel,
  collectionStatusOrDefault,
} from "@/lib/collection-status";

export type TechnicianPublicSensor = SolitonSensor;

export type TechnicianPublicMachine = {
  id: number;
  name: string | null;
  location: string;
  lat: string | null;
  lon: string | null;
  status: string | null;
  waterLitersMonth: number;
  cashInMachine: number;
  lastCollectionDate: string | null;
  lastCollectionSum: number | null;
  filterSpeed: number | null;
  waterTds: number | null;
  waterMetricsDate: string | null;
  sensors: TechnicianPublicSensor[];
};

export type TechnicianPublicTask = {
  id: number;
  title: string;
  description: string | null;
  baseLocation: string | null;
  dueAt: string | null;
  salaryDeduction: number | null;
  typeLabel: string;
  status: string | null;
  statusLabel: string;
  actionable: boolean;
  technicianComment: string | null;
  rejectReason: string | null;
  photoUrls: string[];
  managerDecisionLabel: string | null;
};

export type TechnicianPublicCollection = {
  id: number;
  machine: string;
  deviceId: number | null;
  dateLabel: string;
  timeLabel: string;
  dateMs: number;
  status: string;
  statusLabel: string;
  isPhantom: boolean;
  isManual: boolean;
  agingDays: number;
  overdue: boolean;
};

export type TechnicianPublicCashier = {
  id: number;
  name: string;
};

export type TechnicianPublicMachineOption = {
  id: number;
  label: string;
};

export type TechnicianPublicCollections = {
  packages: TechnicianPublicCollection[];
  packageCount: number;
  machineCount: number;
  history: TechnicianPublicCollection[];
  cashiers: TechnicianPublicCashier[];
  machines: TechnicianPublicMachineOption[];
};

export type TechnicianPublicPage = {
  technician: {
    id: number;
    name: string | null;
    phoneDigits: string;
  };
  machines: TechnicianPublicMachine[];
  tasks: TechnicianPublicTask[];
  collections: TechnicianPublicCollections;
  totalWaterLitersMonth: number;
  monthLabel: string;
  tickets: TicketThread[];
};

function asPositiveInt(n: number) {
  const v = Number(n);
  if (!Number.isInteger(v) || v <= 0) throw new Error("Invalid id");
  return v;
}

const emptyCollections = (): TechnicianPublicCollections => ({
  packages: [],
  packageCount: 0,
  machineCount: 0,
  history: [],
  cashiers: [],
  machines: [],
});

/** Technician list: only unhanded collections from this date (Kyiv). */
const UNHANDED_FROM_SQL = "TIMESTAMPTZ '2026-09-01 00:00:00+03'";

type CollectionListRow = {
  id: number;
  machine: string;
  device_id: number | null;
  date: Date;
  location: string | null;
  status: string | null;
  handoverId: number | null;
  is_phantom: boolean | null;
  is_manual: boolean | null;
};

function mapTechPackage(r: CollectionListRow): TechnicianPublicCollection {
  const status = collectionStatusOrDefault(r.status, r.handoverId);
  const agingDays = collectionAgingDays(r.date);
  return {
    id: r.id,
    machine: cashierMachineLabel(r.device_id, r.location, r.machine),
    deviceId: r.device_id,
    dateLabel: kyivDateLabel(r.date),
    timeLabel: kyivTimeLabel(r.date),
    dateMs: r.date.getTime(),
    status,
    statusLabel: collectionStatusLabel(status),
    isPhantom: Boolean(r.is_phantom),
    isManual: Boolean(r.is_manual),
    agingDays,
    overdue: status === "on_hand" && agingDays >= ANTIFRAUD_DAYS,
  };
}

function uniqueMachineCount(packages: TechnicianPublicCollection[]) {
  const machines = new Set<string>();
  for (const pkg of packages) {
    machines.add(
      pkg.deviceId != null ? `id:${pkg.deviceId}` : `name:${pkg.machine}`
    );
  }
  return machines.size;
}

async function listActiveCashiers(): Promise<TechnicianPublicCashier[]> {
  const cashiers = await prismadb.workers.findMany({
    where: {
      role: "cashier",
      OR: [{ active: true }, { active: null }],
    },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });
  return cashiers.map((c) => ({
    id: c.id,
    name: c.name || `Касир #${c.id}`,
  }));
}

/** Нездані інкасації техніка (ще не в здачі касиру) + історія. */
export async function getTechnicianUnhandedCollections(
  technicianId: number,
  machineIds: number[]
): Promise<TechnicianPublicCollections> {
  try {
    await ensureCollectionMvpSchema();
    const techId = asPositiveInt(technicianId);
    const ids = machineIds
      .map((id) => Number(id))
      .filter((id) => Number.isInteger(id) && id > 0);
    const machineFilter = ids.length > 0 ? ` OR c.device_id IN (${ids.join(",")})` : "";
    const ownFilter = `(c."technicianId" = ${techId}${machineFilter})`;

    const [onHand, history, cashiers, machineRows] = await Promise.all([
      prismadb.$queryRawUnsafe<CollectionListRow[]>(
        `SELECT c.id, c.machine, c.device_id, c.date, c.status, c."handoverId",
                COALESCE(c.is_phantom, FALSE) AS is_phantom,
                COALESCE(c.is_manual, FALSE) AS is_manual,
                COALESCE(NULLIF(TRIM(vm.location), ''), NULLIF(TRIM(vm.address), '')) AS location
         FROM collections c
         LEFT JOIN vending_machines vm ON vm.id = c.device_id
         WHERE c."handoverId" IS NULL
           AND COALESCE(c.status, 'on_hand') = 'on_hand'
           AND c.date >= ${UNHANDED_FROM_SQL}
           AND ${ownFilter}
         ORDER BY c.date DESC`
      ),
      prismadb.$queryRawUnsafe<CollectionListRow[]>(
        `SELECT c.id, c.machine, c.device_id, c.date, c.status, c."handoverId",
                COALESCE(c.is_phantom, FALSE) AS is_phantom,
                COALESCE(c.is_manual, FALSE) AS is_manual,
                COALESCE(NULLIF(TRIM(vm.location), ''), NULLIF(TRIM(vm.address), '')) AS location
         FROM collections c
         LEFT JOIN vending_machines vm ON vm.id = c.device_id
         WHERE c.date >= ${UNHANDED_FROM_SQL}
           AND ${ownFilter}
           AND NOT (
             c."handoverId" IS NULL
             AND COALESCE(c.status, 'on_hand') = 'on_hand'
           )
         ORDER BY c.date DESC
         LIMIT 200`
      ),
      listActiveCashiers(),
      ids.length > 0
        ? prismadb.vending_machines.findMany({
            where: { id: { in: ids } },
            orderBy: { id: "asc" },
            select: { id: true, name: true, location: true, address: true },
          })
        : Promise.resolve([]),
    ]);

    const packages = onHand.map(mapTechPackage);
    return {
      packages,
      packageCount: packages.length,
      machineCount: uniqueMachineCount(packages),
      history: history.map(mapTechPackage),
      cashiers,
      machines: machineRows.map((m) => ({
        id: m.id,
        label: machineLabel({
          id: m.id,
          name: m.name,
          location: m.location || m.address,
        }),
      })),
    };
  } catch (error) {
    console.error("[TECH_UNHANDED_COLLECTIONS]", error);
    return emptyCollections();
  }
}

export async function findTechnicianByPhoneDigits(phoneDigits: string) {
  const workers = await prismadb.workers.findMany({
    where: {
      role: "technician",
      OR: [{ active: true }, { active: null }],
      phone: { not: null },
    },
    select: { id: true, name: true, phone: true },
  });

  return (
    workers.find((w) => digitsOnlyPhone(w.phone) === phoneDigits) || null
  );
}

export async function getTechnicianPublicPage(
  phoneDigits: string
): Promise<TechnicianPublicPage | null> {
  const technician = await findTechnicianByPhoneDigits(phoneDigits);
  if (!technician) return null;

  const machines = await prismadb.vending_machines.findMany({
    where: { technicianId: technician.id },
    orderBy: { id: "asc" },
    select: {
      id: true,
      name: true,
      location: true,
      lat: true,
      lon: true,
      status: true,
    },
  });

  const deviceIds = machines.map((m) => m.id);
  const from = startOfMonth(new Date());
  const to = endOfMonth(new Date());

  const waterByDevice = new Map<number, number>();
  if (deviceIds.length > 0) {
    const grouped = await prismadb.transactions.groupBy({
      by: ["device"],
      where: {
        device: { in: deviceIds },
        date: { gte: from, lte: to },
      },
      _sum: { waterFullfilled: true },
    });
    for (const row of grouped) {
      waterByDevice.set(
        row.device,
        Math.round(row._sum.waterFullfilled || 0)
      );
    }
  }

  const [cashboxMap, waterMetrics, sensorsMap, collections] = await Promise.all([
    getMachineCashboxMap(deviceIds),
    getMachineWaterMetricsMap(deviceIds),
    getCachedSensorsMap(deviceIds),
    getTechnicianUnhandedCollections(technician.id, deviceIds),
  ]);

  const rows: TechnicianPublicMachine[] = machines.map((m) => {
    const cashbox = cashboxMap.get(m.id);
    const water = waterMetrics.get(m.id);
    return {
      id: m.id,
      name: m.name,
      location: m.location,
      lat: m.lat,
      lon: m.lon,
      status: m.status,
      waterLitersMonth: waterByDevice.get(m.id) || 0,
      cashInMachine: cashbox?.cashInMachine ?? 0,
      lastCollectionDate: cashbox?.lastCollectionDate ?? null,
      lastCollectionSum: cashbox?.lastCollectionSum ?? null,
      filterSpeed: water?.filterSpeed ?? null,
      waterTds: water?.tds ?? null,
      waterMetricsDate: water?.metricsDate ?? null,
      sensors: sensorsMap.get(m.id) ?? [],
    };
  });

  const totalWaterLitersMonth = rows.reduce(
    (sum, m) => sum + m.waterLitersMonth,
    0
  );

  const monthLabel = from.toLocaleDateString("uk-UA", {
    month: "long",
    year: "numeric",
  });

  const taskRows = await prismadb.tasks.findMany({
    where: { workerId: technician.id },
    orderBy: [{ status: "asc" }, { dueAt: "asc" }, { createdAt: "desc" }],
    select: {
      id: true,
      title: true,
      description: true,
      baseLocation: true,
      dueAt: true,
      salaryDeduction: true,
      type: true,
      status: true,
      technicianComment: true,
      rejectReason: true,
      photoUrls: true,
      managerDecision: true,
      deductionApplied: true,
    },
  });

  const tasks: TechnicianPublicTask[] = taskRows.map((t) => ({
    id: t.id,
    title: t.title,
    description: t.description,
    baseLocation: t.baseLocation,
    dueAt: t.dueAt ? t.dueAt.toLocaleDateString("uk-UA") : null,
    salaryDeduction: t.salaryDeduction,
    typeLabel: taskTypeLabel(t.type),
    status: t.status,
    statusLabel: taskStatusLabel(t.status),
    actionable: isTechnicianActionableStatus(t.status),
    technicianComment: t.technicianComment,
    rejectReason: t.rejectReason,
    photoUrls: parsePhotoUrls(t.photoUrls),
    managerDecisionLabel: t.managerDecision
      ? managerDecisionLabel(t.managerDecision, t.deductionApplied)
      : null,
  }));

  return {
    technician: {
      id: technician.id,
      name: technician.name,
      phoneDigits,
    },
    machines: rows,
    tasks,
    collections,
    tickets: await listTickets({
      status: "open",
      technicianId: technician.id,
    }).catch((error) => {
      console.error("[TECH_TICKETS]", error);
      return [] as TicketThread[];
    }),
    totalWaterLitersMonth,
    monthLabel,
  };
}
