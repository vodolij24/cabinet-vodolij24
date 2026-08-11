import { NextResponse } from "next/server";

import { isPhoneRouteParam } from "@/lib/phone";
import { findTechnicianByPhoneDigits } from "@/lib/technician-public";
import {
  createExpenseEntry,
  getTechnicianFinanceSnapshot,
  isPeriodKey,
} from "@/lib/finance-month";
import { currentPeriodKey } from "@/lib/task-fields";
import { savePhotoReport } from "@/lib/task-photos";

export const runtime = "nodejs";
export const maxDuration = 60;

async function readBody(req: Request): Promise<{
  periodKey: string;
  type: string;
  amount: string;
  comment: string;
  photos: File[];
}> {
  const contentType = req.headers.get("content-type") || "";
  if (contentType.includes("multipart/form-data")) {
    const form = await req.formData();
    const photos = form
      .getAll("photos")
      .filter((v): v is File => v instanceof File && v.size > 0);
    return {
      periodKey:
        typeof form.get("periodKey") === "string"
          ? String(form.get("periodKey")).trim()
          : currentPeriodKey(),
      type:
        typeof form.get("type") === "string"
          ? String(form.get("type")).trim()
          : "",
      amount:
        typeof form.get("amount") === "string"
          ? String(form.get("amount")).trim()
          : "",
      comment:
        typeof form.get("comment") === "string"
          ? String(form.get("comment")).trim()
          : "",
      photos,
    };
  }

  const body = await req.json();
  return {
    periodKey:
      typeof body?.periodKey === "string"
        ? body.periodKey.trim()
        : currentPeriodKey(),
    type: typeof body?.type === "string" ? body.type.trim() : "",
    amount: body?.amount != null ? String(body.amount).trim() : "",
    comment: typeof body?.comment === "string" ? body.comment.trim() : "",
    photos: [],
  };
}

export async function GET(
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

    const { searchParams } = new URL(req.url);
    const period = searchParams.get("period") || currentPeriodKey();
    if (!isPeriodKey(period)) {
      return new NextResponse("Invalid period", { status: 400 });
    }

    const snapshot = await getTechnicianFinanceSnapshot(technician.id, period);
    if (!snapshot) {
      return new NextResponse("Not found", { status: 404 });
    }

    return NextResponse.json({
      periodKey: period,
      finance: snapshot,
    });
  } catch (error) {
    console.error("[PUBLIC_TECH_FINANCE_GET]", error);
    return new NextResponse("Internal error", { status: 500 });
  }
}

/** Створює одну транзакцію: type=fuel|other (без редагування) */
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

    const body = await readBody(req);
    if (!isPeriodKey(body.periodKey)) {
      return new NextResponse("Invalid period", { status: 400 });
    }

    let photoUrls: string[] = [];
    if (body.photos.length > 0) {
      const saved = await savePhotoReport(
        `finance/${technician.id}/${body.periodKey}`,
        body.photos
      );
      if ("error" in saved) {
        return new NextResponse(saved.error, { status: 400 });
      }
      photoUrls = saved.urls;
    }

    const created = await createExpenseEntry({
      workerId: technician.id,
      periodKey: body.periodKey,
      type: body.type,
      amount: body.amount,
      comment: body.comment,
      photoUrls,
    });

    if ("error" in created) {
      return new NextResponse(created.error, { status: 400 });
    }

    const snapshot = await getTechnicianFinanceSnapshot(
      technician.id,
      body.periodKey
    );

    return NextResponse.json({
      periodKey: body.periodKey,
      entry: created.entry,
      finance: snapshot,
    });
  } catch (error) {
    console.error("[PUBLIC_TECH_FINANCE_POST]", error);
    return new NextResponse("Internal error", { status: 500 });
  }
}
