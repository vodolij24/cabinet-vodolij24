import { randomUUID } from "crypto";
import { NextResponse } from "next/server";

import prismadb from "@/lib/prismadb";
import { sendTelegramTaskNotification } from "@/lib/telegram";
import { assertApprovedAccess } from "@/lib/cabinet-access";
import {
  isTaskSchedule,
  isTaskType,
  parseSalaryDeduction,
} from "@/lib/task-fields";
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

function parseDueAt(value: unknown): Date | null | "invalid" {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string" && !(value instanceof Date)) return "invalid";
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return "invalid";
  return d;
}

async function resolveWorkerIds(body: Record<string, unknown>): Promise<
  | { workerIds: number[] }
  | { error: string }
> {
  if (typeof body.assignRole === "string" && body.assignRole.trim()) {
    if (!isWorkerRole(body.assignRole)) {
      return { error: "Invalid assignRole" };
    }
    const workers = await prismadb.workers.findMany({
      where: {
        role: body.assignRole,
        OR: [{ active: true }, { active: null }],
      },
      select: { id: true },
    });
    if (workers.length === 0) {
      return { error: "Немає активних працівників з цією роллю" };
    }
    return { workerIds: workers.map((w) => w.id) };
  }

  const fromArray = Array.isArray(body.workerIds)
    ? body.workerIds
        .map((id) => parseInt(String(id), 10))
        .filter((id) => Number.isFinite(id) && id > 0)
    : [];

  if (fromArray.length > 0) {
    return { workerIds: [...new Set(fromArray)] };
  }

  const single = parseInt(String(body.workerId ?? ""), 10);
  if (Number.isFinite(single) && single > 0) {
    return { workerIds: [single] };
  }

  return { error: "Оберіть виконавця, кількох або категорію" };
}

function parseSharedFields(body: Record<string, unknown>) {
  const title = typeof body.title === "string" ? body.title.trim() : "";
  const description =
    typeof body.description === "string" ? body.description : "";
  const baseLocation =
    typeof body.baseLocation === "string" && body.baseLocation.trim()
      ? body.baseLocation.trim()
      : null;
  const priority =
    typeof body.priority === "string" && body.priority.trim()
      ? body.priority.trim()
      : "medium";

  const type = isTaskType(body.type) ? body.type : "operational";
  let schedule: string | null = null;
  if (type === "financial") {
    schedule = isTaskSchedule(body.schedule) ? body.schedule : "once";
  }

  const deduction = parseSalaryDeduction(body.salaryDeduction);
  if (deduction === "invalid") {
    return {
      error: "Утримання із заробітної плати: ціле число, кратне 100",
    } as const;
  }
  // Утримання доступне для задач загалом (за ТЗ у полях задачі)
  const salaryDeduction = deduction;

  const dueAt = parseDueAt(body.dueAt);
  if (dueAt === "invalid") {
    return { error: "Некоректний термін виконання" } as const;
  }

  let deviceId: number | null = null;
  if (
    body.deviceId !== null &&
    body.deviceId !== undefined &&
    body.deviceId !== ""
  ) {
    const n = parseInt(String(body.deviceId), 10);
    if (!Number.isFinite(n) || n < 0) {
      return { error: "Invalid deviceId" } as const;
    }
    deviceId = n === 0 ? null : n;
  }

  if (!title) {
    return { error: "Назва обовʼязкова" } as const;
  }
  if (!baseLocation) {
    return { error: "База (локація) обовʼязкова" } as const;
  }

  return {
    data: {
      title,
      description,
      baseLocation,
      dueAt,
      priority,
      type,
      schedule,
      salaryDeduction,
      deviceId,
      periodKey:
        typeof body.periodKey === "string" && body.periodKey.trim()
          ? body.periodKey.trim()
          : null,
    },
  } as const;
}

export async function POST(req: Request) {
  try {
    await assertApprovedAccess();
    const body = await req.json();

    const shared = parseSharedFields(body);
    if ("error" in shared && shared.error) {
      return new NextResponse(shared.error, { status: 400 });
    }
    const fields = shared.data!;

    const resolved = await resolveWorkerIds(body);
    if ("error" in resolved) {
      return new NextResponse(resolved.error, { status: 400 });
    }
    const { workerIds } = resolved;

    const groupId = workerIds.length > 1 ? randomUUID() : null;
    const createdIds: number[] = [];

    for (const workerId of workerIds) {
      const task = await prismadb.tasks.create({
        data: {
          ...fields,
          workerId,
          groupId,
          status: "todo",
        },
      });
      createdIds.push(task.id);

      const worker = await prismadb.workers.findUnique({
        where: { id: workerId },
        select: { chat_id: true },
      });
      if (worker?.chat_id) {
        await sendTelegramTaskNotification(
          String(worker.chat_id),
          task,
          "Нове завдання"
        );
      }
    }

    return NextResponse.json({
      ids: createdIds,
      id: createdIds[0],
      groupId,
      count: createdIds.length,
    });
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
    const task = await prismadb.tasks.findMany({ where: {} });
    return NextResponse.json(task);
  } catch (error) {
    const denied = accessErrorResponse(error);
    if (denied) return denied;
    console.log("[TASK_GET]", error);
    return new NextResponse("Internal error", { status: 500 });
  }
}
