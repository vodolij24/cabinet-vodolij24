import { NextResponse } from "next/server";
import prismadb from "@/lib/prismadb";
import { sendMainCustomerNotification } from "@/lib/telegram";

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const { filterId, messageText, testMode } = body;

    if (!filterId || !messageText) {
      return new NextResponse(
        "Missing required fields (filterId or messageText)",
        { status: 400 }
      );
    }

    const dbFilter = await prismadb.mailingFilter.findUnique({
      where: { id: Number(filterId) },
    });

    if (!dbFilter) {
      return new NextResponse("Mailing filter not found", { status: 404 });
    }

    let parsedConditions: any = {};
    try {
      parsedConditions = JSON.parse(dbFilter.conditions || "{}");
    } catch (e) {
      return new NextResponse("Invalid conditions JSON in database", {
        status: 500,
      });
    }

    const whereClause: any = {};

    if (parsedConditions.id && Array.isArray(parsedConditions.id)) {
      whereClause.id = { in: parsedConditions.id };
    }

    if (parsedConditions.favoriteDevice) {
      whereClause.favoriteDevice = parsedConditions.favoriteDevice.toString();
    }

    if (parsedConditions.updatedAt_lte || parsedConditions.updatedAt_gte) {
      whereClause.updatedAt = {};

      if (parsedConditions.updatedAt_lte) {
        const dateLte = new Date(
          parsedConditions.updatedAt_lte.replace(" ", "T")
        );
        if (!isNaN(dateLte.getTime())) {
          whereClause.updatedAt.lte = dateLte;
        }
      }

      if (parsedConditions.updatedAt_gte) {
        const dateGte = new Date(
          parsedConditions.updatedAt_gte.replace(" ", "T")
        );
        if (!isNaN(dateGte.getTime())) {
          whereClause.updatedAt.gte = dateGte;
        }
      }
    }

    console.log(
      `[MAILING] Згенерований Prisma Where-запит для фільтра "${dbFilter.title}":`,
      JSON.stringify(whereClause)
    );

    const targetUsers = await prismadb.users.findMany({
      where: whereClause,
      select: {
        chat_id: true,
        firstname: true,
      },
    });

    const chatIds = targetUsers
      .filter((user) => user.chat_id !== null && user.chat_id !== undefined)
      .map((user) => user.chat_id.toString());

    console.log("==========================================");
    console.log(`ФІЛЬТР: ${dbFilter.title} (${dbFilter.name})`);
    console.log(`ЗНАЙДЕНО КОРИСТУВАЧІВ: ${targetUsers.length}`);
    console.log(`МАСИВ CHAT_ID:`, chatIds);
    console.log(`РЕЖИМ ТЕСТУВАННЯ (БЕЗ ВІДПРАВКИ): ${testMode}`);
    console.log("==========================================");

    if (chatIds.length === 0) {
      return NextResponse.json({
        success: true,
        message: `За вашими умовами не знайдено жодного користувача.`,
        recipientsCount: 0,
      });
    }

    if (!testMode) {
      console.log(
        `[LIVE] Запуск реальної розсилки на ${chatIds.length} користувачів...`
      );
      await sendMainCustomerNotification(chatIds, messageText);
      const delay = (ms: number) =>
        new Promise((resolve) => setTimeout(resolve, ms));
      await delay(12000);
    }

    return NextResponse.json({
      success: true,
      message: testMode
        ? `[ТЕСТ СФОРМОВАНО] Знайдено потенційних отримувачів: ${chatIds.length}. Розсилку не виконували.`
        : `Розсилку активовано для ${chatIds.length} користувачів!`,
      recipientsCount: chatIds.length,
      testMode,
    });
  } catch (error) {
    console.error("[MAILINGS_POST_ERROR]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}
