import { NextResponse } from "next/server";

import prismadb from "@/lib/prismadb";
import { isPhoneRouteParam } from "@/lib/phone";
import { findManagerByPhoneDigits } from "@/lib/manager-public";
import {
  isManagerAckOnlyTask,
  isManagerReviewableStatus,
  MANAGER_DECISION,
  TASK_STATUS,
} from "@/lib/task-fields";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ phone: string; taskId: string }> }
) {
  try {
    const { phone, taskId } = await params;
    if (!isPhoneRouteParam(phone)) {
      return new NextResponse("Not found", { status: 404 });
    }

    const manager = await findManagerByPhoneDigits(phone);
    if (!manager) {
      return new NextResponse("Not found", { status: 404 });
    }

    const id = parseInt(taskId, 10);
    if (!Number.isFinite(id)) {
      return new NextResponse("Invalid task", { status: 400 });
    }

    const task = await prismadb.tasks.findUnique({ where: { id } });
    if (!task) {
      return new NextResponse("Not found", { status: 404 });
    }

    if (!isManagerReviewableStatus(task.status)) {
      return new NextResponse("Задача вже оброблена", { status: 409 });
    }

    const body = await req.json();
    const action = typeof body?.action === "string" ? body.action : null;
    const comment =
      typeof body?.comment === "string" ? body.comment.trim() : "";

    const ackOnly = isManagerAckOnlyTask(task);

    if (ackOnly) {
      if (action !== "acknowledge") {
        return new NextResponse(
          "Для відхиленої задачі з утриманням доступне лише ознайомлення",
          { status: 400 }
        );
      }

      const updated = await prismadb.tasks.update({
        where: { id },
        data: {
          status: TASK_STATUS.done,
          managerDecision: MANAGER_DECISION.acknowledged,
          deductionApplied: true,
          managerComment: comment || null,
          reviewedAt: new Date(),
          reviewedById: manager.id,
        },
      });

      return NextResponse.json({
        id: updated.id,
        status: updated.status,
        managerDecision: updated.managerDecision,
        deductionApplied: updated.deductionApplied,
      });
    }

    if (action !== "accept" && action !== "reject") {
      return new NextResponse("Invalid action", { status: 400 });
    }

    const accepted = action === "accept";
    const deductionApplied =
      !accepted &&
      task.salaryDeduction != null &&
      task.salaryDeduction > 0;

    const updated = await prismadb.tasks.update({
      where: { id },
      data: {
        status: TASK_STATUS.done,
        managerDecision: accepted
          ? MANAGER_DECISION.accepted
          : MANAGER_DECISION.rejected,
        deductionApplied,
        managerComment: comment || null,
        reviewedAt: new Date(),
        reviewedById: manager.id,
      },
    });

    return NextResponse.json({
      id: updated.id,
      status: updated.status,
      managerDecision: updated.managerDecision,
      deductionApplied: updated.deductionApplied,
    });
  } catch (error) {
    console.error("[PUBLIC_MANAGER_TASK_ACTION]", error);
    return new NextResponse("Internal error", { status: 500 });
  }
}
