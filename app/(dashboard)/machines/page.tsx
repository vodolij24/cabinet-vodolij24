import { Heading } from "@/components/ui/heading";
import { Separator } from "@/components/ui/separator";
import prismadb from "@/lib/prismadb";
import { requireApprovedAccess } from "@/lib/cabinet-access";
import { MachinesClient } from "./components/machines-client";

export const dynamic = "force-dynamic";

export default async function MachinesPage() {
  await requireApprovedAccess();

  const [machines, technicianWorkers] = await Promise.all([
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
  ]);

  const rows = machines.map((m) => ({
    id: m.id,
    name: m.name,
    location: m.location,
    technicianId: m.technicianId,
    technicianName: m.technicianWorker?.name ?? null,
    status: m.status,
  }));

  const technicians = technicianWorkers.map((w) => ({
    id: w.id,
    name: w.phone ? `${w.name || "Без імені"} · ${w.phone}` : w.name || `Технік #${w.id}`,
  }));

  return (
    <div className="flex-col">
      <div className="flex-1 space-y-4 p-8 pt-6">
        <Heading
          title="Облік автоматів"
          description="Локація з Soliton. Назву вводьте вручну; техніка обирайте з користувачів бота з роллю «Технік»."
        />
        <Separator />
        <MachinesClient machines={rows} technicians={technicians} />
      </div>
    </div>
  );
}
