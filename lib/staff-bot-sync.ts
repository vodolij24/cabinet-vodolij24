import prismadb from "@/lib/prismadb";

export function telegramDisplayName(parts: {
  firstName?: string | null;
  lastName?: string | null;
  username?: string | null;
  chatId: bigint | string;
}): string {
  const name = [parts.firstName, parts.lastName].filter(Boolean).join(" ").trim();
  if (name && name !== "unknown") return name;
  if (parts.username?.trim()) return `@${parts.username.trim()}`;
  return `Telegram ${parts.chatId.toString()}`;
}

/**
 * Після /start у staff-боті: гарантує рядок у workers з цим chat_id.
 * Імʼя з Telegram підставляється лише якщо працівник ще без нормального імені.
 */
export async function ensureWorkerFromStaffBot(input: {
  chatId: bigint;
  username?: string | null;
  firstName?: string | null;
  lastName?: string | null;
}) {
  const displayName = telegramDisplayName({
    firstName: input.firstName,
    lastName: input.lastName,
    username: input.username,
    chatId: input.chatId,
  });

  const existing = await prismadb.workers.findFirst({
    where: { chat_id: input.chatId },
  });

  if (existing) {
    const needsName =
      !existing.name?.trim() ||
      existing.name.startsWith("Telegram ") ||
      existing.name === "unknown";

    const data: { name?: string; active?: boolean } = {};
    if (needsName && displayName !== existing.name) {
      data.name = displayName;
    }
    if (existing.active == null) {
      data.active = true;
    }
    if (Object.keys(data).length > 0) {
      return prismadb.workers.update({
        where: { id: existing.id },
        data,
      });
    }
    return existing;
  }

  return prismadb.workers.create({
    data: {
      chat_id: input.chatId,
      name: displayName,
      phone: null,
      role: null,
      active: true,
      dialoguestatus: "",
    },
  });
}

export async function ensureStaffBotUserFromWorker(input: {
  chatId: bigint;
  name?: string | null;
}) {
  const existing = await prismadb.staffBotUser.findUnique({
    where: { chat_id: input.chatId },
  });
  if (existing) return existing;

  const firstName =
    input.name?.trim() &&
    !input.name.startsWith("Telegram ") &&
    input.name !== "unknown"
      ? input.name.trim()
      : `Telegram ${input.chatId.toString()}`;

  return prismadb.staffBotUser.create({
    data: {
      chat_id: input.chatId,
      firstName,
      lastName: null,
      username: null,
    },
  });
}

/**
 * Двосторонній sync:
 * StaffBotUser → workers
 * workers з chat_id → StaffBotUser (якщо бот писав лише в workers)
 */
export async function syncStaffBotUsersToWorkers() {
  const staff = await prismadb.staffBotUser.findMany({
    orderBy: { createdAt: "asc" },
  });
  let createdWorkers = 0;

  for (const u of staff) {
    const before = await prismadb.workers.findFirst({
      where: { chat_id: u.chat_id },
      select: { id: true },
    });
    await ensureWorkerFromStaffBot({
      chatId: u.chat_id,
      username: u.username,
      firstName: u.firstName,
      lastName: u.lastName,
    });
    if (!before) createdWorkers += 1;
  }

  const workersWithChat = await prismadb.workers.findMany({
    where: { chat_id: { not: null } },
    select: { chat_id: true, name: true },
  });

  let createdStaff = 0;
  for (const w of workersWithChat) {
    if (w.chat_id === null) continue;
    const before = await prismadb.staffBotUser.findUnique({
      where: { chat_id: w.chat_id },
      select: { id: true },
    });
    await ensureStaffBotUserFromWorker({
      chatId: w.chat_id,
      name: w.name,
    });
    if (!before) createdStaff += 1;
  }

  return {
    createdWorkers,
    createdStaff,
    staff: staff.length,
    workersWithChat: workersWithChat.length,
  };
}
