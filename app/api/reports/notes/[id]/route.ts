import { NextResponse } from "next/server";

import { assertApprovedAccess } from "@/lib/cabinet-access";
import { deleteReportFundNote } from "@/lib/report-notes";

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
      return new NextResponse("Некоректна примітка", { status: 400 });
    }
    await deleteReportFundNote(id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const denied = accessErrorResponse(error);
    if (denied) return denied;
    console.error("[REPORT_NOTES_DELETE]", error);
    return new NextResponse("Internal error", { status: 500 });
  }
}
