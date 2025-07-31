import { NextResponse } from 'next/server';
import axios from 'axios';

import prismadb from '@/lib/prismadb';
import { auth } from '@clerk/nextjs/server';
import { tasks } from '@/lib/generated/prisma';
import { sendTelegramTaskNotification } from '@/lib/telegram';


 
export async function POST(
  req: Request,
  //{ params }: { params: { storeId: string } }
) {
  try {
    const { userId } = await auth();

    const body = await req.json();

    const { title, deviceId, description, priority, workerId } = body;

    if (!userId) {
      return new NextResponse("Unauthenticated", { status: 403 });
    }

    if (!title) {
      return new NextResponse("Title is required", { status: 400 });
    }

    if (!priority) {
      return new NextResponse("Priority is required", { status: 400 });
    }

    if (!workerId) {
      return new NextResponse("WorkerId is required", { status: 400 });
    }

 console.log(title, priority)

    const task = await prismadb.tasks.create({
      data: {
        title,
        deviceId,
        description,
        priority,
        workerId: parseInt(workerId),
        status: 'todo'
      }
    });

    const worker = await prismadb.workers.findUnique({
      where: { id: parseInt(workerId) },
      select: { chat_id: true, name: true }
    });

    if (worker?.chat_id) {
      await sendTelegramTaskNotification(String(worker.chat_id), task, 'Нове завдання');
    }
  
    return NextResponse.json(task.id);
  } catch (error) {
    console.log('[TASK_POST]', error);
    return new NextResponse("Internal error", { status: 500 });
  }
};

export async function GET(
  //req: Request,
  //{ params }: { params: { storeId: string } }
) {
  try {
    /*
    if (!params.storeId) {
      return new NextResponse("Store id is required", { status: 400 });
    }
    */
    const task = await prismadb.tasks.findMany({
      where: {
      /*  storeId: params.storeId */
      }
    });
  
    return NextResponse.json(task);
  } catch (error) {
    console.log('[TASK_GET]', error);
    return new NextResponse("Internal error", { status: 500 });
  }
};
