import prismadb from "@/lib/prismadb";
import { recountAlert } from "@/lib/collection-alert";
import { decimalToNumber, machineLabel } from "@/lib/collection-fields";
import { kyivDateLabel, kyivTimeLabel } from "@/lib/kyiv-date";
import { ensureCollectionMvpSchema } from "@/lib/collection-schema";
import {
  collectionStatusLabel,
  collectionStatusOrDefault,
  decideAfterFact,
} from "@/lib/collection-status";
import { asInt, sqlLit } from "@/lib/collection-sql";
import type { CollectionColumn } from "@/app/(dashboard)/collections/components/columns";

function money(n: number) {
  return `${n.toLocaleString("uk-UA", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} грн`;
}

export type CollectionsBoardSummary = {
  collections: number;
  machines: number;
  sumCoins: number;
  sumBanknotes: number;
  total: number;
};

export type CollectionsBoardAnalytics = {
  autoPct: number | null;
  mismatchPct: number | null;
  techRows: { name: string; total: number; mismatch: number }[];
  phantomMachines: [string, { phantoms: number }][];
};

export type CollectionsBoard = {
  rows: CollectionColumn[];
  summary: CollectionsBoardSummary;
  analytics: CollectionsBoardAnalytics;
};

type BoardRow = {
  id: number;
  date: Date;
  device_id: number | null;
  machine: string;
  technicianId: number | null;
  technician_name: string | null;
  machine_technician_id: number | null;
  machine_technician_name: string | null;
  location: string | null;
  machine_name: string | null;
  count_coins: number | null;
  sum_coins: unknown;
  count_banknotes: number | null;
  sum_banknotes: unknown;
  total_sum: unknown;
  handoverId: number | null;
  actualReceived: unknown;
  recountStatus: string | null;
  recount_closed_at: Date | null;
  cashier_id: number | null;
  cashier_name: string | null;
  handover_at: Date | null;
  claimed_packages: number | null;
  received_packages: number | null;
  no_device_data: boolean | null;
  status: string | null;
  is_phantom: boolean | null;
  is_manual: boolean | null;
};

export async function loadCollectionsBoard(input: {
  from: Date;
  to: Date;
  technicianId?: number | null;
  openTicketIds?: Set<number>;
}): Promise<CollectionsBoard> {
  await ensureCollectionMvpSchema();
  const techFilter =
    input.technicianId != null && Number.isInteger(input.technicianId)
      ? ` AND (c."technicianId" = ${asInt(input.technicianId, 1)} OR (c."technicianId" IS NULL AND vm."technicianId" = ${asInt(input.technicianId, 1)}))`
      : "";

  const rows = await prismadb.$queryRawUnsafe<BoardRow[]>(
    `SELECT c.id, c.date, c.device_id, c.machine, c."technicianId",
            c.count_coins, c.sum_coins, c.count_banknotes, c.sum_banknotes, c.total_sum,
            c."handoverId", c."actualReceived", c."recountStatus",
            COALESCE(c.no_device_data, FALSE) AS no_device_data,
            c.status,
            COALESCE(c.is_phantom, FALSE) AS is_phantom,
            COALESCE(c.is_manual, FALSE) AS is_manual,
            h.recount_closed_at, h.cashier_id, h.created_at AS handover_at,
            h.claimed_packages, h.received_packages,
            w.name AS technician_name,
            cw.name AS cashier_name,
            vm.name AS machine_name,
            vm."technicianId" AS machine_technician_id,
            tw.name AS machine_technician_name,
            COALESCE(NULLIF(TRIM(vm.location), ''), NULLIF(TRIM(vm.address), '')) AS location
     FROM collections c
     LEFT JOIN collection_handovers h ON h.id = c."handoverId"
     LEFT JOIN workers w ON w.id = c."technicianId"
     LEFT JOIN workers cw ON cw.id = h.cashier_id
     LEFT JOIN vending_machines vm ON vm.id = c.device_id
     LEFT JOIN workers tw ON tw.id = vm."technicianId"
     WHERE c.date >= ${sqlLit(input.from.toISOString())}::timestamptz
       AND c.date <= ${sqlLit(input.to.toISOString())}::timestamptz
       ${techFilter}
     ORDER BY c.date DESC`
  );

  const formatted = rows.map((item) => mapBoardRow(item, input.openTicketIds));
  return {
    rows: formatted,
    summary: summarizeUnhanded(formatted),
    analytics: analyzeBoard(formatted),
  };
}

function mapBoardRow(
  item: BoardRow,
  openTicketIds?: Set<number>
): CollectionColumn {
  const machineName = item.device_id
    ? machineLabel({
        id: item.device_id,
        name: item.machine_name,
        location: item.location,
      })
    : item.machine || "—";
  const technicianId = item.technicianId ?? item.machine_technician_id ?? null;
  const technicianName =
    item.technician_name ||
    item.machine_technician_name ||
    (technicianId != null ? `Технік #${technicianId}` : "—");
  const sumCoins = decimalToNumber(item.sum_coins);
  const sumBanknotes = decimalToNumber(item.sum_banknotes);
  const total = decimalToNumber(item.total_sum) || sumCoins + sumBanknotes;
  const handedOver = item.handoverId != null;
  const actualReceived =
    item.recountStatus === "missing"
      ? null
      : item.actualReceived == null
        ? null
        : decimalToNumber(item.actualReceived);
  const difference =
    item.recountStatus === "missing"
      ? total
      : actualReceived == null
        ? null
        : Math.round((total - actualReceived) * 100) / 100;
  const cashierName =
    item.cashier_id != null
      ? item.cashier_name || `Касир #${item.cashier_id}`
      : "";
  const status = collectionStatusOrDefault(item.status, item.handoverId);
  const decision =
    item.recountStatus === "missing" || actualReceived != null
      ? decideAfterFact({
          expected: total,
          actual: actualReceived ?? 0,
          isPhantom: Boolean(item.is_phantom),
          isManual: Boolean(item.is_manual),
          noDeviceData: Boolean(item.no_device_data),
          missing: item.recountStatus === "missing",
        })
      : null;
  const alert = recountAlert({
    handedOver,
    recountStatus: item.recountStatus,
    difference,
    noDeviceData: Boolean(item.no_device_data),
    status,
    deltaPct: decision?.deltaPct ?? null,
  });

  return {
    id: item.id,
    machine: machineName,
    deviceId: item.device_id,
    date: kyivDateLabel(item.date),
    time: kyivTimeLabel(item.date),
    dateMs: item.date.getTime(),
    technicianId,
    technicianName,
    cashierName,
    countCoins: item.count_coins ?? 0,
    sumCoinsValue: sumCoins,
    sumCoins: money(sumCoins),
    countBanknotes: item.count_banknotes ?? 0,
    sumBanknotesValue: sumBanknotes,
    sumBanknotes: money(sumBanknotes),
    totalValue: total,
    total: money(total),
    handedOver,
    handoverId: item.handoverId,
    handoverDate: item.handover_at ? kyivDateLabel(item.handover_at) : "",
    handoverTime: item.handover_at ? kyivTimeLabel(item.handover_at) : "",
    handoverDateMs: item.handover_at?.getTime() ?? 0,
    claimedPackages: item.claimed_packages ?? 0,
    receivedPackages: item.received_packages ?? 0,
    recountStatus: item.recountStatus,
    recountClosed: Boolean(item.recount_closed_at),
    actualReceived,
    actualReceivedLabel:
      item.recountStatus === "missing"
        ? "Відсутній"
        : actualReceived == null
          ? "—"
          : money(actualReceived),
    difference,
    differenceLabel: difference == null ? "—" : money(difference),
    alert,
    openTicket: openTicketIds?.has(item.id) ?? false,
    noDeviceData: Boolean(item.no_device_data),
    lifecycleStatus: status,
    lifecycleStatusLabel: collectionStatusLabel(status),
    isPhantom: Boolean(item.is_phantom),
    isManual: Boolean(item.is_manual),
    deltaPct: decision?.deltaPct ?? null,
    search: `${machineName} ${technicianName} ${cashierName} ${item.id} ${collectionStatusLabel(status)}`,
  };
}

function summarizeUnhanded(rows: CollectionColumn[]): CollectionsBoardSummary {
  const machines = new Set<string>();
  let sumCoins = 0;
  let sumBanknotes = 0;
  let total = 0;
  let collections = 0;
  for (const row of rows) {
    if (row.handedOver) continue;
    collections += 1;
    machines.add(
      row.deviceId != null ? `id:${row.deviceId}` : `name:${row.machine}`
    );
    sumCoins += row.sumCoinsValue;
    sumBanknotes += row.sumBanknotesValue;
    total += row.totalValue;
  }
  return { collections, machines: machines.size, sumCoins, sumBanknotes, total };
}

function analyzeBoard(rows: CollectionColumn[]): CollectionsBoardAnalytics {
  const withFact = rows.filter(
    (r) => r.actualReceived != null && r.recountStatus === "done"
  );
  const mismatch = withFact.filter((r) => r.deltaPct != null && r.deltaPct > 2);
  const autoClosed = rows.filter((r) => r.lifecycleStatus === "closed_auto").length;
  const closed =
    autoClosed + rows.filter((r) => r.lifecycleStatus === "closed_manual").length;
  const byTech = new Map<string, { name: string; total: number; mismatch: number }>();
  for (const row of withFact) {
    const key = String(row.technicianId ?? row.technicianName);
    const cur = byTech.get(key) ?? {
      name: row.technicianName,
      total: 0,
      mismatch: 0,
    };
    cur.total += 1;
    if (row.deltaPct != null && row.deltaPct > 2) cur.mismatch += 1;
    byTech.set(key, cur);
  }
  const byMachine = new Map<string, { phantoms: number }>();
  for (const row of rows) {
    if (!row.isPhantom) continue;
    const cur = byMachine.get(row.machine) ?? { phantoms: 0 };
    cur.phantoms += 1;
    byMachine.set(row.machine, cur);
  }
  return {
    autoPct: closed > 0 ? Math.round((autoClosed / closed) * 1000) / 10 : null,
    mismatchPct:
      withFact.length > 0
        ? Math.round((mismatch.length / withFact.length) * 1000) / 10
        : null,
    techRows: [...byTech.values()]
      .sort((a, b) => b.mismatch / b.total - a.mismatch / a.total)
      .slice(0, 5),
    phantomMachines: [...byMachine.entries()]
      .sort((a, b) => b[1].phantoms - a[1].phantoms)
      .slice(0, 5),
  };
}
