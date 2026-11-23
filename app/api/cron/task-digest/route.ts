import { NextResponse } from "next/server";

import { sendThursdayTaskDigests } from "@/lib/task-digest";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isAuthorized(req: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization");
  if (secret) {
    return (
      auth === `Bearer ${secret}` ||
      new URL(req.url).searchParams.get("secret") === secret
    );
  }
  if (req.headers.get("x-vercel-cron") === "1") return true;
  return process.env.NODE_ENV !== "production";
}

/** Четвер 14:00 за Києвом (12:00 UTC). */
export async function GET(req: Request) {
  if (!isAuthorized(req)) {
    return new NextResponse("Unauthorized", { status: 401 });
  }
  try {
    const result = await sendThursdayTaskDigests();
    return NextResponse.json({
      ok: true,
      at: new Date().toISOString(),
      ...result,
    });
  } catch (error) {
    console.error("[CRON_TASK_DIGEST]", error);
    return new NextResponse("Internal error", { status: 500 });
  }
}
