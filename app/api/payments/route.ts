import { NextResponse } from "next/server";

import { assertApprovedAccess } from "@/lib/cabinet-access";
import {
  createPaymentRequest,
  isPaymentCategory,
  isPaymentFundSource,
  isPaymentPriority,
  listPaymentRequests,
  parseDueDate,
  parsePaymentAmount,
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

export async function GET() {
  try {
    await assertApprovedAccess();
    const items = await listPaymentRequests();
    return NextResponse.json({ items });
  } catch (error) {
    const denied = accessErrorResponse(error);
    if (denied) return denied;
    console.error("[PAYMENTS_GET]", error);
    return new NextResponse("Internal error", { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const access = await assertApprovedAccess();
    const body = await req.json();

    const title = typeof body?.title === "string" ? body.title.trim() : "";
    if (!title) {
      return new NextResponse("Вкажіть назву заявки", { status: 400 });
    }

    const amount = parsePaymentAmount(body?.amount);
    if (amount == null) {
      return new NextResponse("Сума має бути цілим числом > 0", { status: 400 });
    }

    const dueDate = parseDueDate(body?.dueDate);
    if (!dueDate) {
      return new NextResponse("Вкажіть дату оплати", { status: 400 });
    }

    const priority =
      typeof body?.priority === "string" && isPaymentPriority(body.priority)
        ? body.priority
        : "normal";

    const category =
      typeof body?.category === "string" && isPaymentCategory(body.category)
        ? body.category
        : "other";

    const fundSource =
      typeof body?.fundSource === "string" &&
      body.fundSource &&
      isPaymentFundSource(body.fundSource)
        ? body.fundSource
        : null;

    const fundSourceNote =
      typeof body?.fundSourceNote === "string" && body.fundSourceNote.trim()
        ? body.fundSourceNote.trim()
        : null;

    const description =
      typeof body?.description === "string" && body.description.trim()
        ? body.description.trim()
        : null;

    const authorName =
      access.name?.trim() || access.email?.trim() || "Керівник";

    const row = await createPaymentRequest({
      title,
      description,
      amount,
      dueDate,
      category,
      priority,
      fundSource,
      fundSourceNote,
      authorId: access.id,
      authorName,
    });

    return NextResponse.json(row);
  } catch (error) {
    const denied = accessErrorResponse(error);
    if (denied) return denied;
    console.error("[PAYMENTS_POST]", error);
    return new NextResponse("Internal error", { status: 500 });
  }
}
