import { NextResponse } from "next/server";

import { isPhoneRouteParam } from "@/lib/phone";
import { findManagerByPhoneDigits } from "@/lib/manager-public";
import { ackMissingEvent } from "@/lib/collection-recount";

export const runtime = "nodejs";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ phone: string; eventId: string }> }
) {
  try {
    const { phone, eventId } = await params;
    if (!isPhoneRouteParam(phone)) {
      return new NextResponse("Not found", { status: 404 });
    }
    const manager = await findManagerByPhoneDigits(phone);
    if (!manager) {
      return new NextResponse("Not found", { status: 404 });
    }

    const id = parseInt(eventId, 10);
    if (!Number.isInteger(id) || id <= 0) {
      return new NextResponse("Event id is required", { status: 400 });
    }

    await ackMissingEvent(id, manager.id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[MANAGER_MISSING_ACK]", error);
    return new NextResponse("Internal error", { status: 500 });
  }
}
