import { NextResponse } from "next/server";

import prismadb from "@/lib/prismadb";
//import { auth } from "@clerk/nextjs/server";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ driverId: string }> }
) {
  try {
    if (!(await params).driverId) {
      return new NextResponse("Driver id is required", { status: 400 });
    }

    const size = await prismadb.daily_statistics.findUnique({
      where: {
        id: Number((await params).driverId),
      },
    });

    return NextResponse.json(size?.id);
  } catch (error) {
    console.log("[DRIVER_GET]", error);
    return new NextResponse("Internal error", { status: 500 });
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ driverId: string; storeId: string }> }
) {
  try {
    //const { userId } = await auth();
    /*/
    if (!userId) {
      return new NextResponse("Unauthenticated", { status: 403 });
    }
    */
    if (!(await params).driverId) {
      return new NextResponse("Driver id is required", { status: 400 });
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
    const size = await prismadb.daily_statistics.delete({
      where: {
        id: Number((await params).driverId),
      },
    });

    return NextResponse.json(size.id);
  } catch (error) {
    console.log("[DRIVER_DELETE]", error);
    return new NextResponse("Internal error", { status: 500 });
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ driverId: string; storeId: string }> }
) {
  try {
    //const { userId } = await auth();

    const body = await req.json();

    const { name, phone, registration_number, chat_id } = body;
    /*
    if (!userId) {
      return new NextResponse("Unauthenticated", { status: 403 });
    }
*/
    if (!name) {
      return new NextResponse("Name is required", { status: 400 });
    }

    if (!chat_id) {
      return new NextResponse("Chat id is required", { status: 400 });
    }

    if (!phone) {
      return new NextResponse("phone is required", { status: 400 });
    }

    if (!registration_number) {
      return new NextResponse("registration_number is required", {
        status: 400,
      });
    }

    if (!(await params).driverId) {
      return new NextResponse("Driver id is required", { status: 400 });
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
    const driver = await prismadb.daily_statistics.update({
      where: {
        id: Number((await params).driverId),
      },
      data: {
      },
    });

    return NextResponse.json(driver.id);
  } catch (error) {
    console.log("[DRIVER_PATCH]", error);
    return new NextResponse("Internal error", { status: 500 });
  }
}
