import { NextResponse } from "next/server";
import axios from 'axios';

import prismadb from "@/lib/prismadb";
import { sendTelegramTaskNotification } from "@/lib/telegram";
//import { auth } from "@clerk/nextjs/server";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ taskId: string }> }
) {
  try {
    if (!(await params).taskId) {
      return new NextResponse("Task id is required", { status: 400 });
    }

    const task = await prismadb.tasks.findUnique({
      where: {
        id: Number((await params).taskId),
      },
    });

    return NextResponse.json(task?.id);
  } catch (error) {
    console.log("[TASK_GET]", error);
    return new NextResponse("Internal error", { status: 500 });
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ taskId: string; storeId: string }> }
) {
  try {
    //const { userId } = await auth();
    /*/
    if (!userId) {
      return new NextResponse("Unauthenticated", { status: 403 });
    }
    */
    if (!(await params).taskId) {
      return new NextResponse("Task id is required", { status: 400 });
    }
    /*
    const storeByUserId = await prismadb.store.findFirst({
      where: {
        id: params.storeId,
        userId
      }
    });

    if (!storeByUserId) {
      return new NextResponse("Unauthorized", { status: 405 });
    }
*/
    const task = await prismadb.tasks.delete({
      where: {
        id: Number((await params).taskId),
      },
    });

    return NextResponse.json(task.id);
  } catch (error) {
    console.log("[TASK_DELETE]", error);
    return new NextResponse("Internal error", { status: 500 });
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ taskId: string; storeId: string }> }
) {
  try {
    //const { userId } = await auth();

    const body = await req.json();

    const { title, description, deviceId, priority, workerId } = body;
    /*
    if (!userId) {
      return new NextResponse("Unauthenticated", { status: 403 });
    }
*/
    if (!title) {
      return new NextResponse("Title is required", { status: 400 });
    }


    if (!(await params).taskId) {
      return new NextResponse("Task id is required", { status: 400 });
    }
    /*
    const storeByUserId = await prismadb.store.findFirst({
      where: {
        id: params.storeId,
        userId
      }
    });

    if (!storeByUserId) {
      return new NextResponse("Unauthorized", { status: 405 });
    }
*/
    const task = await prismadb.tasks.update({
      where: {
        id: Number((await params).taskId),
      },
      data: {
        title,
        description,
        deviceId,
        priority,
        workerId: parseInt(workerId),
      },
    });

    const worker = await prismadb.workers.findUnique({
      where: { id: parseInt(workerId) },
      select: { chat_id: true, name: true }
    });

    if (worker?.chat_id) {
      await sendTelegramTaskNotification(String(worker.chat_id), task, 'Завдання змінено');
    }

    return NextResponse.json(task.id);
  } catch (error) {
    console.log("[TASK_PATCH]", error);
    return new NextResponse("Internal error", { status: 500 });
  }
}
