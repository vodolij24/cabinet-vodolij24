import { NextResponse } from "next/server";

import { isPhoneRouteParam } from "@/lib/phone";
import { findTechnicianByPhoneDigits } from "@/lib/technician-public";
import { addTicketMessage, getTicketById } from "@/lib/tickets";

export const runtime = "nodejs";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ phone: string; ticketId: string }> }
) {
  try {
    const { phone, ticketId } = await params;
    if (!isPhoneRouteParam(phone)) {
      return new NextResponse("Not found", { status: 404 });
    }
    const technician = await findTechnicianByPhoneDigits(phone);
    if (!technician) return new NextResponse("Not found", { status: 404 });

    const id = parseInt(ticketId, 10);
    if (!Number.isInteger(id) || id <= 0) {
      return new NextResponse("Ticket id is required", { status: 400 });
    }
    const existing = await getTicketById(id);
    if (!existing || existing.status !== "open") {
      return new NextResponse("Not found", { status: 404 });
    }
    if (existing.technicianId !== technician.id) {
      return new NextResponse("Not found", { status: 404 });
    }

    const body = await req.json();
    const text = typeof body?.body === "string" ? body.body : "";
    const ticket = await addTicketMessage(id, text, {
      role: "technician",
      name: technician.name || `Технік #${technician.id}`,
      id: String(technician.id),
    });
    return NextResponse.json({ ticket });
  } catch (error) {
    const code = error instanceof Error ? error.message : "";
    if (code === "BODY_REQUIRED") {
      return new NextResponse("Напишіть повідомлення", { status: 400 });
    }
    if (code === "TICKET_CLOSED" || code === "FORBIDDEN") {
      return new NextResponse("Звернення недоступне", { status: 400 });
    }
    console.error("[TECH_TICKET_MESSAGE]", error);
    return new NextResponse("Internal error", { status: 500 });
  }
}
