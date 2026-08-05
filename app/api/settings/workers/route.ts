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

export async function GET() {
  try {
    await assertApprovedAccess();
    const workers = await prismadb.workers.findMany({
      orderBy: { id: "asc" },
    });
    return NextResponse.json(workers.map(serializeWorker));
  } catch (error) {
    const denied = accessErrorResponse(error);
    if (denied) return denied;
    console.error("[SETTINGS_WORKERS_GET]", error);
    return new NextResponse("Internal error", { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    await assertApprovedAccess();
    const body = await req.json();
    const name = typeof body?.name === "string" ? body.name.trim() : "";
    const phone =
      typeof body?.phone === "string" && body.phone.trim()
        ? body.phone.trim()
        : null;
    const active = body?.active === false ? false : true;
    const roleRaw = body?.role;
    const role =
      roleRaw === null || roleRaw === "" || roleRaw === "none"
        ? null
        : isWorkerRole(roleRaw)
          ? roleRaw
          : undefined;

    if (!name) {
      return new NextResponse("Name is required", { status: 400 });
    }
    if (role === undefined && roleRaw !== undefined) {
      return new NextResponse("Invalid role", { status: 400 });
    }

    const worker = await prismadb.workers.create({
      data: {
        name,
        phone,
        role: role ?? null,
        active,
        chat_id: null,
        dialoguestatus: "",
      },
    });

    return NextResponse.json(serializeWorker(worker));
  } catch (error) {
    const denied = accessErrorResponse(error);
    if (denied) return denied;
    console.error("[SETTINGS_WORKERS_POST]", error);
    return new NextResponse("Internal error", { status: 500 });
  }
}
