import { NextResponse } from "next/server";
import prismadb from "@/lib/prismadb";
import { sendMainCustomerNotification } from "@/lib/telegram";

interface RouteParams {
  params: Promise<{
    storeId: string;
  }>;
}

export async function POST(req: Request, { params }: RouteParams) {
  try {
    const { storeId } = await params;
    const body = await req.json();

    // Тепер з форми приходить filterId (Int) та текст повідомлення
    const { filterId, messageText, testMode = true } = body;
    // Додав прапорець testMode (за замовчуванням true).
    // Якщо true — розсилка в телеграм НЕ йде, тільки логуємо в консоль результат.

    if (!filterId || !messageText) {
      return new NextResponse(
        "Missing required fields (filterId or messageText)",
        { status: 400 }
      );
    }

    // 1. Шукаємо фільтр у базі по його ID
    const dbFilter = await prismadb.mailingFilter.findUnique({
      where: { id: Number(filterId) },
    });

    if (!dbFilter) {
      return new NextResponse("Mailing filter not found", { status: 404 });
    }

    // 2. Парсимо умови фільтрації з рядка conditions
    let parsedConditions: any = {};
    try {
      parsedConditions = JSON.parse(dbFilter.conditions || "{}");
    } catch (e) {
      return new NextResponse("Invalid conditions JSON in database", {
        status: 500,
      });
    }

    // 3. Динамічно будуємо об'єкт фільтрації `where` для таблиці `users`
    const whereClause: any = {};

    // Фільтр по id (наприклад, [2, 3])
    if (parsedConditions.id && Array.isArray(parsedConditions.id)) {
      whereClause.id = { in: parsedConditions.id };
    }

    // Фільтр по улюбленому автомату (наприклад, 127)
    if (parsedConditions.favoriteDevice) {
      whereClause.favoriteDevice = parsedConditions.favoriteDevice.toString();
    }

    // --- НОВИЙ БЛОК ФІЛЬТРАЦІЇ ДАТИ (ДІАПАЗОНИ gte / lte) ---
    if (parsedConditions.updatedAt_lte || parsedConditions.updatedAt_gte) {
      whereClause.updatedAt = {};

      // Верхня межа: шукаємо тих, хто старіший за вказану дату (менше або дорівнює)
      if (parsedConditions.updatedAt_lte) {
        const dateLte = new Date(
          parsedConditions.updatedAt_lte.replace(" ", "T")
        );
        if (!isNaN(dateLte.getTime())) {
          whereClause.updatedAt.lte = dateLte;
        }
      }

      // Нижня межа: шукаємо новіших за вказану дату (більше або дорівнює)
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

    // 4. Робимо вибірку з таблиці users по нашому WHERE
    const targetUsers = await prismadb.users.findMany({
      where: whereClause,
      select: {
        chat_id: true,
        firstname: true,
      },
    });

    // Оскільки chat_id у вашій базі є BigInt, його обов'язково треба
    // перетворити в рядок, інакше JSON.stringify випаде в помилку
    const chatIds = targetUsers
      .filter((user) => user.chat_id !== null && user.chat_id !== undefined)
      .map((user) => user.chat_id.toString());

    // 5. Консольложимо аудит вибірки
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

    // 6. Безпечний тригер відправки (якщо НЕ тест-режим, то шлемо)
    if (!testMode) {
      console.log(
        `[LIVE] Запуск реальної розсилки на ${chatIds.length} користувачів...`
      );
      // Викликаємо вашу функцію відправки
      await sendMainCustomerNotification(chatIds, messageText);
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
