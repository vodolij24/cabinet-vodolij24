import { NextResponse } from "next/server";

import prismadb from "@/lib/prismadb";
import { assertApprovedAccess } from "@/lib/cabinet-access";
import { listMachineTechnicianHistory } from "@/lib/machine-technician-history";

function accessErrorResponse(error: unknown) {
  const message = error instanceof Error ? error.message : "";
  if (message === "UNAUTHORIZED") {
    return new NextResponse("Unauthenticated", { status: 401 });
  }
  if (message === "FORBIDDEN") {
    return new NextResponse("Forbidden", { status: 403 });
  }
  return null;
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ machineId: string }> }
) {
  try {
    await assertApprovedAccess();
    const { machineId } = await params;
    const id = parseInt(machineId, 10);
    if (!Number.isFinite(id)) {
      return new NextResponse("Machine id is required", { status: 400 });
    }

    const machine = await prismadb.vending_machines.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!machine) {
      return new NextResponse("Not found", { status: 404 });
    }

    const rows = await listMachineTechnicianHistory(id);
    return NextResponse.json({
      assignments: rows.map((row) => ({
        id: row.id,
        technicianId: row.technicianId,
        technicianName: row.technicianName,
        startedAt: row.startedAt.toISOString(),
      })),
    });
  } catch (error) {
    const denied = accessErrorResponse(error);
    if (denied) return denied;
    console.error("[MACHINE_TECHNICIANS_GET]", error);
    return new NextResponse("Internal error", { status: 500 });
  }
}
