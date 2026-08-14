import { NextResponse } from "next/server";

import { isPhoneRouteParam } from "@/lib/phone";
import {
  findCashierByPhoneDigits,
  loadHandoverPackagesForCashier,
} from "@/lib/cashier-public";

export const runtime = "nodejs";

export async function GET(
  _req: Request,
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

    const id = parseInt(handoverId, 10);
    if (!Number.isInteger(id) || id <= 0) {
      return new NextResponse("Handover id is required", { status: 400 });
    }

    const packages = await loadHandoverPackagesForCashier(cashier.id, id);
    if (!packages) {
      return new NextResponse("Not found", { status: 404 });
    }

    return NextResponse.json({ packages });
  } catch (error) {
    console.error("[CASHIER_HANDOVER_PACKAGES]", error);
    return new NextResponse("Internal error", { status: 500 });
  }
}
