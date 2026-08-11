import { format } from "date-fns";
import { uk } from "date-fns/locale";

import { Heading } from "@/components/ui/heading";
import { Separator } from "@/components/ui/separator";
import prismadb from "@/lib/prismadb";
import {
  listCabinetUsers,
  requireApprovedAccess,
} from "@/lib/cabinet-access";
import { SettingsUsersClient } from "./components/settings-users-client";
import { SettingsWorkersClient } from "./components/settings-workers-client";

export const dynamic = "force-dynamic";

function staffLabel(u: {
  chat_id: bigint;
  username: string | null;
  firstName: string | null;
  lastName: string | null;
}) {
  const name = [u.firstName, u.lastName].filter(Boolean).join(" ").trim();
  const handle = u.username ? `@${u.username}` : null;
  const head = [name || null, handle].filter(Boolean).join(" ");
  return head
    ? `${head} · ${u.chat_id.toString()}`
    : u.chat_id.toString();
}

export default async function SettingsPage() {
  const access = await requireApprovedAccess();

  // Без auto-sync Staff→workers: після delete/unlink refresh більше не воскрешає користувача
  const [users, workers, staffUsers] = await Promise.all([
    listCabinetUsers(),
    prismadb.workers.findMany({ orderBy: { id: "desc" } }),
    prismadb.staffBotUser.findMany({ orderBy: { createdAt: "desc" } }),
  ]);

  const rows = users.map((u) => ({
    id: u.id,
    email: u.email,
    name: u.name,
    role: u.role,
    status: u.status,
    createdAt: format(u.createdAt, "d MMM yyyy, HH:mm", { locale: uk }),
  }));

  const workerRows = workers.map((w) => ({
    id: w.id,
    name: w.name,
    phone: w.phone,
    chat_id: w.chat_id !== null ? w.chat_id.toString() : null,
    role: w.role,
    active: w.active,
  }));

  const staffByChat = new Map<string, { chat_id: string; label: string }>();
  for (const u of staffUsers) {
    const key = u.chat_id.toString();
    staffByChat.set(key, {
      chat_id: key,
      label: staffLabel(u),
    });
  }
  for (const w of workers) {
    if (w.chat_id === null) continue;
    const key = w.chat_id.toString();
    if (staffByChat.has(key)) continue;
    staffByChat.set(key, {
      chat_id: key,
      label: w.name?.trim() ? `${w.name.trim()} · ${key}` : key,
    });
  }
  const staffOptions = Array.from(staffByChat.values());

  return (
    <div className="flex-col">
      <div className="flex-1 space-y-8 p-8 pt-6">
        <div className="space-y-4">
          <Heading
            title="Налаштування"
            description="Керування доступом до кабінету. Поки роль лише admin — нових користувачів треба підтвердити."
          />
          <Separator />
          <h3 className="text-lg font-medium">Доступ до кабінету</h3>
          <SettingsUsersClient users={rows} currentUserId={access.id} />
        </div>

        <div className="space-y-4">
          <Heading
            title="Користувачі бота"
            description="Після /start зʼявляються автоматично. Заповніть імʼя, телефон і роль."
          />
          <Separator />
          <SettingsWorkersClient
            workers={workerRows}
            staffUsers={staffOptions}
          />
        </div>
      </div>
    </div>
  );
}
