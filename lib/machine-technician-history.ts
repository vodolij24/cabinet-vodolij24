import prismadb from "@/lib/prismadb";

export type MachineTechnicianHistoryRow = {
  id: number;
  technicianId: number | null;
  technicianName: string | null;
  startedAt: Date;
};

type AssignmentWrite = {
  machineId: number;
  technicianId: number | null;
  technicianName: string | null;
  startedAt?: Date;
};

type AssignmentDb = {
  machineTechnicianAssignment: {
    create: (args: {
      data: {
        machineId: number;
        technicianId: number | null;
        technicianName: string | null;
        startedAt: Date;
      };
    }) => Promise<unknown>;
    createMany: (args: {
      data: {
        machineId: number;
        technicianId: number | null;
        technicianName: string | null;
        startedAt: Date;
      }[];
    }) => Promise<unknown>;
  };
};

let historyReady = false;
let historyPromise: Promise<void> | null = null;

async function applyMachineTechnicianHistorySchema() {
  await prismadb.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS machine_technician_assignments (
      id SERIAL PRIMARY KEY,
      machine_id INTEGER NOT NULL,
      technician_id INTEGER,
      technician_name VARCHAR(255),
      started_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await prismadb.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS machine_technician_assignments_machine_id_started_at_idx
      ON machine_technician_assignments (machine_id, started_at)
  `);
  await prismadb.$executeRawUnsafe(`
    INSERT INTO machine_technician_assignments (
      machine_id, technician_id, technician_name, started_at
    )
    SELECT vm.id, vm."technicianId", w.name, COALESCE(vm."createdAt", NOW())
    FROM vending_machines vm
    LEFT JOIN workers w ON w.id = vm."technicianId"
    WHERE NOT EXISTS (
      SELECT 1
      FROM machine_technician_assignments a
      WHERE a.machine_id = vm.id
    )
  `);
}

/** Створює журнал і дописує поточне призначення автоматам, у яких ще немає жодного рядка. */
export async function ensureMachineTechnicianHistory() {
  if (historyReady) return;
  if (!historyPromise) {
    historyPromise = applyMachineTechnicianHistorySchema()
      .then(() => {
        historyReady = true;
      })
      .catch((error) => {
        historyPromise = null;
        throw error;
      });
  }
  await historyPromise;
}

export async function recordMachineTechnicianAssignment(
  db: AssignmentDb,
  input: AssignmentWrite
) {
  await ensureMachineTechnicianHistory();
  await db.machineTechnicianAssignment.create({
    data: {
      machineId: input.machineId,
      technicianId: input.technicianId,
      technicianName: input.technicianName,
      startedAt: input.startedAt ?? new Date(),
    },
  });
}

export async function recordMachineTechniciansCleared(
  db: AssignmentDb,
  machineIds: number[],
  startedAt = new Date()
) {
  if (machineIds.length === 0) return;
  await ensureMachineTechnicianHistory();
  await db.machineTechnicianAssignment.createMany({
    data: machineIds.map((machineId) => ({
      machineId,
      technicianId: null,
      technicianName: null,
      startedAt,
    })),
  });
}

export async function listMachineTechnicianHistory(
  machineId: number
): Promise<MachineTechnicianHistoryRow[]> {
  await ensureMachineTechnicianHistory();
  return prismadb.machineTechnicianAssignment.findMany({
    where: { machineId },
    orderBy: { startedAt: "desc" },
    select: {
      id: true,
      technicianId: true,
      technicianName: true,
      startedAt: true,
    },
  });
}
