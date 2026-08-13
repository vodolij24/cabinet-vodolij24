import { NextResponse } from "next/server";

import { isPhoneRouteParam } from "@/lib/phone";
import { findTechnicianByPhoneDigits } from "@/lib/technician-public";
import prismadb from "@/lib/prismadb";
import { fetchSensorsForDevices } from "@/lib/soliton-sensors";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ phone: string }> }
) {
  try {
    const { phone } = await params;
    if (!isPhoneRouteParam(phone)) {
      return new NextResponse("Not found", { status: 404 });
    }

    const technician = await findTechnicianByPhoneDigits(phone);
    if (!technician) {
      return new NextResponse("Not found", { status: 404 });
    }

    const machines = await prismadb.vending_machines.findMany({
      where: { technicianId: technician.id },
      select: { id: true },
      orderBy: { id: "asc" },
    });

    const sensors = await fetchSensorsForDevices(machines.map((m) => m.id));
    const payload: Record<string, unknown> = {};
    for (const [id, list] of sensors) {
      payload[String(id)] = list;
    }

    return NextResponse.json({ sensors: payload });
  } catch (error) {
    console.error("[TECHNICIAN_SENSORS_GET]", error);
    return new NextResponse("Internal error", { status: 500 });
  }
}
