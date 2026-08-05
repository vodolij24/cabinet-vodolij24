import { NextResponse } from "next/server";

import prismadb from "@/lib/prismadb";
import { assertApprovedAccess } from "@/lib/cabinet-access";
import { isWorkerRole } from "@/lib/worker-roles";

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

function serializeWorker(w: {
  id: number;
  chat_id: bigint | null;
  name: string | null;
  phone: string | null;
  role: string | null;
  active: boolean | null;
}) {
  return {
    id: w.id,
    chat_id: w.chat_id !== null ? w.chat_id.toString() : null,
    name: w.name,
    phone: w.phone,
    role: w.role,
    active: w.active,
  };
}

function parseChatId(value: unknown): bigint | null | undefined {
  if (value === null || value === "" || value === "none") {
    return null;
  }
  if (value === undefined) {
    return undefined;
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return BigInt(Math.trunc(value));
  }
  if (typeof value === "string" && /^-?\d+$/.test(value.trim())) {
    return BigInt(value.trim());
  }
  return undefined;
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ workerId: string }> }
) {
  try {
    await assertApprovedAccess();
    const { workerId } = await params;
    const id = parseInt(workerId, 10);
    if (!Number.isFinite(id)) {
      return new NextResponse("Worker id is required", { status: 400 });
    }

    const body = await req.json();
    const data: {
      name?: string;
      phone?: string | null;
      role?: string | null;
      active?: boolean;
      chat_id?: bigint | null;
    } = {};

    if (typeof body?.name === "string") {
      const name = body.name.trim();
      if (!name) {
        return new NextResponse("Name is required", { status: 400 });
      }
      data.name = name;
    }

    if ("phone" in body) {
      data.phone =
        typeof body.phone === "string" && body.phone.trim()
          ? body.phone.trim()
          : null;
    }

    if ("role" in body) {
      if (body.role === null || body.role === "" || body.role === "none") {
        data.role = null;
      } else if (isWorkerRole(body.role)) {
        data.role = body.role;
      } else {
        return new NextResponse("Invalid role", { status: 400 });
      }
    }

    if (typeof body?.active === "boolean") {
      data.active = body.active;
    }

    if ("chat_id" in body) {
      const chatId = parseChatId(body.chat_id);
      if (chatId === undefined && body.chat_id !== null) {
        return new NextResponse("Invalid chat_id", { status: 400 });
      }
      data.chat_id = chatId ?? null;

      if (data.chat_id !== null) {
        const taken = await prismadb.workers.findFirst({
          where: {
            chat_id: data.chat_id,
            NOT: { id },
          },
          select: { id: true, name: true },
        });
        if (taken) {
          return NextResponse.json(
            {
              error: "CHAT_ID_TAKEN",
              message: `Telegram ID уже привʼязано до «${taken.name || taken.id}»`,
            },
            { status: 409 }
          );
        }
      }
    }

    const worker = await prismadb.workers.update({
      where: { id },
      data,
    });

    return NextResponse.json(serializeWorker(worker));
  } catch (error) {
    const denied = accessErrorResponse(error);
    if (denied) return denied;
    console.error("[SETTINGS_WORKER_PATCH]", error);
    return new NextResponse("Internal error", { status: 500 });
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ workerId: string }> }
) {
  try {
    await assertApprovedAccess();
    const { workerId } = await params;
    const id = parseInt(workerId, 10);
    if (!Number.isFinite(id)) {
      return new NextResponse("Worker id is required", { status: 400 });
    }

    await prismadb.workers.delete({ where: { id } });
    return NextResponse.json({ id });
  } catch (error) {
    const denied = accessErrorResponse(error);
    if (denied) return denied;
    console.error("[SETTINGS_WORKER_DELETE]", error);
    return new NextResponse("Internal error", { status: 500 });
  }
}
