import { NextResponse } from "next/server";

import { assertApprovedAccess } from "@/lib/cabinet-access";
import {
  createTicketFromCollection,
  listTickets,
} from "@/lib/tickets";

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

export async function GET(req: Request) {
  try {
    await assertApprovedAccess();
    const status = new URL(req.url).searchParams.get("status");
    const data = await listTickets({
      status:
        status === "open" || status === "closed" || status === "all"
          ? status
          : "all",
    });
    return NextResponse.json({ tickets: data });
  } catch (error) {
    const denied = accessErrorResponse(error);
    if (denied) return denied;
    console.error("[TICKETS_GET]", error);
    return new NextResponse("Internal error", { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const access = await assertApprovedAccess();
    const body = await req.json();
    const collectionId = parseInt(String(body?.collectionId ?? ""), 10);
    const text = typeof body?.body === "string" ? body.body : "";
    if (!Number.isInteger(collectionId) || collectionId <= 0) {
      return new NextResponse("Вкажіть інкасацію", { status: 400 });
    }
    const ticket = await createTicketFromCollection({
      collectionId,
      body: text,
      author: {
        role: "cabinet",
        name: access.name || access.email || "Кабінет",
        id: access.id,
      },
    });
    return NextResponse.json({ ticket });
  } catch (error) {
    const code = error instanceof Error ? error.message : "";
    if (code === "BODY_REQUIRED") {
      return new NextResponse("Напишіть текст звернення", { status: 400 });
    }
    if (code === "NOT_FOUND") return new NextResponse("Not found", { status: 404 });
    if (code === "NOT_HANDED") {
      return new NextResponse("Інкасацію ще не здано касиру", { status: 400 });
    }
    if (code === "NOT_CLOSED") {
      return new NextResponse("Звернення можна відкрити після закриття перерахунку", {
        status: 400,
      });
    }
    const denied = accessErrorResponse(error);
    if (denied) return denied;
    console.error("[TICKETS_POST]", error);
    return new NextResponse("Internal error", { status: 500 });
  }
}
