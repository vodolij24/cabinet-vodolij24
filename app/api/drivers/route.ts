import { NextResponse } from "next/server";

import prismadb from "@/lib/prismadb";
import { auth } from "@clerk/nextjs/server";

export async function POST(req: Request) {
  try {
    const { userId } = await auth();

    const body = await req.json();

    const { name, chat_id } = body;

    if (!userId) {
      return new NextResponse("Unauthenticated", { status: 403 });
    }

    if (!name) {
      return new NextResponse("Name is required", { status: 400 });
    }

    if (!chat_id) {
      return new NextResponse("Value is required", { status: 400 });
    }

    return new NextResponse("Not implemented", { status: 501 });
  } catch (error) {
    console.log("[DRIVER_POST]", error);
    return new NextResponse("Internal error", { status: 500 });
  }
}

export async function GET() {
  try {
    const statistics = await prismadb.daily_statistics.findMany({
      where: {},
    });

    return NextResponse.json(statistics);
  } catch (error) {
    console.log("[DRIVER_GET]", error);
    return new NextResponse("Internal error", { status: 500 });
  }
}
