import { NextResponse } from "next/server";

import { isPhoneRouteParam } from "@/lib/phone";
import {
  getCollectionSyncState,
  syncTechnicianCollections,
} from "@/lib/soliton-collections";
import { findTechnicianByPhoneDigits } from "@/lib/technician-public";

export const runtime = "nodejs";
export const maxDuration = 60;
export const dynamic = "force-dynamic";

async function resolveTechnician(phone: string) {
  if (!isPhoneRouteParam(phone)) return null;
  return findTechnicianByPhoneDigits(phone);
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ phone: string }> }
) {
  try {
    const { phone } = await params;
    const technician = await resolveTechnician(phone);
    if (!technician) {
      return new NextResponse("Not found", { status: 404 });
    }
    const state = await getCollectionSyncState(technician.id);
    return NextResponse.json({ state });
  } catch (error) {
    console.error("[TECHNICIAN_COLLECTION_SYNC_GET]", error);
    return new NextResponse("Internal error", { status: 500 });
  }
}

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ phone: string }> }
) {
  try {
    const { phone } = await params;
    const technician = await resolveTechnician(phone);
    if (!technician) {
      return new NextResponse("Not found", { status: 404 });
    }
    const result = await syncTechnicianCollections(technician.id);
    return NextResponse.json(result);
  } catch (error) {
    console.error("[TECHNICIAN_COLLECTION_SYNC_POST]", error);
    return new NextResponse("Internal error", { status: 500 });
  }
}
