import { NextResponse } from "next/server";

import prismadb from "@/lib/prismadb";

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
  { params }: { params: Promise<{ driverId: string }> }
) {
  try {
    if (!(await params).driverId) {
      return new NextResponse("Driver id is required", { status: 400 });
    }

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
  { params }: { params: Promise<{ driverId: string }> }
) {
  try {
    const body = await req.json();

    const { name, phone, registration_number, chat_id } = body;

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

    const driver = await prismadb.daily_statistics.update({
      where: {
        id: Number((await params).driverId),
      },
      data: {},
    });

    return NextResponse.json(driver.id);
  } catch (error) {
    console.log("[DRIVER_PATCH]", error);
    return new NextResponse("Internal error", { status: 500 });
  }
}
