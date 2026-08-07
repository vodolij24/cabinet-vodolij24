import prismadb from "@/lib/prismadb";

export function telegramDisplayName(parts: {
  firstName?: string | null;
  lastName?: string | null;
  username?: string | null;
  chatId: bigint | string;
}): string {
  const name = [parts.firstName, parts.lastName].filter(Boolean).join(" ").trim();
  if (name) return name;
  if (parts.username?.trim()) return `@${parts.username.trim()}`;
  return `Telegram ${parts.chatId.toString()}`;
}

/**
 * Після /start у staff-боті: гарантує рядок у workers з цим chat_id.
 * Імʼя з Telegram підставляється лише якщо працівник ще без нормального імені
 * або щойно створений.
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

    if (needsName && displayName !== existing.name) {
      return prismadb.workers.update({
        where: { id: existing.id },
        data: { name: displayName },
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

/** Підтягує старі StaffBotUser у workers (хто ще без chat_id-привʼязки). */
export async function syncStaffBotUsersToWorkers() {
  const staff = await prismadb.staffBotUser.findMany({
    orderBy: { createdAt: "asc" },
  });
  let created = 0;
  let updated = 0;

  for (const u of staff) {
    const before = await prismadb.workers.findFirst({
      where: { chat_id: u.chat_id },
      select: { id: true },
    });
    const worker = await ensureWorkerFromStaffBot({
      chatId: u.chat_id,
      username: u.username,
      firstName: u.firstName,
      lastName: u.lastName,
    });
    if (!before) created += 1;
    else if (before.id === worker.id) updated += 1;
  }

  return { created, linked: staff.length, updated };
}
