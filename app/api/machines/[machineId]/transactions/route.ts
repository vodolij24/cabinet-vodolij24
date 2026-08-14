import { NextResponse } from "next/server";

import { assertApprovedAccess } from "@/lib/cabinet-access";
import {
  getMachineTodayTransactions,
  type MachineTxFilter,
} from "@/lib/machine-today-stats";
import {
  kyivCustomPeriodBounds,
  kyivStatementPeriodBounds,
  type StatementPeriodPreset,
} from "@/lib/kyiv-date";

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

function parsePeriod(raw: string | null): StatementPeriodPreset {
  if (
    raw === "day" ||
    raw === "week" ||
    raw === "mtd" ||
    raw === "month" ||
    raw === "custom"
  ) {
    return raw;
  }
  return "day";
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
    const period = parsePeriod(searchParams.get("period"));
    const bounds =
      period === "custom"
        ? kyivCustomPeriodBounds(
            searchParams.get("from") || "",
            searchParams.get("to") || ""
          )
        : kyivStatementPeriodBounds(period);

    if (!bounds) {
      return new NextResponse("Некоректний період", { status: 400 });
    }

    const rows = await getMachineTodayTransactions(id, filter, {
      from: bounds.from,
      to: bounds.to,
    });

    const totals = rows.reduce(
      (acc, row) => {
        acc.liters += row.liters;
        acc.cash += row.cash;
        acc.cashless += row.cashless;
        return acc;
      },
      { liters: 0, cash: 0, cashless: 0 }
    );

    return NextResponse.json({
      deviceId: id,
      filter,
      period,
      fromKey: bounds.fromKey,
      toKey: bounds.toKey,
      rangeLabel:
        bounds.fromKey === bounds.toKey
          ? bounds.fromKey
          : `${bounds.fromKey} – ${bounds.toKey}`,
      count: rows.length,
      totals: {
        liters: Math.round(totals.liters * 10) / 10,
        cash: Math.round(totals.cash * 100) / 100,
        cashless: Math.round(totals.cashless * 100) / 100,
      },
      transactions: rows,
    });
  } catch (error) {
    const denied = accessErrorResponse(error);
    if (denied) return denied;
    console.error("[MACHINE_TRANSACTIONS_GET]", error);
    return new NextResponse("Internal error", { status: 500 });
  }
}
