import axios from "axios";
import { tasks } from "@/lib/generated/prisma";

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

const MAIN_BOT_TOKEN = process.env.MAIN_TG_BOT_TOKEN;

export async function sendTelegramTaskNotification(
  chatId: string,
  task: tasks,
  status: string
) {
  const message = `📝 ${status}:

📌 *${task.title}*
🗒️ ${task.description || "Без опису"}
📟 Апарат №: ${task.deviceId || "Невідомо"}
🎯 Пріоритет: ${task.priority || "Не вказано"}`;

  try {
    await axios.post(
      `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`,
      {
        chat_id: chatId,
        text: message,
        parse_mode: "Markdown",
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: "✅ Виконано",
                callback_data: `done_${task.id}`,
              },
            ],
          ],
        },
      }
    );
  } catch (err) {
    console.error("Помилка при надсиланні повідомлення в Telegram:", err);
  }
}

export async function sendMainCustomerNotification(
  chatIds: string[],
  text: string // або ваші tasks
) {
  const message = text;

  // Цикл for...of дозволяє коректно обробляти await для кожного ID окремо
  for (const chatId of chatIds) {
    try {
      await axios.post(
        `https://api.telegram.org/bot${MAIN_BOT_TOKEN}/sendMessage`,
        {
          chat_id: chatId,
          text: message,
          parse_mode: "Markdown",
        }
      );
    } catch (err) {
      // Якщо сталася помилка з одним ID, виводимо її, але не зупиняємо цикл для інших
      console.error(
        `Помилка при надсиланні повідомлення в Telegram для ID ${chatId}:`,
        err
      );
    }
  }
}
