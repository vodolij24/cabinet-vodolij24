import { NextResponse } from "next/server";

import { isPhoneRouteParam } from "@/lib/phone";
import { findCashierByPhoneDigits } from "@/lib/cashier-public";
import { parseCount } from "@/lib/collection-fields";
import {
  createHandover,
  getPendingHandoverStats,
} from "@/lib/collection-handovers";
import prismadb from "@/lib/prismadb";

export const runtime = "nodejs";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ phone: string }> }
) {
  try {
    const { phone } = await params;
    if (!isPhoneRouteParam(phone)) {
      return new NextResponse("Not found", { status: 404 });
    }
    const cashier = await findCashierByPhoneDigits(phone);
    if (!cashier) {
      return new NextResponse("Not found", { status: 404 });
    }

    const technicianId = parseInt(
      new URL(req.url).searchParams.get("technicianId") || "",
      10
    );
    if (!Number.isFinite(technicianId) || technicianId <= 0) {
      return new NextResponse("Оберіть техніка", { status: 400 });
    }

    const technician = await prismadb.workers.findFirst({
      where: {
        id: technicianId,
        role: "technician",
        OR: [{ active: true }, { active: null }],
      },
      select: { id: true },
    });
    if (!technician) {
      return new NextResponse("Техніка не знайдено", { status: 400 });
    }

    const pending = await getPendingHandoverStats(technicianId);
    return NextResponse.json({ pending });
  } catch (error) {
    console.error("[CASHIER_HANDOVER_PREVIEW]", error);
    return new NextResponse("Internal error", { status: 500 });
  }
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ phone: string }> }
) {
  try {
    const { phone } = await params;
    if (!isPhoneRouteParam(phone)) {
      return new NextResponse("Not found", { status: 404 });
    }
    const cashier = await findCashierByPhoneDigits(phone);
    if (!cashier) {
      return new NextResponse("Not found", { status: 404 });
    }

    const body = await req.json();
    const technicianId = parseInt(String(body?.technicianId ?? ""), 10);
    const claimedPackages = parseCount(body?.claimedPackages);
    const receivedPackages = parseCount(body?.receivedPackages);

    if (!Number.isFinite(technicianId) || technicianId <= 0) {
      return new NextResponse("Оберіть техніка", { status: 400 });
    }
    if (claimedPackages == null || receivedPackages == null) {
      return new NextResponse("Вкажіть кількість пакетів", { status: 400 });
    }

    const technician = await prismadb.workers.findFirst({
      where: {
        id: technicianId,
        role: "technician",
        OR: [{ active: true }, { active: null }],
      },
      select: { id: true },
    });
    if (!technician) {
      return new NextResponse("Техніка не знайдено", { status: 400 });
    }

    const handover = await createHandover({
      technicianId,
      cashierId: cashier.id,
      claimedPackages,
      receivedPackages,
    });

    return NextResponse.json({ handover });
  } catch (error) {
    console.error("[CASHIER_HANDOVER_POST]", error);
    return new NextResponse("Internal error", { status: 500 });
  }
}
