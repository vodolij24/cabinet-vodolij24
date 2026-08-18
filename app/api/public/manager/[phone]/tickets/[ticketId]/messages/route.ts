import { NextResponse } from "next/server";

import { isPhoneRouteParam } from "@/lib/phone";
import { findManagerByPhoneDigits } from "@/lib/manager-public";
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

    const body = await req.json();
    const text = typeof body?.body === "string" ? body.body : "";
    const ticket = await addTicketMessage(id, text, {
      role: "manager",
      name: manager.name || `Керівник #${manager.id}`,
      id: String(manager.id),
    });
    return NextResponse.json({ ticket });
  } catch (error) {
    const code = error instanceof Error ? error.message : "";
    if (code === "BODY_REQUIRED") {
      return new NextResponse("Напишіть повідомлення", { status: 400 });
    }
    if (code === "TICKET_CLOSED") {
      return new NextResponse("Звернення вже закрито", { status: 400 });
    }
    console.error("[MANAGER_TICKET_MESSAGE]", error);
    return new NextResponse("Internal error", { status: 500 });
  }
}
