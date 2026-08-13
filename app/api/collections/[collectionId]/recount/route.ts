import { NextResponse } from "next/server";

import { assertApprovedAccess } from "@/lib/cabinet-access";
import { parseMoney } from "@/lib/collection-fields";
import { applyCollectionRecount } from "@/lib/collection-recount";

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

function recountErrorResponse(error: unknown) {
  const code = error instanceof Error ? error.message : "";
  if (code === "NOT_FOUND") return new NextResponse("Not found", { status: 404 });
  if (code === "NOT_HANDED") {
    return new NextResponse("Інкасацію ще не здано касиру", { status: 400 });
  }
  if (code === "HANDOVER_CLOSED") {
    return new NextResponse("Перерахунок цієї здачі вже закрито", {
      status: 400,
    });
  }
  if (code === "AMOUNT_REQUIRED") {
    return new NextResponse("Вкажіть фактично отриману суму", { status: 400 });
  }
  return null;
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ collectionId: string }> }
) {
  try {
    await assertApprovedAccess();
    const { collectionId } = await params;
    const id = parseInt(collectionId, 10);
    if (!Number.isInteger(id) || id <= 0) {
      return new NextResponse("Collection id is required", { status: 400 });
    }

    const body = await req.json();
    const missing = Boolean(body?.missing);
    const actual = missing ? null : parseMoney(body?.actualReceived);

    const result = await applyCollectionRecount({
      collectionId: id,
      missing,
      actualReceived: actual,
    });

    return NextResponse.json(result);
  } catch (error) {
    const denied = accessErrorResponse(error);
    if (denied) return denied;
    const mapped = recountErrorResponse(error);
    if (mapped) return mapped;
    console.error("[COLLECTION_RECOUNT]", error);
    return new NextResponse("Internal error", { status: 500 });
  }
}
