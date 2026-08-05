import prismadb from "@/lib/prismadb";

/** Перевіряє, що id — активний worker з роллю technician */
export async function findTechnicianWorker(id: number) {
  return prismadb.workers.findFirst({
    where: {
      id,
      role: "technician",
      OR: [{ active: true }, { active: null }],
    },
    select: { id: true, name: true },
  });
}
