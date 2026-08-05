import { NextResponse } from "next/server";

import {
  assertApprovedAccess,
  setCabinetUserStatus,
  type CabinetStatus,
} from "@/lib/cabinet-access";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const access = await assertApprovedAccess();
    const { userId } = await params;
    const body = await req.json();
    const status = body?.status as CabinetStatus;

    if (!userId) {
      return new NextResponse("User id is required", { status: 400 });
    }

    if (status !== "approved" && status !== "rejected" && status !== "pending") {
      return new NextResponse("Invalid status", { status: 400 });
    }

    if (userId === access.id && status === "rejected") {
      return new NextResponse("Cannot reject yourself", { status: 400 });
    }

    const updated = await setCabinetUserStatus(userId, status);
    return NextResponse.json({
      id: updated.id,
      status: updated.status,
      role: updated.role,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message === "UNAUTHORIZED") {
      return new NextResponse("Unauthenticated", { status: 401 });
    }
    if (message === "FORBIDDEN") {
      return new NextResponse("Forbidden", { status: 403 });
    }
    console.error("[SETTINGS_USER_PATCH]", error);
    return new NextResponse("Internal error", { status: 500 });
  }
}
