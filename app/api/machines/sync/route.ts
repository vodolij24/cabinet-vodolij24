import { NextResponse } from "next/server";

import { assertApprovedAccess } from "@/lib/cabinet-access";
import { syncMachinesFromSoliton } from "@/lib/soliton-devices";
import { syncWaterMetricsFromSoliton } from "@/lib/soliton-water-metrics";

export async function POST() {
  try {
    await assertApprovedAccess();
    const devices = await syncMachinesFromSoliton();
    const metrics = await syncWaterMetricsFromSoliton();
    return NextResponse.json({ ...devices, metrics });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message === "UNAUTHORIZED") {
      return new NextResponse("Unauthenticated", { status: 401 });
    }
    if (message === "FORBIDDEN") {
      return new NextResponse("Forbidden", { status: 403 });
    }
    console.error("[MACHINES_SYNC]", error);
    return new NextResponse("Internal error", { status: 500 });
  }
}
