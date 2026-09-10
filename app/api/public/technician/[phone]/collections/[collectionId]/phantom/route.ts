import { NextResponse } from "next/server";

import { isPhoneRouteParam } from "@/lib/phone";
import { findTechnicianByPhoneDigits } from "@/lib/technician-public";
import { markCollectionPhantom } from "@/lib/collection-lifecycle";

export const runtime = "nodejs";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ phone: string; collectionId: string }> }
) {
  try {
    const { phone, collectionId } = await params;
    if (!isPhoneRouteParam(phone)) {
      return new NextResponse("Not found", { status: 404 });
    }
    const technician = await findTechnicianByPhoneDigits(phone);
    if (!technician) {
      return new NextResponse("Not found", { status: 404 });
    }
    const id = parseInt(collectionId, 10);
    if (!Number.isInteger(id) || id <= 0) {
      return new NextResponse("Invalid id", { status: 400 });
    }
    const body = await req.json();
    await markCollectionPhantom({
      collectionId: id,
      technicianId: technician.id,
      technicianName: technician.name || `Технік #${technician.id}`,
      comment: String(body?.comment ?? ""),
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    const code = error instanceof Error ? error.message : "";
    if (code === "COMMENT_REQUIRED") {
      return new NextResponse("Напишіть коментар", { status: 400 });
    }
    if (code === "FORBIDDEN" || code === "NOT_ON_HAND" || code === "NOT_FOUND") {
      return new NextResponse("Не можна позначити цю інкасацію", { status: 400 });
    }
    console.error("[TECH_PHANTOM]", error);
    return new NextResponse("Internal error", { status: 500 });
  }
}
