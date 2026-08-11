import { NextResponse } from "next/server";
import { parseISO, startOfDay } from "date-fns";

import { assertApprovedAccess } from "@/lib/cabinet-access";
import prismadb from "@/lib/prismadb";

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

function parsePositiveAmount(value: unknown): number | null {
  if (typeof value === "number") {
    if (!Number.isInteger(value) || value <= 0) return null;
    return value;
  }
  if (typeof value === "string") {
    const t = value.trim();
    if (!/^\d+$/.test(t)) return null;
    const n = parseInt(t, 10);
    return n > 0 ? n : null;
  }
  return null;
}

/** Створити ручну премію: сума · причина · автор · дата */
export async function POST(req: Request) {
  try {
    const access = await assertApprovedAccess();
    const body = await req.json();

    const workerId = parseInt(String(body?.workerId), 10);
    if (!Number.isFinite(workerId)) {
      return new NextResponse("Оберіть техніка", { status: 400 });
    }

    const amount = parsePositiveAmount(body?.amount);
    if (amount == null) {
      return new NextResponse("Сума має бути цілим числом > 0", { status: 400 });
    }

    const reason =
      typeof body?.reason === "string" ? body.reason.trim() : "";
    if (!reason) {
      return new NextResponse("Вкажіть причину", { status: 400 });
    }

    let bonusDate = startOfDay(new Date());
    if (typeof body?.bonusDate === "string" && body.bonusDate.trim()) {
      const parsed = startOfDay(parseISO(body.bonusDate.trim()));
      if (Number.isNaN(parsed.getTime())) {
        return new NextResponse("Некоректна дата", { status: 400 });
      }
      bonusDate = parsed;
    }

    const worker = await prismadb.workers.findFirst({
      where: {
        id: workerId,
        role: "technician",
        OR: [{ active: true }, { active: null }],
      },
      select: { id: true },
    });
    if (!worker) {
      return new NextResponse("Техніка не знайдено", { status: 404 });
    }

    const authorName =
      access.name?.trim() || access.email?.trim() || "Керівник";

    if (typeof prismadb.technicianManualBonus?.create !== "function") {
      return new NextResponse(
        "Prisma-клієнт застарілий: зупиніть next dev і виконайте npx prisma generate",
        { status: 503 }
      );
    }

    const created = await prismadb.technicianManualBonus.create({
      data: {
        workerId,
        amount,
        reason,
        authorName,
        authorId: access.id,
        bonusDate,
      },
    });

    return NextResponse.json({ id: created.id });
  } catch (error) {
    const denied = accessErrorResponse(error);
    if (denied) return denied;
    console.error("[FINANCE_BONUS_POST]", error);
    return new NextResponse("Internal error", { status: 500 });
  }
}
