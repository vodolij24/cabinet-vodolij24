import prismadb from "@/lib/prismadb";
import { digitsOnlyPhone } from "@/lib/phone";
import { kyivDateLabel, kyivTimeLabel } from "@/lib/kyiv-date";
import {
  closeOrphanOpenHandovers,
  listHandovers,
} from "@/lib/collection-handovers";
import { cashierMachineLabel, decimalToNumber } from "@/lib/collection-fields";
import { listTickets } from "@/lib/tickets";
import type { TicketThread } from "@/lib/ticket-types";
import { ensureCollectionMvpSchema } from "@/lib/collection-schema";
import {
  collectionStatusLabel,
  collectionStatusOrDefault,
} from "@/lib/collection-status";

export type CashierPublicHandover = {
  id: number;
  technicianId: number;
  technicianName: string;
  claimedPackages: number;
  receivedPackages: number;
  machineCount: number;
  collectionCount: number;
  createdAt: string;
  dateLabel: string;
  timeLabel: string;
  recountClosed: boolean;
};

export type CashierPublicTechnician = {
  id: number;
  name: string;
};

export type CashierPublicPackage = {
  id: number;
  machine: string;
  deviceId: number | null;
  technicianId: number | null;
  technicianName: string;
  dateLabel: string;
  timeLabel: string;
  actualReceived: number | null;
  actualCoins: number | null;
  actualBanknotes: number | null;
  recountStatus: string | null;
  status: string;
  statusLabel: string;
  handoverId: number;
  noDeviceData: boolean;
  isPhantom: boolean;
  isManual: boolean;
  canEdit: boolean;
};

export type CashierPublicPage = {
  cashier: {
    id: number;
    name: string | null;
    phoneDigits: string;
  };
  technicians: CashierPublicTechnician[];
  handovers: CashierPublicHandover[];
  packages: CashierPublicPackage[];
  tickets: TicketThread[];
  openTicketCollectionIds: number[];
};

export async function findCashierByPhoneDigits(phoneDigits: string) {
  const workers = await prismadb.workers.findMany({
    where: {
      role: "cashier",
      OR: [{ active: true }, { active: null }],
      phone: { not: null },
    },
    select: { id: true, name: true, phone: true },
  });

  return (
    workers.find((w) => digitsOnlyPhone(w.phone) === phoneDigits) || null
  );
}

export async function getCashierPublicPage(
  phoneDigits: string
): Promise<CashierPublicPage | null> {
  const cashier = await findCashierByPhoneDigits(phoneDigits);
  if (!cashier) return null;

  const [technicians, handovers, tickets] = await Promise.all([
    prismadb.workers.findMany({
      where: {
        role: "technician",
        OR: [{ active: true }, { active: null }],
      },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    (async () => {
      await ensureCollectionMvpSchema();
      await closeOrphanOpenHandovers();
      return listHandovers(cashier.id).catch((error) => {
        console.error("[CASHIER_HANDOVERS_LIST]", error);
        return [] as Awaited<ReturnType<typeof listHandovers>>;
      });
    })(),
    listTickets({
      status: "open",
      cashierId: cashier.id,
    }).catch((error) => {
      console.error("[CASHIER_TICKETS]", error);
      return [] as TicketThread[];
    }),
  ]);

  const techById = new Map(technicians.map((t) => [t.id, t.name]));
  const extraIds = [
    ...new Set(
      handovers
        .map((h) => h.technicianId)
        .filter((id) => !techById.has(id))
    ),
  ];
  if (extraIds.length > 0) {
    const extra = await prismadb.workers.findMany({
      where: { id: { in: extraIds } },
      select: { id: true, name: true },
    });
    for (const t of extra) {
      techById.set(t.id, t.name);
    }
  }

  return {
    cashier: {
      id: cashier.id,
      name: cashier.name,
      phoneDigits,
    },
    technicians: technicians.map((t) => ({
      id: t.id,
      name: t.name || `Технік #${t.id}`,
    })),
    packages: await loadCashierPackages(cashier.id, techById),
    tickets,
    openTicketCollectionIds: tickets.map((t) => t.collectionId),
    handovers: handovers.map((h) => ({
      id: h.id,
      technicianId: h.technicianId,
      technicianName: techById.get(h.technicianId) || `Технік #${h.technicianId}`,
      claimedPackages: h.claimedPackages,
      receivedPackages: h.receivedPackages,
      machineCount: h.machineCount,
      collectionCount: h.collectionCount,
      createdAt: h.createdAt.toISOString(),
      dateLabel: kyivDateLabel(h.createdAt),
      timeLabel: kyivTimeLabel(h.createdAt),
      recountClosed: h.recountClosedAt != null,
    })),
  };
}

type PackageRow = {
  id: number;
  machine: string;
  device_id: number | null;
  location: string | null;
  no_device_data: boolean | null;
  is_phantom: boolean | null;
  is_manual: boolean | null;
  date: Date;
  actualReceived: unknown;
  actual_received_coins: unknown;
  actual_received_banknotes: unknown;
  recountStatus: string | null;
  status: string | null;
  handoverId: number;
  technicianId: number | null;
  review_claimed_at: Date | null;
};

function mapPackageRows(
  rows: PackageRow[],
  techById: Map<number, string | null>
): CashierPublicPackage[] {
  return rows.map((r) => {
    const status = collectionStatusOrDefault(r.status, r.handoverId);
    const claimed = r.review_claimed_at != null;
    const canEdit =
      status !== "closed_manual" && !claimed;
    return {
      id: r.id,
      machine: cashierMachineLabel(r.device_id, r.location, r.machine),
      deviceId: r.device_id,
      technicianId: r.technicianId,
      technicianName:
        (r.technicianId != null ? techById.get(r.technicianId) : null) || "—",
      dateLabel: kyivDateLabel(r.date),
      timeLabel: kyivTimeLabel(r.date),
      actualReceived:
        r.actualReceived == null ? null : decimalToNumber(r.actualReceived),
      actualCoins:
        r.actual_received_coins == null
          ? null
          : decimalToNumber(r.actual_received_coins),
      actualBanknotes:
        r.actual_received_banknotes == null
          ? null
          : decimalToNumber(r.actual_received_banknotes),
      recountStatus: r.recountStatus,
      status,
      statusLabel: collectionStatusLabel(status),
      handoverId: r.handoverId,
      noDeviceData: Boolean(r.no_device_data),
      isPhantom: Boolean(r.is_phantom),
      isManual: Boolean(r.is_manual),
      canEdit,
    };
  });
}

const PACKAGE_SELECT = `SELECT c.id, c.machine, c.device_id, c.date,
              c."actualReceived", c.actual_received_coins, c.actual_received_banknotes,
              c."recountStatus", c.status, c."handoverId", c."technicianId",
              COALESCE(c.no_device_data, FALSE) AS no_device_data,
              COALESCE(c.is_phantom, FALSE) AS is_phantom,
              COALESCE(c.is_manual, FALSE) AS is_manual,
              c.review_claimed_at,
              COALESCE(NULLIF(TRIM(vm.location), ''), NULLIF(TRIM(vm.address), '')) AS location
       FROM collections c
       LEFT JOIN vending_machines vm ON vm.id = c.device_id`;

async function loadCashierPackages(
  cashierId: number,
  techById: Map<number, string | null>
): Promise<CashierPublicPackage[]> {
  try {
    const rows = await prismadb.$queryRawUnsafe<PackageRow[]>(
      `${PACKAGE_SELECT}
       JOIN collection_handovers h ON h.id = c."handoverId"
       WHERE h.cashier_id = ${cashierId}
         AND c.review_claimed_at IS NULL
         AND (
           COALESCE(c.status, 'handed') IN ('handed', 'accepted', 'review')
           OR (
             c.status = 'closed_auto'
             AND c.closed_at IS NOT NULL
             AND c.closed_at > NOW() - INTERVAL '2 days'
           )
         )
       ORDER BY c.device_id NULLS LAST, c.date DESC`
    );
    return mapPackageRows(rows, techById);
  } catch (error) {
    console.error("[CASHIER_PACKAGES]", error);
    return [];
  }
}

export async function loadHandoverPackagesForCashier(
  cashierId: number,
  handoverId: number
): Promise<CashierPublicPackage[] | null> {
  if (
    !Number.isInteger(cashierId) ||
    cashierId <= 0 ||
    !Number.isInteger(handoverId) ||
    handoverId <= 0
  ) {
    return null;
  }

  await ensureCollectionMvpSchema();

  const owned = await prismadb.$queryRawUnsafe<Array<{ id: number }>>(
    `SELECT id FROM collection_handovers
     WHERE id = ${handoverId} AND cashier_id = ${cashierId}
     LIMIT 1`
  );
  if (!owned[0]) return null;

  const rows = await prismadb.$queryRawUnsafe<PackageRow[]>(
    `${PACKAGE_SELECT}
     WHERE c."handoverId" = ${handoverId}
     ORDER BY c.device_id NULLS LAST, c.date DESC`
  );

  const extraIds = [
    ...new Set(
      rows
        .map((r) => r.technicianId)
        .filter((id): id is number => id != null)
    ),
  ];
  const techById = new Map<number, string | null>();
  if (extraIds.length > 0) {
    const extra = await prismadb.workers.findMany({
      where: { id: { in: extraIds } },
      select: { id: true, name: true },
    });
    for (const t of extra) {
      techById.set(t.id, t.name);
    }
  }

  return mapPackageRows(rows, techById);
}
