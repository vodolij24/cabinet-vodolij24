import { NextResponse } from "next/server";

import prismadb from "@/lib/prismadb";
import { isPhoneRouteParam } from "@/lib/phone";
import { findTechnicianByPhoneDigits } from "@/lib/technician-public";
import {
  isTechnicianActionableStatus,
  TASK_STATUS,
} from "@/lib/task-fields";
import { saveTaskPhotoReport } from "@/lib/task-photos";

export const runtime = "nodejs";

async function readBody(req: Request): Promise<{
  action: string | null;
  comment: string;
  reason: string;
  photos: File[];
}> {
  const contentType = req.headers.get("content-type") || "";
  if (contentType.includes("multipart/form-data")) {
    const form = await req.formData();
    const photos = form
      .getAll("photos")
      .filter((v): v is File => v instanceof File && v.size > 0);
    return {
      action: typeof form.get("action") === "string" ? String(form.get("action")) : null,
      comment:
        typeof form.get("comment") === "string"
          ? String(form.get("comment")).trim()
          : "",
      reason:
        typeof form.get("reason") === "string"
          ? String(form.get("reason")).trim()
          : "",
      photos,
    };
  }

  const body = await req.json();
  return {
    action: typeof body?.action === "string" ? body.action : null,
    comment: typeof body?.comment === "string" ? body.comment.trim() : "",
    reason: typeof body?.reason === "string" ? body.reason.trim() : "",
    photos: [],
  };
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ phone: string; taskId: string }> }
) {
  try {
    const { phone, taskId } = await params;
    if (!isPhoneRouteParam(phone)) {
      return new NextResponse("Not found", { status: 404 });
    }

    const technician = await findTechnicianByPhoneDigits(phone);
    if (!technician) {
      return new NextResponse("Not found", { status: 404 });
    }

    const id = parseInt(taskId, 10);
    if (!Number.isFinite(id)) {
      return new NextResponse("Invalid task", { status: 400 });
    }

    const task = await prismadb.tasks.findUnique({ where: { id } });
    if (!task || task.workerId !== technician.id) {
      return new NextResponse("Not found", { status: 404 });
    }

    if (!isTechnicianActionableStatus(task.status)) {
      return new NextResponse("Задача вже оброблена", { status: 409 });
    }

    const { action, comment, reason, photos } = await readBody(req);

    if (action === "complete") {
      if (!comment) {
        return new NextResponse("Коментар обовʼязковий", { status: 400 });
      }

      let photoUrls: string[] = [];
      if (photos.length > 0) {
        const saved = await saveTaskPhotoReport(id, photos);
        if ("error" in saved) {
          return new NextResponse(saved.error, { status: 400 });
        }
        photoUrls = saved.urls;
      }

      const updated = await prismadb.tasks.update({
        where: { id },
        data: {
          status: TASK_STATUS.awaiting_manager_confirm,
          technicianComment: comment,
          rejectReason: null,
          photoUrls: photoUrls.length ? JSON.stringify(photoUrls) : null,
          completedAt: new Date(),
        },
      });

      return NextResponse.json({
        id: updated.id,
        status: updated.status,
        photoUrls,
      });
    }

    if (action === "reject") {
      if (!reason) {
        return new NextResponse("Причина відхилення обовʼязкова", {
          status: 400,
        });
      }

      let photoUrls: string[] = [];
      if (photos.length > 0) {
        const saved = await saveTaskPhotoReport(id, photos);
        if ("error" in saved) {
          return new NextResponse(saved.error, { status: 400 });
        }
        photoUrls = saved.urls;
      }

      const updated = await prismadb.tasks.update({
        where: { id },
        data: {
          status: TASK_STATUS.awaiting_manager_decision,
          rejectReason: reason,
          technicianComment: null,
          photoUrls: photoUrls.length ? JSON.stringify(photoUrls) : null,
          completedAt: null,
        },
      });

      return NextResponse.json({
        id: updated.id,
        status: updated.status,
        photoUrls,
      });
    }

    return new NextResponse("Invalid action", { status: 400 });
  } catch (error) {
    console.error("[PUBLIC_TECH_TASK_ACTION]", error);
    return new NextResponse("Internal error", { status: 500 });
  }
}
