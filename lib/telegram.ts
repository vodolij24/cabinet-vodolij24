import axios from "axios";
import { tasks } from "@/lib/generated/prisma";

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

const MAIN_BOT_TOKEN = process.env.MAIN_TG_BOT_TOKEN;

const STAFF_BASE_COMMANDS = [
  { command: "start", description: "Почати спочатку" },
  { command: "collections", description: "Інкасації" },
];

const STAFF_TASKS_COMMAND = {
  command: "tasks",
  description: "Список завдань",
};

export async function sendStaffTextNotification(
  chatId: string,
  text: string
) {
  if (!TELEGRAM_BOT_TOKEN) return false;
  try {
    await axios.post(
      `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`,
      { chat_id: chatId, text }
    );
    return true;
  } catch (err) {
    console.error("Помилка Telegram staff:", err);
    return false;
  }
}

/** Команда /tasks у меню бота є лише коли в працівника є відкриті задачі */
export async function setStaffTaskCommand(chatId: string, enabled: boolean) {
  if (!TELEGRAM_BOT_TOKEN) return false;
  const commands = enabled
    ? [STAFF_BASE_COMMANDS[0], STAFF_TASKS_COMMAND, STAFF_BASE_COMMANDS[1]]
    : STAFF_BASE_COMMANDS;
  const numericId = Number(chatId);
  const scopeChatId = Number.isSafeInteger(numericId) ? numericId : chatId;
  try {
    await axios.post(
      `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/setMyCommands`,
      {
        commands,
        scope: { type: "chat", chat_id: scopeChatId },
      }
    );
    return true;
  } catch (err) {
    console.error("Помилка меню Telegram staff:", err);
    return false;
  }
}

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
