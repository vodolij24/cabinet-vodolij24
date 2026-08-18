import { NextResponse } from "next/server";

import { isPhoneRouteParam } from "@/lib/phone";
import { findManagerByPhoneDigits } from "@/lib/manager-public";
import { closeTicket, getTicketById } from "@/lib/tickets";

export const runtime = "nodejs";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ phone: string; ticketId: string }> }
) {
  try {
    const { phone, ticketId } = await params;
    if (!isPhoneRouteParam(phone)) {
      return new NextResponse("Not found", { status: 404 });
    }
    const manager = await findManagerByPhoneDigits(phone);
    if (!manager) return new NextResponse("Not found", { status: 404 });

    const id = parseInt(ticketId, 10);
    if (!Number.isInteger(id) || id <= 0) {
      return new NextResponse("Ticket id is required", { status: 400 });
    }
    const existing = await getTicketById(id);
    if (!existing || existing.status !== "open") {
      return new NextResponse("Not found", { status: 404 });
    }

    const ticket = await closeTicket(
      id,
      manager.name || `Керівник #${manager.id}`
    );
    return NextResponse.json({ ticket });
  } catch (error) {
    console.error("[MANAGER_TICKET_CLOSE]", error);
    return new NextResponse("Internal error", { status: 500 });
  }
}
