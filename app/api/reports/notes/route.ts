import { NextResponse } from "next/server";

import { assertApprovedAccess } from "@/lib/cabinet-access";
import {
  REPORT_FUNDS,
  createReportFundNote,
  type ReportFund,
} from "@/lib/report-notes";

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

function isPeriodKey(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}$/.test(value);
}

export async function POST(req: Request) {
  try {
    const access = await assertApprovedAccess();
    const body = await req.json();
    const fund = body?.fund;
    if (
      typeof fund !== "string" ||
      !(REPORT_FUNDS as readonly string[]).includes(fund)
    ) {
      return new NextResponse("Оберіть фонд", { status: 400 });
    }
    if (!isPeriodKey(body?.fromPeriod) || !isPeriodKey(body?.toPeriod)) {
      return new NextResponse("Оберіть місяці", { status: 400 });
    }
    if (body.fromPeriod === body.toPeriod) {
      return new NextResponse("Місяці мають бути різні", { status: 400 });
    }
    const text = typeof body?.body === "string" ? body.body.trim() : "";
    if (!text || text.length > 2000) {
      return new NextResponse("Напишіть примітку до 2000 символів", {
        status: 400,
      });
    }

    const note = await createReportFundNote({
      fund: fund as ReportFund,
      fromPeriod: body.fromPeriod,
      toPeriod: body.toPeriod,
      body: text,
      authorName: access.name?.trim() || access.email?.trim() || "Керівник",
      authorId: access.id,
    });
    return NextResponse.json(note);
  } catch (error) {
    const denied = accessErrorResponse(error);
    if (denied) return denied;
    console.error("[REPORT_NOTES_POST]", error);
    return new NextResponse("Internal error", { status: 500 });
  }
}
