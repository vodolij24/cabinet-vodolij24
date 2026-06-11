import { NextResponse } from "next/server";
import prismadb from "@/lib/prismadb";
import { sendMainCustomerNotification } from "@/lib/telegram";
import { text } from "stream/consumers";

interface RouteParams {
  params: Promise<{
    storeId: string;
  }>;
}

export async function POST(req: Request, { params }: RouteParams) {
  try {
    // 1. Отримуємо дані з тіла запиту
    const { storeId } = await params;
    const body = await req.json();
    const { targetGroup, messageText } = body;

    // Валідація вхідних даних
    if (!targetGroup || !messageText) {
      return new NextResponse("Missing required fields", { status: 400 });
    }

    // Масив для збереження значень chat_id, кому будемо відправляти
    let chatIds: string[] = [];

    // 2. Обробка тестової розсилки для адміністраторів
    if (targetGroup === "test") {
      // Шукаємо користувачів з id 1 та 2 в таблиці Apiusers
      const admins = await prismadb.apiusers.findMany({
        where: {
          id: {
            in: [1, 2],
          },
        },
        select: {
          chat_id: true, // Беремо тільки chat_id, щоб не тащити зайві дані
        },
      });

      // Збираємо чисті chat_id в один масив (відфільтровуємо null/undefined, якщо вони є)
      const chatIds = admins.map((admin: any) => admin.chat_id.toString());

      console.log("Знайдені chat_id адмінів:", chatIds);

      if (chatIds.length === 0) {
        return new NextResponse("Адміністраторів з chat_id не знайдено", {
          status: 404,
        });
      }
    }

    // Тут в майбутньому будуть else if для "all" та "active_only"
    else {
      return new NextResponse("Логіка для цієї групи ще не реалізована", {
        status: 500,
      });
    }

    // 3. Тимчасовий затичок (Placeholder) для відправки в Telegram
    // Тут ми далі підключимо Telegraf або звичайний fetch/axios до Telegram API
    console.log(`Надсилаємо повідомлення: "${messageText}" для ID:`, chatIds);

    sendMainCustomerNotification(chatIds, messageText);

    // Повертаємо успішну відповідь на фронтенд
    return NextResponse.json({
      success: true,
      message: `Знайдено адмінів: ${chatIds.length}. Готово до відправки.`,
      recipientsCount: chatIds.length,
    });
  } catch (error) {
    console.error("[MAILINGS_POST]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}
