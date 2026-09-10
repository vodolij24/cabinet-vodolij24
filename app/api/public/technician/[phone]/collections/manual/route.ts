import { NextResponse } from "next/server";

import { isPhoneRouteParam } from "@/lib/phone";
import { findTechnicianByPhoneDigits } from "@/lib/technician-public";
import { parseCollectionDateTime } from "@/lib/collection-fields";
import { createTechnicianManualCollection } from "@/lib/collection-lifecycle";

export const runtime = "nodejs";

export async function POST(
  req: Request,
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

    const body = await req.json();
    const deviceId = parseInt(String(body?.deviceId ?? ""), 10);
    const date =
      parseCollectionDateTime(body?.date, body?.time) ||
      (typeof body?.date === "string" && !body?.time
        ? parseCollectionDateTime(body.date, "12:00")
        : null);
    const comment = String(body?.comment ?? "");

    if (!Number.isInteger(deviceId) || deviceId <= 0) {
      return new NextResponse("Оберіть автомат", { status: 400 });
    }
    if (!date) {
      return new NextResponse("Вкажіть дату і час", { status: 400 });
    }

    const result = await createTechnicianManualCollection({
      technicianId: technician.id,
      technicianName: technician.name || `Технік #${technician.id}`,
      deviceId,
      date,
      comment,
    });
    return NextResponse.json(result);
  } catch (error) {
    const code = error instanceof Error ? error.message : "";
    if (code === "COMMENT_REQUIRED") {
      return new NextResponse("Напишіть коментар", { status: 400 });
    }
    if (code === "MACHINE_NOT_FOUND") {
      return new NextResponse("Автомат не закріплений за вами", { status: 400 });
    }
    console.error("[TECH_MANUAL_COLLECTION]", error);
    return new NextResponse("Internal error", { status: 500 });
  }
}
