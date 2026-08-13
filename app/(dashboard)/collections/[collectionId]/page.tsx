import { notFound } from "next/navigation";

import prismadb from "@/lib/prismadb";
import { requireApprovedAccess } from "@/lib/cabinet-access";
import { decimalToNumber } from "@/lib/collection-fields";
import {
  kyivDateInputValue,
  kyivTimeInputValue,
} from "@/lib/kyiv-date";

import { CollectionForm } from "./components/collection-form";

export const dynamic = "force-dynamic";

export default async function CollectionPage({
  params,
}: {
  params: Promise<{ collectionId: string }>;
}) {
  await requireApprovedAccess();
  const { collectionId } = await params;
  const isNew = collectionId === "new";
  const id = isNew ? 0 : Number(collectionId);

  if (!isNew && (!Number.isFinite(id) || id <= 0)) {
    notFound();
  }

  const [row, machines] = await Promise.all([
    isNew
      ? Promise.resolve(null)
      : prismadb.collections.findUnique({ where: { id } }),
    prismadb.vending_machines.findMany({
      orderBy: { id: "asc" },
      select: {
        id: true,
        name: true,
        location: true,
        technicianId: true,
        technicianWorker: { select: { name: true } },
      },
    }),
  ]);

  if (!isNew && !row) {
    notFound();
  }

  const initialData = row
    ? {
        id: row.id,
        deviceId: row.device_id,
        date: kyivDateInputValue(row.date),
        time: kyivTimeInputValue(row.date),
        countCoins: row.count_coins ?? 0,
        sumCoins: decimalToNumber(row.sum_coins),
        countBanknotes: row.count_banknotes ?? 0,
        sumBanknotes: decimalToNumber(row.sum_banknotes),
        note: row.note,
      }
    : null;

  return (
    <div className="flex-col">
      <div className="flex-1 space-y-4 p-8 pt-6">
        <CollectionForm
          initialData={initialData}
          machines={machines.map((m) => ({
            id: m.id,
            name: m.name,
            location: m.location,
            technicianId: m.technicianId,
            technicianName: m.technicianWorker?.name ?? null,
          }))}
        />
      </div>
    </div>
  );
}
