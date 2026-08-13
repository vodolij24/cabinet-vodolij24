import { NextResponse } from "next/server";

import prismadb from "@/lib/prismadb";
import { assertApprovedAccess } from "@/lib/cabinet-access";
import {
  machineLabel,
  parseCollectionDateTime,
  parseCount,
  parseMoney,
  resolveCollectionTechnician,
} from "@/lib/collections";

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

function parseId(raw: string) {
  const id = parseInt(raw, 10);
  return Number.isFinite(id) && id > 0 ? id : null;
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ collectionId: string }> }
) {
  try {
    await assertApprovedAccess();
    const { collectionId } = await params;
    const id = parseId(collectionId);
    if (!id) {
      return new NextResponse("Collection id is required", { status: 400 });
    }

    const row = await prismadb.collections.findUnique({
      where: { id },
    });
    if (!row) {
      return new NextResponse("Not found", { status: 404 });
    }

    return NextResponse.json(row);
  } catch (error) {
    const denied = accessErrorResponse(error);
    if (denied) return denied;
    console.error("[COLLECTION_GET]", error);
    return new NextResponse("Internal error", { status: 500 });
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ collectionId: string }> }
) {
  try {
    await assertApprovedAccess();
    const { collectionId } = await params;
    const id = parseId(collectionId);
    if (!id) {
      return new NextResponse("Collection id is required", { status: 400 });
    }

    const existing = await prismadb.collections.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!existing) {
      return new NextResponse("Not found", { status: 404 });
    }

    const body = await req.json();

    const deviceId = parseInt(String(body?.deviceId ?? ""), 10);
    if (!Number.isFinite(deviceId) || deviceId <= 0) {
      return new NextResponse("Оберіть автомат", { status: 400 });
    }

    const date = parseCollectionDateTime(body?.date, body?.time);
    if (!date) {
      return new NextResponse("Вкажіть дату і час інкасації", { status: 400 });
    }

    const countCoins = parseCount(body?.countCoins);
    const sumCoins = parseMoney(body?.sumCoins);
    const countBanknotes = parseCount(body?.countBanknotes);
    const sumBanknotes = parseMoney(body?.sumBanknotes);

    if (
      countCoins == null ||
      sumCoins == null ||
      countBanknotes == null ||
      sumBanknotes == null
    ) {
      return new NextResponse(
        "Кількість і суми монет та купюр мають бути невідʼємними",
        { status: 400 }
      );
    }

    const resolved = await resolveCollectionTechnician(deviceId);
    if (resolved.error || !resolved.machine) {
      return new NextResponse(resolved.error || "Автомат не знайдено", {
        status: 400,
      });
    }

    const total = Math.round((sumCoins + sumBanknotes) * 100) / 100;
    const note =
      typeof body?.note === "string" && body.note.trim()
        ? body.note.trim()
        : null;

    const row = await prismadb.collections.update({
      where: { id },
      data: {
        date,
        device_id: deviceId,
        machine: machineLabel(resolved.machine),
        technicianId: resolved.machine.technicianId,
        count_coins: countCoins,
        sum_coins: sumCoins,
        count_banknotes: countBanknotes,
        sum_banknotes: sumBanknotes,
        total_sum: total,
        note,
        updated_at: new Date(),
      },
    });

    return NextResponse.json(row);
  } catch (error) {
    const denied = accessErrorResponse(error);
    if (denied) return denied;
    console.error("[COLLECTION_PATCH]", error);
    return new NextResponse("Internal error", { status: 500 });
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ collectionId: string }> }
) {
  try {
    await assertApprovedAccess();
    const { collectionId } = await params;
    const id = parseId(collectionId);
    if (!id) {
      return new NextResponse("Collection id is required", { status: 400 });
    }

    const row = await prismadb.collections.delete({
      where: { id },
    });

    return NextResponse.json(row.id);
  } catch (error) {
    const denied = accessErrorResponse(error);
    if (denied) return denied;
    console.error("[COLLECTION_DELETE]", error);
    return new NextResponse("Internal error", { status: 500 });
  }
}
