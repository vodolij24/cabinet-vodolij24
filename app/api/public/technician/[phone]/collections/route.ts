import { NextResponse } from "next/server";

import { isPhoneRouteParam } from "@/lib/phone";
import prismadb from "@/lib/prismadb";
import {
  findTechnicianByPhoneDigits,
  getTechnicianUnhandedCollections,
} from "@/lib/technician-public";

export const runtime = "nodejs";

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
    });

    const collections = await getTechnicianUnhandedCollections(
      technician.id,
      machines.map((m) => m.id)
    );

    return NextResponse.json({ collections });
  } catch (error) {
    console.error("[TECHNICIAN_COLLECTIONS_GET]", error);
    return new NextResponse("Internal error", { status: 500 });
  }
}
