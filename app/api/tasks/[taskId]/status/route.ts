import { NextResponse } from "next/server";

import prismadb from "@/lib/prismadb";
import { assertApprovedAccess } from "@/lib/cabinet-access";
import {
  cabinetStatusUpdate,
  isCabinetTaskStatus,
} from "@/lib/task-fields";
import { syncStaffTaskMenu } from "@/lib/task-digest";

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

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ taskId: string }> }
) {
  try {
    await assertApprovedAccess();
    const { taskId } = await params;
    const id = Number(taskId);
    if (!Number.isFinite(id) || id <= 0) {
      return new NextResponse("Task id is required", { status: 400 });
    }

    const body = await req.json();
    if (!isCabinetTaskStatus(body?.status)) {
      return new NextResponse("Некоректний статус", { status: 400 });
    }

    const existing = await prismadb.tasks.findUnique({
      where: { id },
      select: { id: true, completedAt: true, workerId: true },
    });
    if (!existing) {
      return new NextResponse("Not found", { status: 404 });
    }

    const updated = await prismadb.tasks.update({
      where: { id },
      data: cabinetStatusUpdate(body.status, existing.completedAt),
      select: { id: true, status: true },
    });

    await syncStaffTaskMenu(existing.workerId);

    return NextResponse.json(updated);
  } catch (error) {
    const denied = accessErrorResponse(error);
    if (denied) return denied;
    console.log("[TASK_STATUS_PATCH]", error);
    return new NextResponse("Internal error", { status: 500 });
  }
}
