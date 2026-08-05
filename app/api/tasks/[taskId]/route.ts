import { NextResponse } from "next/server";

import prismadb from "@/lib/prismadb";
import { sendTelegramTaskNotification } from "@/lib/telegram";
import { assertApprovedAccess } from "@/lib/cabinet-access";
import {
  isTaskSchedule,
  isTaskType,
  parseSalaryDeduction,
} from "@/lib/task-fields";

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

function parseDueAt(value: unknown): Date | null | "invalid" {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string" && !(value instanceof Date)) return "invalid";
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return "invalid";
  return d;
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ taskId: string }> }
) {
  try {
    await assertApprovedAccess();
    const { taskId } = await params;
    if (!taskId) {
      return new NextResponse("Task id is required", { status: 400 });
    }

    const task = await prismadb.tasks.findUnique({
      where: { id: Number(taskId) },
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
  _req: Request,
  { params }: { params: Promise<{ taskId: string }> }
) {
  try {
    await assertApprovedAccess();
    const { taskId } = await params;
    if (!taskId) {
      return new NextResponse("Task id is required", { status: 400 });
    }

    const task = await prismadb.tasks.delete({
      where: { id: Number(taskId) },
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
    const { taskId } = await params;
    const body = await req.json();

    if (!taskId) {
      return new NextResponse("Task id is required", { status: 400 });
    }

    const title = typeof body.title === "string" ? body.title.trim() : "";
    if (!title) {
      return new NextResponse("Назва обовʼязкова", { status: 400 });
    }

    const baseLocation =
      typeof body.baseLocation === "string" ? body.baseLocation.trim() : "";
    if (!baseLocation) {
      return new NextResponse("База (локація) обовʼязкова", { status: 400 });
    }

    const type = isTaskType(body.type) ? body.type : "operational";
    let schedule: string | null = null;
    if (type === "financial") {
      schedule = isTaskSchedule(body.schedule) ? body.schedule : "once";
    }

    const deduction = parseSalaryDeduction(body.salaryDeduction);
    if (deduction === "invalid") {
      return new NextResponse(
        "Утримання із заробітної плати: ціле число, кратне 100",
        { status: 400 }
      );
    }

    const dueAt = parseDueAt(body.dueAt);
    if (dueAt === "invalid") {
      return new NextResponse("Некоректний термін виконання", { status: 400 });
    }

    const workerId = parseInt(String(body.workerId), 10);
    if (!Number.isFinite(workerId)) {
      return new NextResponse("WorkerId is required", { status: 400 });
    }

    let deviceId: number | null = null;
    if (
      body.deviceId !== null &&
      body.deviceId !== undefined &&
      body.deviceId !== ""
    ) {
      const n = parseInt(String(body.deviceId), 10);
      if (!Number.isFinite(n) || n < 0) {
        return new NextResponse("Invalid deviceId", { status: 400 });
      }
      deviceId = n === 0 ? null : n;
    }

    const task = await prismadb.tasks.update({
      where: { id: Number(taskId) },
      data: {
        title,
        description:
          typeof body.description === "string" ? body.description : "",
        baseLocation,
        dueAt,
        deviceId,
        priority:
          typeof body.priority === "string" && body.priority.trim()
            ? body.priority.trim()
            : "medium",
        workerId,
        type,
        schedule,
        salaryDeduction: deduction,
      },
    });

    const worker = await prismadb.workers.findUnique({
      where: { id: workerId },
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
