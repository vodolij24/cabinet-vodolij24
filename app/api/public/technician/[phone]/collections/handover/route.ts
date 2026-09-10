import { NextResponse } from "next/server";

import { isPhoneRouteParam } from "@/lib/phone";
import { findTechnicianByPhoneDigits } from "@/lib/technician-public";
import { createHandoverFromSelection } from "@/lib/collection-lifecycle";

export const runtime = "nodejs";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ phone: string }> }
) {
  try {
    const { phone } = await params;
    if (!isPhoneRouteParam(phone)) {
      return new NextResponse("Not found", { status: 404 });
    }
    const technician = await findTechnicianByPhoneDigits(phone);
    if (!technician) {
      return new NextResponse("Not found", { status: 404 });
    }

    const body = await req.json();
    const collectionIds = Array.isArray(body?.collectionIds)
      ? body.collectionIds.map((v: unknown) => parseInt(String(v), 10))
      : [];
    const cashierId = parseInt(String(body?.cashierId ?? ""), 10);
    if (!Number.isInteger(cashierId) || cashierId <= 0) {
      return new NextResponse("Оберіть касира", { status: 400 });
    }

    const result = await createHandoverFromSelection({
      technicianId: technician.id,
      technicianName: technician.name || `Технік #${technician.id}`,
      cashierId,
      collectionIds,
    });
    return NextResponse.json(result);
  } catch (error) {
    const code = error instanceof Error ? error.message : "";
    const map: Record<string, [string, number]> = {
      SELECT_PACKAGES: ["Оберіть пакети для здачі", 400],
      CASHIER_NOT_FOUND: ["Оберіть касира", 400],
      NOT_FOUND: ["Інкасацію не знайдено", 404],
      FORBIDDEN: ["Це не ваші інкасації", 403],
      ALREADY_HANDED: ["Пакети вже передані касиру", 400],
      NOT_ON_HAND: ["Можна здати лише пакети на руках", 400],
    };
    const mapped = map[code];
    if (mapped) return new NextResponse(mapped[0], { status: mapped[1] });
    console.error("[TECH_HANDOVER_POST]", error);
    return new NextResponse("Internal error", { status: 500 });
  }
}
