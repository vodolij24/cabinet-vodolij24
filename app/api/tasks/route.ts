import { NextResponse } from "next/server";

import prismadb from "@/lib/prismadb";
import { sendTelegramTaskNotification } from "@/lib/telegram";
import { assertApprovedAccess } from "@/lib/cabinet-access";

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

export async function POST(req: Request) {
  try {
    await assertApprovedAccess();

    const body = await req.json();

    const { title, deviceId, description, priority, workerId } = body;

    if (!title) {
      return new NextResponse("Title is required", { status: 400 });
    }

    if (!priority) {
      return new NextResponse("Priority is required", { status: 400 });
    }

    if (!workerId) {
      return new NextResponse("WorkerId is required", { status: 400 });
    }

    const task = await prismadb.tasks.create({
      data: {
        title,
        deviceId,
        description,
        priority,
        workerId: parseInt(workerId),
        status: "todo",
      },
    });

    const worker = await prismadb.workers.findUnique({
      where: { id: parseInt(workerId) },
      select: { chat_id: true, name: true },
    });

    if (worker?.chat_id) {
      await sendTelegramTaskNotification(
        String(worker.chat_id),
        task,
        "Нове завдання"
      );
    }

    return NextResponse.json(task.id);
  } catch (error) {
    const denied = accessErrorResponse(error);
    if (denied) return denied;
    console.log("[TASK_POST]", error);
    return new NextResponse("Internal error", { status: 500 });
  }
}

export async function GET() {
  try {
    await assertApprovedAccess();
    const task = await prismadb.tasks.findMany({
      where: {},
    });

    return NextResponse.json(task);
  } catch (error) {
    const denied = accessErrorResponse(error);
    if (denied) return denied;
    console.log("[TASK_GET]", error);
    return new NextResponse("Internal error", { status: 500 });
  }
}
