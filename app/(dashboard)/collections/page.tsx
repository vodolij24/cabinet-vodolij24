import prismadb from "@/lib/prismadb";
import { requireApprovedAccess } from "@/lib/cabinet-access";
import {
  countOnHandOverdue,
  listOnHandOverdue,
  listReviewQueue,
} from "@/lib/collection-lifecycle";
import { ensureCollectionMvpSchema } from "@/lib/collection-schema";

import { CollectionsClient } from "./components/client";

export const dynamic = "force-dynamic";

export default async function CollectionsPage() {
  await requireApprovedAccess();
  await ensureCollectionMvpSchema();

  const [technicianWorkers, reviewQueue, overdue, overdueTotal] =
    await Promise.all([
      prismadb.workers.findMany({
        where: {
          role: "technician",
          OR: [{ active: true }, { active: null }],
        },
        orderBy: { name: "asc" },
        select: { id: true, name: true },
      }),
      listReviewQueue({ includeThreads: false }).catch((error) => {
        console.error("[REVIEW_QUEUE]", error);
        return [];
      }),
      listOnHandOverdue(7, 8).catch((error) => {
        console.error("[ANTIFRAUD_OVERDUE]", error);
        return [];
      }),
      countOnHandOverdue(7).catch((error) => {
        console.error("[ANTIFRAUD_COUNT]", error);
        return 0;
      }),
    ]);

  return (
    <div className="flex-col">
      <div className="flex-1 space-y-4 p-8 pt-6">
        <CollectionsClient
          technicians={technicianWorkers.map((w) => ({
            id: w.id,
            name: w.name || `Технік #${w.id}`,
          }))}
          reviewQueue={reviewQueue}
          overdue={overdue}
          overdueTotal={overdueTotal}
        />
      </div>
    </div>
  );
}
