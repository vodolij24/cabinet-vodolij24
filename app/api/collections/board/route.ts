import { NextResponse } from "next/server";

import { assertApprovedAccess } from "@/lib/cabinet-access";
import { loadCollectionsBoard } from "@/lib/collections-board";
import { getOpenTicketCollectionIds } from "@/lib/tickets";
import {
  kyivCustomPeriodBounds,
  kyivPeriodBounds,
  type CollectionPeriodPreset,
} from "@/lib/kyiv-date";

export const runtime = "nodejs";

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
    const url = new URL(req.url);
    const period = (url.searchParams.get("period") || "month") as CollectionPeriodPreset;
    const fromKey = url.searchParams.get("from") || "";
    const toKey = url.searchParams.get("to") || "";
    const technicianRaw = url.searchParams.get("technicianId");
    const technicianId = technicianRaw ? parseInt(technicianRaw, 10) : NaN;

    const bounds =
      period === "custom"
        ? kyivCustomPeriodBounds(fromKey, toKey)
        : period === "day" || period === "week" || period === "month"
          ? kyivPeriodBounds(period)
          : kyivPeriodBounds("month");

    if (!bounds) {
      return new NextResponse("Некоректний період", { status: 400 });
    }

    const openTicketIds = await getOpenTicketCollectionIds().catch(() => new Set<number>());
    const board = await loadCollectionsBoard({
      from: bounds.from,
      to: bounds.to,
      technicianId:
        Number.isInteger(technicianId) && technicianId > 0 ? technicianId : null,
      openTicketIds,
    });

    return NextResponse.json({
      ...board,
      fromKey: bounds.fromKey,
      toKey: bounds.toKey,
    });
  } catch (error) {
    const denied = accessErrorResponse(error);
    if (denied) return denied;
    console.error("[COLLECTIONS_BOARD]", error);
    return new NextResponse("Internal error", { status: 500 });
  }
}
