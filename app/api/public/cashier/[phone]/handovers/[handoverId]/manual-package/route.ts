import { NextResponse } from "next/server";

import { isPhoneRouteParam } from "@/lib/phone";
import { findCashierByPhoneDigits } from "@/lib/cashier-public";
import { parseMoney } from "@/lib/collection-fields";
import { addManualHandoverPackage } from "@/lib/collection-handovers";

export const runtime = "nodejs";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ phone: string; handoverId: string }> }
) {
  try {
    const { phone, handoverId } = await params;
    if (!isPhoneRouteParam(phone)) {
      return new NextResponse("Not found", { status: 404 });
    }
    const cashier = await findCashierByPhoneDigits(phone);
    if (!cashier) {
      return new NextResponse("Not found", { status: 404 });
    }

    const hid = parseInt(handoverId, 10);
    if (!Number.isFinite(hid) || hid <= 0) {
      return new NextResponse("Invalid handover", { status: 400 });
    }

    const body = await req.json();
    const deviceId = parseInt(String(body?.deviceId ?? ""), 10);
    const amount = parseMoney(body?.amount);

    if (!Number.isFinite(deviceId) || deviceId <= 0) {
      return new NextResponse("Вкажіть номер апарата", { status: 400 });
    }
    if (amount == null) {
      return new NextResponse("Вкажіть суму", { status: 400 });
    }

    const result = await addManualHandoverPackage({
      cashierId: cashier.id,
      handoverId: hid,
      deviceId,
      amount,
    });

    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message === "NOT_FOUND") {
      return new NextResponse("Здачу не знайдено", { status: 404 });
    }
    if (message === "HANDOVER_CLOSED") {
      return new NextResponse("Здачу вже закрито", { status: 400 });
    }
    if (message === "AMOUNT_REQUIRED") {
      return new NextResponse("Вкажіть суму", { status: 400 });
    }
    console.error("[CASHIER_MANUAL_PACKAGE]", error);
    return new NextResponse("Internal error", { status: 500 });
  }
}
