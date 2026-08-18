import prismadb from "@/lib/prismadb";

/** Відкриті задачі інкасації по автоматах: deviceId → createdAt (ms). */
export async function getOpenCollectionTaskCreatedMap(
  deviceIds: number[]
): Promise<Map<number, number>> {
  const map = new Map<number, number>();
  if (deviceIds.length === 0) return map;

  const rows = await prismadb.tasks.findMany({
    where: {
      deviceId: { in: deviceIds },
      title: { startsWith: "Інкасація" },
      OR: [{ status: null }, { status: { not: "done" } }],
    },
    select: { deviceId: true, createdAt: true },
    orderBy: { createdAt: "desc" },
  });

  for (const row of rows) {
    if (row.deviceId == null || map.has(row.deviceId)) continue;
    map.set(row.deviceId, row.createdAt.getTime());
  }
  return map;
}
