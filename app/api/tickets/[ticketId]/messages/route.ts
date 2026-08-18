import { NextResponse } from "next/server";

import { assertApprovedAccess } from "@/lib/cabinet-access";
import { addTicketMessage } from "@/lib/tickets";

export const runtime = "nodejs";

function accessErrorResponse(error: unknown) {
  const message = error instanceof Error ? error.message : "";
  if (message === "UNAUTHORIZED") {
    return new NextResponse("Unauthenticated", { status: 401 });
  }
  if (message === "FORBIDDEN") {
    return new NextResponse("Forbidden", { status: 403 });
  }
  return null;
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ ticketId: string }> }
) {
  try {
    const access = await assertApprovedAccess();
    const { ticketId } = await params;
    const id = parseInt(ticketId, 10);
    if (!Number.isInteger(id) || id <= 0) {
      return new NextResponse("Ticket id is required", { status: 400 });
    }
    const body = await req.json();
    const text = typeof body?.body === "string" ? body.body : "";
    const ticket = await addTicketMessage(id, text, {
      role: "cabinet",
      name: access.name || access.email || "Кабінет",
      id: access.id,
    });
    return NextResponse.json({ ticket });
  } catch (error) {
    const code = error instanceof Error ? error.message : "";
    if (code === "BODY_REQUIRED") {
      return new NextResponse("Напишіть повідомлення", { status: 400 });
    }
    if (code === "NOT_FOUND") return new NextResponse("Not found", { status: 404 });
    if (code === "TICKET_CLOSED") {
      return new NextResponse("Звернення вже закрито", { status: 400 });
    }
    const denied = accessErrorResponse(error);
    if (denied) return denied;
    console.error("[TICKET_MESSAGE]", error);
    return new NextResponse("Internal error", { status: 500 });
  }
}
