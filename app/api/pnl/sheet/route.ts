import { NextResponse } from "next/server";

import { assertApprovedAccess } from "@/lib/cabinet-access";
import { isPeriodKey } from "@/lib/finance-month";
import { isPnlSheetKind } from "@/lib/pnl-constants";
import { savePnlSheetUpload } from "@/lib/pnl";
import { ingestPnlSpreadsheet } from "@/lib/pnl-sheet";

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

export async function POST(req: Request) {
  try {
    await assertApprovedAccess();
    const form = await req.formData();
    const periodKey = String(form.get("periodKey") || "");
    const kind = form.get("kind");
    const file = form.get("file");

    if (!isPeriodKey(periodKey)) {
      return new NextResponse("Некоректний місяць", { status: 400 });
    }
    if (!isPnlSheetKind(kind)) {
      return new NextResponse("Некоректний тип файлу", { status: 400 });
    }
    if (!(file instanceof File) || file.size === 0) {
      return new NextResponse("Додайте файл таблиці", { status: 400 });
    }

    const ingested = await ingestPnlSpreadsheet({ periodKey, kind, file });
    if ("error" in ingested) {
      return new NextResponse(ingested.error, { status: 400 });
    }

    try {
      const data = await savePnlSheetUpload(periodKey, kind, ingested);
      return NextResponse.json(data);
    } catch (error) {
      if (error instanceof Error && error.message === "SHEET_LOCKED") {
        return new NextResponse("Спочатку натисніть «Редагувати»", {
          status: 400,
        });
      }
      throw error;
    }
  } catch (error) {
    const denied = accessErrorResponse(error);
    if (denied) return denied;
    console.error("[PNL_SHEET_POST]", error);
    return new NextResponse("Internal error", { status: 500 });
  }
}
