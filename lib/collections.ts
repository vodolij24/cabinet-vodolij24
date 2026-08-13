import prismadb from "@/lib/prismadb";
import { machineLabel } from "@/lib/collection-fields";

export {
  parseMoney,
  parseCount,
  decimalToNumber,
  machineLabel,
  parseCollectionDateTime,
} from "@/lib/collection-fields";

export async function resolveCollectionTechnician(deviceId: number) {
  const machine = await prismadb.vending_machines.findUnique({
    where: { id: deviceId },
    select: {
      id: true,
      name: true,
      location: true,
      technicianId: true,
      technicianWorker: { select: { id: true, name: true } },
    },
  });

  if (!machine) {
    return { error: "Автомат не знайдено" as const, machine: null };
  }
  if (!machine.technicianId) {
    return {
      error: "У автомата немає відповідального техніка" as const,
      machine,
    };
  }

  return { error: null, machine };
}
