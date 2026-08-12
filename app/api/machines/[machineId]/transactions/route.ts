import { NextResponse } from "next/server";

import { assertApprovedAccess } from "@/lib/cabinet-access";
import {
  getMachineTodayTransactions,
  type MachineTxFilter,
} from "@/lib/machine-today-stats";

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

function parseFilter(raw: string | null): MachineTxFilter {
  if (raw === "cash" || raw === "cashless") return raw;
  return "all";
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ machineId: string }> }
) {
  try {
    await assertApprovedAccess();
    const { machineId } = await params;
    const id = parseInt(machineId, 10);
    if (!Number.isFinite(id)) {
      return new NextResponse("Invalid machine", { status: 400 });
    }

    const { searchParams } = new URL(req.url);
    const filter = parseFilter(searchParams.get("filter"));
    const rows = await getMachineTodayTransactions(id, filter);

    return NextResponse.json({
      deviceId: id,
      filter,
      count: rows.length,
      transactions: rows,
    });
  } catch (error) {
    const denied = accessErrorResponse(error);
    if (denied) return denied;
    console.error("[MACHINE_TRANSACTIONS_GET]", error);
    return new NextResponse("Internal error", { status: 500 });
  }
}
