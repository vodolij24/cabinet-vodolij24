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

export async function GET(
  req: Request,
  { params }: { params: Promise<{ taskId: string }> }
) {
  try {
    await assertApprovedAccess();
    if (!(await params).taskId) {
      return new NextResponse("Task id is required", { status: 400 });
    }

    const task = await prismadb.tasks.findUnique({
      where: {
        id: Number((await params).taskId),
      },
    });

    return NextResponse.json(task?.id);
  } catch (error) {
    const denied = accessErrorResponse(error);
    if (denied) return denied;
    console.log("[TASK_GET]", error);
    return new NextResponse("Internal error", { status: 500 });
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ taskId: string }> }
) {
  try {
    await assertApprovedAccess();
    if (!(await params).taskId) {
      return new NextResponse("Task id is required", { status: 400 });
    }

    const task = await prismadb.tasks.delete({
      where: {
        id: Number((await params).taskId),
      },
    });

    return NextResponse.json(task.id);
  } catch (error) {
    const denied = accessErrorResponse(error);
    if (denied) return denied;
    console.log("[TASK_DELETE]", error);
    return new NextResponse("Internal error", { status: 500 });
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ taskId: string }> }
) {
  try {
    await assertApprovedAccess();
    const body = await req.json();

    const { title, description, deviceId, priority, workerId } = body;

    if (!title) {
      return new NextResponse("Title is required", { status: 400 });
    }

    if (!(await params).taskId) {
      return new NextResponse("Task id is required", { status: 400 });
    }

    const task = await prismadb.tasks.update({
      where: {
        id: Number((await params).taskId),
      },
      data: {
        title,
        description,
        deviceId,
        priority,
        workerId: parseInt(workerId),
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
        "Завдання змінено"
      );
    }

    return NextResponse.json(task.id);
  } catch (error) {
    const denied = accessErrorResponse(error);
    if (denied) return denied;
    console.log("[TASK_PATCH]", error);
    return new NextResponse("Internal error", { status: 500 });
  }
}
