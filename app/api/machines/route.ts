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

export async function GET() {
  try {
    await assertApprovedAccess();
    const machines = await prismadb.vending_machines.findMany({
      orderBy: { id: "asc" },
      include: includeTech,
    });
    return NextResponse.json(machines.map(serialize));
  } catch (error) {
    const denied = accessErrorResponse(error);
    if (denied) return denied;
    console.error("[MACHINES_GET]", error);
    return new NextResponse("Internal error", { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    await assertApprovedAccess();
    const body = await req.json();

    const name =
      typeof body?.name === "string" && body.name.trim()
        ? body.name.trim()
        : null;
    const location =
      typeof body?.location === "string" ? body.location.trim() : "";
    const technicianId =
      body?.technicianId === null ||
      body?.technicianId === "" ||
      body?.technicianId === "none"
        ? null
        : parseInt(String(body?.technicianId), 10);

    if (!location) {
      return new NextResponse("Location is required", { status: 400 });
    }

    if (
      technicianId !== null &&
      (!Number.isFinite(technicianId) || technicianId <= 0)
    ) {
      return new NextResponse("Invalid technicianId", { status: 400 });
    }

    const explicitId =
      body?.id !== undefined && body?.id !== null && body?.id !== ""
        ? parseInt(String(body.id), 10)
        : null;

    if (explicitId !== null) {
      if (!Number.isFinite(explicitId) || explicitId <= 0) {
        return new NextResponse("Invalid id", { status: 400 });
      }
      const exists = await prismadb.vending_machines.findUnique({
        where: { id: explicitId },
      });
      if (exists) {
        return new NextResponse("Machine id already exists", { status: 409 });
      }
    }

    if (technicianId !== null) {
      const tech = await findTechnicianWorker(technicianId);
      if (!tech) {
        return new NextResponse(
          "Technician not found (потрібен користувач бота з роллю Технік)",
          { status: 400 }
        );
      }
    }

    const machine = await prismadb.vending_machines.create({
      data: {
        ...(explicitId !== null ? { id: explicitId } : {}),
        name,
        address: null,
        location,
        technicianId,
        updatedAt: new Date(),
      },
      include: includeTech,
    });

    return NextResponse.json(serialize(machine));
  } catch (error) {
    const denied = accessErrorResponse(error);
    if (denied) return denied;
    console.error("[MACHINES_POST]", error);
    return new NextResponse("Internal error", { status: 500 });
  }
}
