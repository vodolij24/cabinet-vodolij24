import { NextResponse } from "next/server";

import { isPhoneRouteParam } from "@/lib/phone";
import { findTechnicianByPhoneDigits } from "@/lib/technician-public";
import {
  addCollectionComment,
  listCollectionComments,
} from "@/lib/collection-lifecycle";
import prismadb from "@/lib/prismadb";

export const runtime = "nodejs";

async function assertOwnCollection(technicianId: number, collectionId: number) {
  const machines = await prismadb.vending_machines.findMany({
    where: { technicianId },
    select: { id: true },
  });
  const ids = machines.map((m) => m.id);
  const rows = await prismadb.$queryRawUnsafe<Array<{ id: number }>>(
    `SELECT id FROM collections
     WHERE id = ${collectionId}
       AND (
         "technicianId" = ${technicianId}
         ${ids.length ? `OR device_id IN (${ids.join(",")})` : ""}
       )
     LIMIT 1`
  );
  return Boolean(rows[0]);
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ phone: string; collectionId: string }> }
) {
  try {
    const { phone, collectionId } = await params;
    if (!isPhoneRouteParam(phone)) {
      return new NextResponse("Not found", { status: 404 });
    }
    const technician = await findTechnicianByPhoneDigits(phone);
    if (!technician) return new NextResponse("Not found", { status: 404 });
    const id = parseInt(collectionId, 10);
    if (!Number.isInteger(id) || id <= 0) {
      return new NextResponse("Invalid id", { status: 400 });
    }
    if (!(await assertOwnCollection(technician.id, id))) {
      return new NextResponse("Not found", { status: 404 });
    }
    const comments = await listCollectionComments(id);
    return NextResponse.json({ comments });
  } catch (error) {
    console.error("[TECH_COMMENTS_GET]", error);
    return new NextResponse("Internal error", { status: 500 });
  }
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ phone: string; collectionId: string }> }
) {
  try {
    const { phone, collectionId } = await params;
    if (!isPhoneRouteParam(phone)) {
      return new NextResponse("Not found", { status: 404 });
    }
    const technician = await findTechnicianByPhoneDigits(phone);
    if (!technician) return new NextResponse("Not found", { status: 404 });
    const id = parseInt(collectionId, 10);
    if (!Number.isInteger(id) || id <= 0) {
      return new NextResponse("Invalid id", { status: 400 });
    }
    if (!(await assertOwnCollection(technician.id, id))) {
      return new NextResponse("Not found", { status: 404 });
    }
    const body = await req.json();
    const comment = await addCollectionComment({
      collectionId: id,
      actor: {
        role: "technician",
        id: technician.id,
        name: technician.name || `Технік #${technician.id}`,
      },
      body: String(body?.body ?? body?.comment ?? ""),
    });
    return NextResponse.json({ comment });
  } catch (error) {
    const code = error instanceof Error ? error.message : "";
    if (code === "COMMENT_REQUIRED") {
      return new NextResponse("Напишіть коментар", { status: 400 });
    }
    console.error("[TECH_COMMENTS_POST]", error);
    return new NextResponse("Internal error", { status: 500 });
  }
}
