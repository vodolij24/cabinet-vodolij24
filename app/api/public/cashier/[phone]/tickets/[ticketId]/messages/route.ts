import { NextResponse } from "next/server";

import { isPhoneRouteParam } from "@/lib/phone";
import { findCashierByPhoneDigits } from "@/lib/cashier-public";
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
    const cashier = await findCashierByPhoneDigits(phone);
    if (!cashier) return new NextResponse("Not found", { status: 404 });

    const id = parseInt(ticketId, 10);
    if (!Number.isInteger(id) || id <= 0) {
      return new NextResponse("Ticket id is required", { status: 400 });
    }
    const existing = await getTicketById(id);
    if (!existing || existing.status !== "open") {
      return new NextResponse("Not found", { status: 404 });
    }
    if (existing.cashierId !== cashier.id) {
      return new NextResponse("Not found", { status: 404 });
    }

    const body = await req.json();
    const text = typeof body?.body === "string" ? body.body : "";
    const ticket = await addTicketMessage(id, text, {
      role: "cashier",
      name: cashier.name || `Касир #${cashier.id}`,
      id: String(cashier.id),
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
    console.error("[CASHIER_TICKET_MESSAGE]", error);
    return new NextResponse("Internal error", { status: 500 });
  }
}
