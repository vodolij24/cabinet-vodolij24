import { NextResponse } from "next/server";

import { isPhoneRouteParam } from "@/lib/phone";
import { findCashierByPhoneDigits } from "@/lib/cashier-public";
import {
  addCollectionComment,
  listCollectionComments,
} from "@/lib/collection-lifecycle";
import prismadb from "@/lib/prismadb";

export const runtime = "nodejs";

async function assertCashierPackage(cashierId: number, collectionId: number) {
  const rows = await prismadb.$queryRawUnsafe<Array<{ id: number }>>(
    `SELECT c.id
     FROM collections c
     JOIN collection_handovers h ON h.id = c."handoverId"
     WHERE c.id = ${collectionId} AND h.cashier_id = ${cashierId}
     LIMIT 1`
  );
  return Boolean(rows[0]);
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ phone: string; collectionId: string }> }
) {
  try {
    const { phone, collectionId } = await params;
    if (!isPhoneRouteParam(phone)) {
      return new NextResponse("Not found", { status: 404 });
    }
    const cashier = await findCashierByPhoneDigits(phone);
    if (!cashier) return new NextResponse("Not found", { status: 404 });
    const id = parseInt(collectionId, 10);
    if (!Number.isInteger(id) || id <= 0) {
      return new NextResponse("Invalid id", { status: 400 });
    }
    if (!(await assertCashierPackage(cashier.id, id))) {
      return new NextResponse("Not found", { status: 404 });
    }
    const comments = await listCollectionComments(id);
    return NextResponse.json({ comments });
  } catch (error) {
    console.error("[CASHIER_COMMENTS_GET]", error);
    return new NextResponse("Internal error", { status: 500 });
  }
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ phone: string; collectionId: string }> }
) {
  try {
    const { phone, collectionId } = await params;
    if (!isPhoneRouteParam(phone)) {
      return new NextResponse("Not found", { status: 404 });
    }
    const cashier = await findCashierByPhoneDigits(phone);
    if (!cashier) return new NextResponse("Not found", { status: 404 });
    const id = parseInt(collectionId, 10);
    if (!Number.isInteger(id) || id <= 0) {
      return new NextResponse("Invalid id", { status: 400 });
    }
    if (!(await assertCashierPackage(cashier.id, id))) {
      return new NextResponse("Not found", { status: 404 });
    }
    const body = await req.json();
    const comment = await addCollectionComment({
      collectionId: id,
      actor: {
        role: "cashier",
        id: cashier.id,
        name: cashier.name || `Касир #${cashier.id}`,
      },
      body: String(body?.body ?? body?.comment ?? ""),
    });
    return NextResponse.json({ comment });
  } catch (error) {
    const code = error instanceof Error ? error.message : "";
    if (code === "COMMENT_REQUIRED") {
      return new NextResponse("Напишіть коментар", { status: 400 });
    }
    console.error("[CASHIER_COMMENTS_POST]", error);
    return new NextResponse("Internal error", { status: 500 });
  }
}
