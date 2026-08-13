import { NextResponse } from "next/server";

import { isPhoneRouteParam } from "@/lib/phone";
import { findCashierByPhoneDigits } from "@/lib/cashier-public";
import { parseMoney } from "@/lib/collection-fields";
import { applyCollectionRecount } from "@/lib/collection-recount";
import prismadb from "@/lib/prismadb";

export const runtime = "nodejs";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ phone: string; collectionId: string }> }
) {
  try {
    const { phone, collectionId } = await params;
    if (!isPhoneRouteParam(phone)) {
      return new NextResponse("Not found", { status: 404 });
    }
    const cashier = await findCashierByPhoneDigits(phone);
    if (!cashier) {
      return new NextResponse("Not found", { status: 404 });
    }

    const id = parseInt(collectionId, 10);
    if (!Number.isInteger(id) || id <= 0) {
      return new NextResponse("Collection id is required", { status: 400 });
    }

    const owned = await prismadb.$queryRawUnsafe<
      Array<{ id: number }>
    >(
      `SELECT c.id
       FROM collections c
       JOIN collection_handovers h ON h.id = c."handoverId"
       WHERE c.id = ${id} AND h.cashier_id = ${cashier.id}
       LIMIT 1`
    );
    if (!owned[0]) {
      return new NextResponse("Not found", { status: 404 });
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
    const code = error instanceof Error ? error.message : "";
    if (code === "HANDOVER_CLOSED") {
      return new NextResponse("Перерахунок цієї здачі вже закрито", {
        status: 400,
      });
    }
    if (code === "AMOUNT_REQUIRED") {
      return new NextResponse("Вкажіть фактично отриману суму", {
        status: 400,
      });
    }
    console.error("[CASHIER_RECOUNT]", error);
    return new NextResponse("Internal error", { status: 500 });
  }
}
