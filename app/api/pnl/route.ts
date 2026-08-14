import { NextResponse } from "next/server";

import { assertApprovedAccess } from "@/lib/cabinet-access";
import { parseMoney } from "@/lib/collection-fields";
import { isPeriodKey } from "@/lib/finance-month";
import { kyivPeriodKey, isPnlSheetKind } from "@/lib/pnl-constants";
import {
  getPnlPage,
  savePnlManual,
  savePnlSheetValues,
  savePnlStatic,
  type PnlManualValues,
  type PnlStaticValues,
} from "@/lib/pnl";

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

function moneyField(body: Record<string, unknown>, key: string) {
  if (body[key] == null || body[key] === "") return 0;
  return parseMoney(body[key]);
}

function parseAction(value: unknown): "save" | "accept" | "edit" | null {
  return value === "save" || value === "accept" || value === "edit"
    ? value
    : null;
}

export async function GET(req: Request) {
  try {
    await assertApprovedAccess();
    const period = new URL(req.url).searchParams.get("period") || kyivPeriodKey();
    if (!isPeriodKey(period)) {
      return new NextResponse("Некоректний місяць", { status: 400 });
    }
    const data = await getPnlPage(period);
    return NextResponse.json(data);
  } catch (error) {
    const denied = accessErrorResponse(error);
    if (denied) return denied;
    console.error("[PNL_GET]", error);
    return new NextResponse("Internal error", { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    await assertApprovedAccess();
    const body = (await req.json()) as Record<string, unknown>;
    const periodKey =
      typeof body.periodKey === "string" ? body.periodKey : kyivPeriodKey();
    if (!isPeriodKey(periodKey)) {
      return new NextResponse("Некоректний місяць", { status: 400 });
    }
    const action = parseAction(body.action);
    if (!action) {
      return new NextResponse("Вкажіть дію", { status: 400 });
    }
    const section = body.section;

    if (section === "manual") {
      const values: PnlManualValues = {
        otherIncome: moneyField(body, "otherIncome") ?? -1,
        kmitCash: moneyField(body, "kmitCash") ?? -1,
        rentTotal: moneyField(body, "rentTotal") ?? -1,
        salaryVolodymyr: moneyField(body, "salaryVolodymyr") ?? -1,
        salaryTerebenets: moneyField(body, "salaryTerebenets") ?? -1,
        marketing: moneyField(body, "marketing") ?? -1,
        simCards: moneyField(body, "simCards") ?? -1,
      };
      if (Object.values(values).some((n) => n < 0)) {
        return new NextResponse("Некоректна сума", { status: 400 });
      }
      const data = await savePnlManual(periodKey, values, action);
      return NextResponse.json(data);
    }

    if (section === "static") {
      const values: PnlStaticValues = {
        amortAuto: moneyField(body, "amortAuto") ?? -1,
        filterCost: moneyField(body, "filterCost") ?? -1,
        vchasno: moneyField(body, "vchasno") ?? -1,
        salaryCallcenter: moneyField(body, "salaryCallcenter") ?? -1,
        salaryTechdir: moneyField(body, "salaryTechdir") ?? -1,
        salaryFinmanager: moneyField(body, "salaryFinmanager") ?? -1,
        salaryOlena: moneyField(body, "salaryOlena") ?? -1,
      };
      if (Object.values(values).some((n) => n < 0)) {
        return new NextResponse("Некоректна сума", { status: 400 });
      }
      const data = await savePnlStatic(periodKey, values, action);
      return NextResponse.json(data);
    }

    if (section === "sheet") {
      if (!isPnlSheetKind(body.kind)) {
        return new NextResponse("Некоректний файл", { status: 400 });
      }
      const amount = moneyField(body, "amount");
      if (amount == null) {
        return new NextResponse("Вкажіть суму", { status: 400 });
      }
      const note = typeof body.note === "string" ? body.note : "";
      const data = await savePnlSheetValues(
        periodKey,
        body.kind,
        { amount, note },
        action
      );
      return NextResponse.json(data);
    }

    return new NextResponse("Некоректна секція", { status: 400 });
  } catch (error) {
    const denied = accessErrorResponse(error);
    if (denied) return denied;
    console.error("[PNL_PATCH]", error);
    return new NextResponse("Internal error", { status: 500 });
  }
}
