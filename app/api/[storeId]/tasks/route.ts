import { NextResponse } from 'next/server';

import prismadb from '@/lib/prismadb';
import { auth } from '@clerk/nextjs/server';
 
export async function POST(
  req: Request,
  //{ params }: { params: { storeId: string } }
) {
  try {
    const { userId } = await auth();

    const body = await req.json();

    const { title, deviceId, description, priority } = body;

    if (!userId) {
      return new NextResponse("Unauthenticated", { status: 403 });
    }

    if (!title) {
      return new NextResponse("Title is required", { status: 400 });
    }

    if (!priority) {
      return new NextResponse("Priority is required", { status: 400 });
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
*/  console.log(title, priority)
    const task = await prismadb.tasks.create({
      data: {
        title,
        deviceId,
        description,
        priority,
        status: 'todo'
      }
    });
  
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
