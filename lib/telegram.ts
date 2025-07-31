import axios from "axios";
import { tasks } from '@/lib/generated/prisma';

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

export async function sendTelegramTaskNotification(chatId: string, task: tasks, status: string) {
  const message = `📝 ${status}:

📌 *${task.title}*
🗒️ ${task.description || 'Без опису'}
📟 Апарат №: ${task.deviceId || 'Невідомо'}
🎯 Пріоритет: ${task.priority || 'Не вказано'}`


  try {
    await axios.post(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
      chat_id: chatId,
      text: message,
      parse_mode: "Markdown",
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: "✅ Виконано",
              callback_data: `done_${task.id}`
            }
          ]
        ]
      }
    });
  } catch (err) {
    console.error('Помилка при надсиланні повідомлення в Telegram:', err);
  }
}