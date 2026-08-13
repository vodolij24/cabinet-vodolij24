import prismadb from "@/lib/prismadb";
import { requireApprovedAccess } from "@/lib/cabinet-access";
import { recountAlert } from "@/lib/collection-alert";
import { decimalToNumber, machineLabel } from "@/lib/collection-fields";
import { kyivDateLabel, kyivTimeLabel } from "@/lib/kyiv-date";

import { CollectionColumn } from "./components/columns";
import { CollectionsClient } from "./components/client";

export const dynamic = "force-dynamic";

function money(n: number) {
  return `${n.toLocaleString("uk-UA", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} грн`;
}

export default async function CollectionsPage() {
  await requireApprovedAccess();

  const [rows, machines, technicianWorkers, cashiers] = await Promise.all([
    prismadb.collections.findMany({
      orderBy: { date: "desc" },
    }),
    prismadb.vending_machines.findMany({
      select: {
        id: true,
        name: true,
        location: true,
        technicianId: true,
        technicianWorker: { select: { id: true, name: true } },
      },
    }),
    prismadb.workers.findMany({
      where: {
        role: "technician",
        OR: [{ active: true }, { active: null }],
      },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prismadb.workers.findMany({
      where: { role: "cashier" },
      select: { id: true, name: true },
    }),
  ]);

  const machineById = new Map(machines.map((m) => [m.id, m]));
  const workerById = new Map(technicianWorkers.map((w) => [w.id, w]));

  const cashierById = new Map(cashiers.map((w) => [w.id, w.name]));

  const extras = new Map<
    number,
    {
      handoverId: number | null;
      cashierId: number | null;
      handoverAt: Date | null;
      claimedPackages: number;
      receivedPackages: number;
      actualReceived: number | null;
      recountStatus: string | null;
      recountClosed: boolean;
    }
  >();
  try {
    const extraRows = await prismadb.$queryRawUnsafe<
      Array<{
        id: number;
        handoverId: number | null;
        actualReceived: unknown;
        recountStatus: string | null;
        recount_closed_at: Date | null;
        cashier_id: number | null;
        handover_at: Date | null;
        claimed_packages: number | null;
        received_packages: number | null;
      }>
    >(
      `SELECT c.id, c."handoverId", c."actualReceived", c."recountStatus",
              h.recount_closed_at, h.cashier_id, h.created_at AS handover_at,
              h.claimed_packages, h.received_packages
       FROM collections c
       LEFT JOIN collection_handovers h ON h.id = c."handoverId"`
    );
    for (const row of extraRows) {
      extras.set(row.id, {
        handoverId: row.handoverId,
        cashierId: row.cashier_id,
        handoverAt: row.handover_at,
        claimedPackages: row.claimed_packages ?? 0,
        receivedPackages: row.received_packages ?? 0,
        actualReceived:
          row.actualReceived == null
            ? null
            : decimalToNumber(row.actualReceived),
        recountStatus: row.recountStatus,
        recountClosed: Boolean(row.recount_closed_at),
      });
    }
  } catch (error) {
    console.error("[COLLECTIONS_EXTRAS]", error);
  }

  const formatted: CollectionColumn[] = rows.map((item) => {
    const machine = item.device_id
      ? machineById.get(item.device_id)
      : undefined;
    const machineName = machine
      ? machineLabel(machine)
      : item.machine || "—";
    const technicianId =
      item.technicianId ?? machine?.technicianId ?? null;
    const technicianName =
      (technicianId != null ? workerById.get(technicianId)?.name : null) ||
      machine?.technicianWorker?.name ||
      "—";
    const sumCoins = decimalToNumber(item.sum_coins);
    const sumBanknotes = decimalToNumber(item.sum_banknotes);
    const total = decimalToNumber(item.total_sum) || sumCoins + sumBanknotes;
    const extra = extras.get(item.id);
    const handedOver = extra?.handoverId != null;
    const actualReceived =
      extra?.recountStatus === "missing" ? null : extra?.actualReceived ?? null;
    const difference =
      extra?.recountStatus === "missing"
        ? total
        : actualReceived == null
          ? null
          : Math.round((total - actualReceived) * 100) / 100;
    const cashierName =
      extra?.cashierId != null
        ? cashierById.get(extra.cashierId) || `Касир #${extra.cashierId}`
        : "";
    const alert = recountAlert({
      handedOver,
      recountStatus: extra?.recountStatus ?? null,
      difference,
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
      handoverId: extra?.handoverId ?? null,
      handoverDate: extra?.handoverAt ? kyivDateLabel(extra.handoverAt) : "",
      handoverTime: extra?.handoverAt ? kyivTimeLabel(extra.handoverAt) : "",
      handoverDateMs: extra?.handoverAt?.getTime() ?? 0,
      claimedPackages: extra?.claimedPackages ?? 0,
      receivedPackages: extra?.receivedPackages ?? 0,
      recountStatus: extra?.recountStatus ?? null,
      recountClosed: extra?.recountClosed ?? false,
      actualReceived,
      actualReceivedLabel:
        extra?.recountStatus === "missing"
          ? "Відсутній"
          : actualReceived == null
            ? "—"
            : money(actualReceived),
      difference,
      differenceLabel: difference == null ? "—" : money(difference),
      alert,
      search: `${machineName} ${technicianName} ${cashierName} ${item.id}`,
    };
  });

  return (
    <div className="flex-col">
      <div className="flex-1 space-y-4 p-8 pt-6">
        <CollectionsClient
          data={formatted}
          technicians={technicianWorkers.map((w) => ({
            id: w.id,
            name: w.name || `Технік #${w.id}`,
          }))}
        />
      </div>
    </div>
  );
}
