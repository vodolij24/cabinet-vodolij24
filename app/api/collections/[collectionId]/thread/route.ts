import { NextResponse } from "next/server";

import { assertApprovedAccess } from "@/lib/cabinet-access";
import { currentUser } from "@clerk/nextjs/server";
import {
  addCollectionComment,
  claimCollectionReview,
  closeCollectionManual,
  listCollectionComments,
  listCollectionStatusEvents,
} from "@/lib/collection-lifecycle";
import type { CollectionActor } from "@/lib/collection-status";

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

async function reconcilerActor(): Promise<CollectionActor> {
  const user = await currentUser();
  const name =
    [user?.firstName, user?.lastName].filter(Boolean).join(" ") ||
    user?.username ||
    user?.primaryEmailAddress?.emailAddress ||
    "Звіряльник";
  return { role: "reconciler", id: user?.id ?? null, name };
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ collectionId: string }> }
) {
  try {
    await assertApprovedAccess();
    const { collectionId } = await params;
    const id = parseInt(collectionId, 10);
    if (!Number.isInteger(id) || id <= 0) {
      return new NextResponse("Invalid id", { status: 400 });
    }
    const [comments, events] = await Promise.all([
      listCollectionComments(id),
      listCollectionStatusEvents(id),
    ]);
    return NextResponse.json({ comments, events });
  } catch (error) {
    const denied = accessErrorResponse(error);
    if (denied) return denied;
    console.error("[COLLECTION_THREAD_GET]", error);
    return new NextResponse("Internal error", { status: 500 });
  }
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ collectionId: string }> }
) {
  try {
    await assertApprovedAccess();
    const { collectionId } = await params;
    const id = parseInt(collectionId, 10);
    if (!Number.isInteger(id) || id <= 0) {
      return new NextResponse("Invalid id", { status: 400 });
    }
    const body = await req.json();
    const actor = await reconcilerActor();
    const action = String(body?.action ?? "comment");

    if (action === "claim") {
      await claimCollectionReview({ collectionId: id, actor });
      return NextResponse.json({ ok: true });
    }
    if (action === "close") {
      await closeCollectionManual({
        collectionId: id,
        actor,
        reason: String(body?.reason ?? body?.body ?? ""),
      });
      return NextResponse.json({ ok: true });
    }

    const comment = await addCollectionComment({
      collectionId: id,
      actor,
      body: String(body?.body ?? body?.comment ?? ""),
    });
    await claimCollectionReview({ collectionId: id, actor }).catch(() => {});
    return NextResponse.json({ comment });
  } catch (error) {
    const denied = accessErrorResponse(error);
    if (denied) return denied;
    const code = error instanceof Error ? error.message : "";
    if (code === "COMMENT_REQUIRED" || code === "REASON_REQUIRED") {
      return new NextResponse("Напишіть коментар / причину", { status: 400 });
    }
    if (code === "NOT_IN_REVIEW") {
      return new NextResponse("Інкасація не в черзі «На розгляді»", {
        status: 400,
      });
    }
    if (code === "ALREADY_CLOSED") {
      return new NextResponse("Вже закрито вручну", { status: 400 });
    }
    console.error("[COLLECTION_THREAD_POST]", error);
    return new NextResponse("Internal error", { status: 500 });
  }
}
