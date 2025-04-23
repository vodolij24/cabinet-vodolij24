import { NextResponse } from 'next/server';

import prismadb from '@/lib/prismadb';
import { auth } from '@clerk/nextjs/server';
 
export async function POST(
  req: Request,
  { params }: { params: { storeId: string } }
) {
  try {
    const { userId } = await auth();

    const body = await req.json();

    const { name, chat_id, phone, registration_number } = body;

    if (!userId) {
      return new NextResponse("Unauthenticated", { status: 403 });
    }

    if (!name) {
      return new NextResponse("Name is required", { status: 400 });
    }

    if (!chat_id) {
      return new NextResponse("Value is required", { status: 400 });
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
    const driver = await prismadb.drivers.create({
      data: {
        name,
        chat_id,
        phone,
        registration_number
      }
    });
  
    return NextResponse.json(driver.id);
  } catch (error) {
    console.log('[DRIVER_POST]', error);
    return new NextResponse("Internal error", { status: 500 });
  }
};

export async function GET(
  req: Request,
  { params }: { params: { storeId: string } }
) {
  try {
    /*
    if (!params.storeId) {
      return new NextResponse("Store id is required", { status: 400 });
    }
    */
    const sizes = await prismadb.drivers.findMany({
      where: {
      /*  storeId: params.storeId */
      }
    });
  
    return NextResponse.json(sizes);
  } catch (error) {
    console.log('[DRIVER_GET]', error);
    return new NextResponse("Internal error", { status: 500 });
  }
};
