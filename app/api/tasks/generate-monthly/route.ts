import { NextResponse } from "next/server";
import { endOfMonth, format } from "date-fns";
import { uk } from "date-fns/locale";
import { randomUUID } from "crypto";

import prismadb from "@/lib/prismadb";
import { assertApprovedAccess } from "@/lib/cabinet-access";
import { currentPeriodKey } from "@/lib/task-fields";
import { sendTelegramTaskNotification } from "@/lib/telegram";

export async function POST() {
  try {
    await assertApprovedAccess();
    const periodKey = currentPeriodKey();
    const monthLabel = format(new Date(), "LLLL yyyy", { locale: uk });
    const dueAt = endOfMonth(new Date());

    const technicians = await prismadb.workers.findMany({
      where: {
        role: "technician",
        OR: [{ active: true }, { active: null }],
      },
      select: { id: true, name: true, chat_id: true },
    });

    let created = 0;
    let skipped = 0;
    const groupId = technicians.length > 1 ? randomUUID() : null;

    for (const tech of technicians) {
      const existing = await prismadb.tasks.findFirst({
        where: {
          type: "financial",
          schedule: "monthly",
          workerId: tech.id,
          periodKey,
        },
        select: { id: true },
      });

      if (existing) {
        skipped += 1;
        continue;
      }

      const task = await prismadb.tasks.create({
        data: {
          title: `Фінансовий звіт · ${monthLabel}`,
          description:
            "Збір фінансової інформації за поточний місяць (регулярна задача).",
          baseLocation: "Мережа",
          dueAt,
          groupId,
          type: "financial",
          schedule: "monthly",
          periodKey,
          salaryDeduction: null,
          deviceId: null,
          priority: "medium",
          status: "todo",
          workerId: tech.id,
        },
      });

      if (tech.chat_id) {
        await sendTelegramTaskNotification(
          String(tech.chat_id),
          task,
          "Нове завдання"
        );
      }

      created += 1;
    }

    return NextResponse.json({
      periodKey,
      technicians: technicians.length,
      created,
      skipped,
      groupId,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message === "UNAUTHORIZED") {
      return new NextResponse("Unauthenticated", { status: 401 });
    }
    if (message === "FORBIDDEN") {
      return new NextResponse("Forbidden", { status: 403 });
    }
    console.error("[TASKS_GENERATE_MONTHLY]", error);
    return new NextResponse("Internal error", { status: 500 });
  }
}
