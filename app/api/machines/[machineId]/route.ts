import { NextResponse } from "next/server";

import prismadb from "@/lib/prismadb";
import { assertApprovedAccess } from "@/lib/cabinet-access";
import { findTechnicianWorker } from "@/lib/machine-technician";

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

function serialize(m: {
  id: number;
  name: string | null;
  location: string;
  technicianId: number | null;
  status: string | null;
  technicianWorker?: { id: number; name: string | null } | null;
}) {
  return {
    id: m.id,
    name: m.name,
    location: m.location,
    technicianId: m.technicianId,
    technicianName: m.technicianWorker?.name ?? null,
    status: m.status,
  };
}

const includeTech = {
  technicianWorker: { select: { id: true, name: true } },
} as const;

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ machineId: string }> }
) {
  try {
    await assertApprovedAccess();
    const { machineId } = await params;
    const id = parseInt(machineId, 10);
    if (!Number.isFinite(id)) {
      return new NextResponse("Machine id is required", { status: 400 });
    }

    const body = await req.json();
    const data: {
      name?: string | null;
      location?: string;
      technicianId?: number | null;
      updatedAt: Date;
    } = { updatedAt: new Date() };

    if ("name" in body) {
      data.name =
        typeof body.name === "string" && body.name.trim()
          ? body.name.trim()
          : null;
    }
    if ("location" in body) {
      const location =
        typeof body.location === "string" ? body.location.trim() : "";
      if (!location) {
        return new NextResponse("Location is required", { status: 400 });
      }
      data.location = location;
    }
    if ("technicianId" in body) {
      if (
        body.technicianId === null ||
        body.technicianId === "" ||
        body.technicianId === "none"
      ) {
        data.technicianId = null;
      } else {
        const technicianId = parseInt(String(body.technicianId), 10);
        if (!Number.isFinite(technicianId) || technicianId <= 0) {
          return new NextResponse("Invalid technicianId", { status: 400 });
        }
        const tech = await findTechnicianWorker(technicianId);
        if (!tech) {
          return new NextResponse(
            "Technician not found (потрібен користувач бота з роллю Технік)",
            { status: 400 }
          );
        }
        data.technicianId = technicianId;
      }
    }

    const machine = await prismadb.vending_machines.update({
      where: { id },
      data,
      include: includeTech,
    });

    return NextResponse.json(serialize(machine));
  } catch (error) {
    const denied = accessErrorResponse(error);
    if (denied) return denied;
    console.error("[MACHINE_PATCH]", error);
    return new NextResponse("Internal error", { status: 500 });
  }
}

export async function DELETE(
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

    await prismadb.vending_machines.delete({ where: { id } });
    return NextResponse.json({ id });
  } catch (error) {
    const denied = accessErrorResponse(error);
    if (denied) return denied;
    console.error("[MACHINE_DELETE]", error);
    return new NextResponse("Internal error", { status: 500 });
  }
}
