import { NextResponse } from "next/server";

import prismadb from "@/lib/prismadb";
import { ensureWorkerFromStaffBot } from "@/lib/staff-bot-sync";

function unauthorized() {
  return new NextResponse("Unauthorized", { status: 401 });
}

function parseChatId(value: unknown): bigint | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return BigInt(Math.trunc(value));
  }
  if (typeof value === "string" && /^-?\d+$/.test(value.trim())) {
    return BigInt(value.trim());
  }
  if (typeof value === "bigint") {
    return value;
  }
  return null;
}

/** Другий (staff) бот: upsert StaffBotUser + worker після /start */
export async function POST(req: Request) {
  try {
    const secret = process.env.STAFF_BOT_SECRET;
    if (!secret) {
      console.error("[STAFF_BOT_START] STAFF_BOT_SECRET is not set");
      return new NextResponse("Server misconfigured", { status: 500 });
    }

    const auth = req.headers.get("authorization") || "";
    const headerSecret = req.headers.get("x-staff-bot-secret") || "";
    const bearer = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
    if (bearer !== secret && headerSecret !== secret) {
      return unauthorized();
    }

    const body = await req.json();
    const chatId = parseChatId(body?.chat_id);
    if (chatId === null) {
      return new NextResponse("chat_id is required", { status: 400 });
    }

    const username =
      typeof body?.username === "string" ? body.username.slice(0, 255) : null;
    const firstName =
      typeof body?.firstName === "string"
        ? body.firstName.slice(0, 255)
        : typeof body?.first_name === "string"
          ? body.first_name.slice(0, 255)
          : null;
    const lastName =
      typeof body?.lastName === "string"
        ? body.lastName.slice(0, 255)
        : typeof body?.last_name === "string"
          ? body.last_name.slice(0, 255)
          : null;

    const user = await prismadb.staffBotUser.upsert({
      where: { chat_id: chatId },
      create: {
        chat_id: chatId,
        username,
        firstName,
        lastName,
      },
      update: {
        username: username ?? undefined,
        firstName: firstName ?? undefined,
        lastName: lastName ?? undefined,
      },
    });

    const worker = await ensureWorkerFromStaffBot({
      chatId,
      username: user.username,
      firstName: user.firstName,
      lastName: user.lastName,
    });

    return NextResponse.json({
      id: user.id,
      chat_id: user.chat_id.toString(),
      username: user.username,
      firstName: user.firstName,
      lastName: user.lastName,
      workerId: worker.id,
    });
  } catch (error) {
    console.error("[STAFF_BOT_START]", error);
    return new NextResponse("Internal error", { status: 500 });
  }
}
