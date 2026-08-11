import { NextResponse } from "next/server";

import { assertApprovedAccess } from "@/lib/cabinet-access";
import { getFinanceMonth, isPeriodKey } from "@/lib/finance-month";
import { currentPeriodKey } from "@/lib/task-fields";

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

export async function GET(req: Request) {
  try {
    await assertApprovedAccess();
    const { searchParams } = new URL(req.url);
    const period = searchParams.get("period") || currentPeriodKey();
    if (!isPeriodKey(period)) {
      return new NextResponse("Invalid period", { status: 400 });
    }
    const data = await getFinanceMonth(period);
    return NextResponse.json(data);
  } catch (error) {
    const denied = accessErrorResponse(error);
    if (denied) return denied;
    console.error("[FINANCE_GET]", error);
    return new NextResponse("Internal error", { status: 500 });
  }
}
