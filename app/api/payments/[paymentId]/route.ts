import { NextResponse } from "next/server";
import { parseISO } from "date-fns";

import { assertApprovedAccess } from "@/lib/cabinet-access";
import {
  deletePaymentRequest,
  findPaymentById,
  isPaymentCategory,
  isPaymentFundSource,
  isPaymentPriority,
  isPaymentStatus,
  parseDueDate,
  parsePaymentAmount,
  updatePaymentRequest,
} from "@/lib/payment-requests";

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

function parseId(raw: string) {
  const id = parseInt(raw, 10);
  if (!Number.isFinite(id) || id <= 0) return null;
  return id;
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ paymentId: string }> }
) {
  try {
    const access = await assertApprovedAccess();
    const { paymentId } = await params;
    const id = parseId(paymentId);
    if (!id) return new NextResponse("Invalid id", { status: 400 });

    const existing = await findPaymentById(id);
    if (!existing) return new NextResponse("Not found", { status: 404 });

    const body = await req.json();
    const action = typeof body?.action === "string" ? body.action : "update";
    const actorName =
      access.name?.trim() || access.email?.trim() || "Керівник";

    if (action === "approve") {
      if (existing.status !== "pending") {
        return new NextResponse("Заявку вже погоджено або закрито", {
          status: 400,
        });
      }
      const row = await updatePaymentRequest(id, { status: "approved" });
      return NextResponse.json(row);
    }

    if (action === "cancel") {
      if (existing.status === "paid" || existing.status === "cancelled") {
        return new NextResponse("Неможливо скасувати", { status: 400 });
      }
      const row = await updatePaymentRequest(id, { status: "cancelled" });
      return NextResponse.json(row);
    }

    if (action === "mark_paid") {
      const paidAmount = parsePaymentAmount(body?.paidAmount) ?? existing.amount;
      const paidByName =
        typeof body?.paidByName === "string" && body.paidByName.trim()
          ? body.paidByName.trim()
          : actorName;
      let paidAt = new Date();
      if (typeof body?.paidAt === "string" && body.paidAt.trim()) {
        const parsed = parseISO(body.paidAt.trim());
        if (!Number.isNaN(parsed.getTime())) paidAt = parsed;
      }
      const status = paidAmount < existing.amount ? "partial" : "paid";
      const row = await updatePaymentRequest(id, {
        status,
        paidAmount,
        paidByName,
        paidById: access.id,
        paidAt,
      });
      return NextResponse.json(row);
    }

    if (action === "toggle_accounted") {
      const accounted = Boolean(body?.accounted);
      const row = await updatePaymentRequest(id, {
        accounted,
        accountedAt: accounted ? new Date() : null,
        accountedByName: accounted ? actorName : null,
      });
      return NextResponse.json(row);
    }

    const data: Record<string, unknown> = {};

    if (typeof body?.title === "string") {
      const title = body.title.trim();
      if (!title) return new NextResponse("Вкажіть назву", { status: 400 });
      data.title = title;
    }

    if (body?.amount != null) {
      const amount = parsePaymentAmount(body.amount);
      if (amount == null) {
        return new NextResponse("Некоректна сума", { status: 400 });
      }
      data.amount = amount;
    }

    if (body?.dueDate != null) {
      const dueDate = parseDueDate(body.dueDate);
      if (!dueDate) {
        return new NextResponse("Некоректна дата", { status: 400 });
      }
      data.dueDate = dueDate;
    }

    if (typeof body?.priority === "string" && isPaymentPriority(body.priority)) {
      data.priority = body.priority;
    }

    if (typeof body?.category === "string" && isPaymentCategory(body.category)) {
      data.category = body.category;
    }

    if (body?.fundSource === null || body?.fundSource === "") {
      data.fundSource = null;
    } else if (
      typeof body?.fundSource === "string" &&
      isPaymentFundSource(body.fundSource)
    ) {
      data.fundSource = body.fundSource;
    }

    if (typeof body?.fundSourceNote === "string") {
      data.fundSourceNote = body.fundSourceNote.trim() || null;
    }

    if (typeof body?.description === "string") {
      data.description = body.description.trim() || null;
    }

    if (
      typeof body?.status === "string" &&
      isPaymentStatus(body.status) &&
      body.status !== "overdue"
    ) {
      data.status = body.status;
    }

    if (Object.keys(data).length === 0) {
      return new NextResponse("Немає змін", { status: 400 });
    }

    const row = await updatePaymentRequest(id, data);
    return NextResponse.json(row);
  } catch (error) {
    const denied = accessErrorResponse(error);
    if (denied) return denied;
    console.error("[PAYMENTS_PATCH]", error);
    return new NextResponse("Internal error", { status: 500 });
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ paymentId: string }> }
) {
  try {
    await assertApprovedAccess();
    const { paymentId } = await params;
    const id = parseId(paymentId);
    if (!id) return new NextResponse("Invalid id", { status: 400 });

    await deletePaymentRequest(id);
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    const denied = accessErrorResponse(error);
    if (denied) return denied;
    console.error("[PAYMENTS_DELETE]", error);
    return new NextResponse("Internal error", { status: 500 });
  }
}
