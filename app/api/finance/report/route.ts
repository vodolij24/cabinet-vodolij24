import { NextResponse } from "next/server";

import { assertApprovedAccess } from "@/lib/cabinet-access";
import { getFinanceReport } from "@/lib/finance-report";

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
    const result = await getFinanceReport({
      preset: searchParams.get("preset"),
      from: searchParams.get("from"),
      to: searchParams.get("to"),
    });
    if ("error" in result) {
      return new NextResponse(result.error, { status: 400 });
    }
    return NextResponse.json(result);
  } catch (error) {
    const denied = accessErrorResponse(error);
    if (denied) return denied;
    console.error("[FINANCE_REPORT_GET]", error);
    return new NextResponse("Internal error", { status: 500 });
  }
}
