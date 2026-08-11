import { NextResponse } from "next/server";

import { assertApprovedAccess } from "@/lib/cabinet-access";
import prismadb from "@/lib/prismadb";

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

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await assertApprovedAccess();
    const { id: raw } = await params;
    const id = parseInt(raw, 10);
    if (!Number.isFinite(id)) {
      return new NextResponse("Invalid id", { status: 400 });
    }

    await prismadb.technicianManualBonus.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    const denied = accessErrorResponse(error);
    if (denied) return denied;
    console.error("[FINANCE_BONUS_DELETE]", error);
    return new NextResponse("Internal error", { status: 500 });
  }
}
