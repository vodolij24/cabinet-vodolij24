import { format } from "date-fns";
import { uk } from "date-fns/locale";

import { Heading } from "@/components/ui/heading";
import { Separator } from "@/components/ui/separator";
import {
  listCabinetUsers,
  requireApprovedAccess,
} from "@/lib/cabinet-access";
import { SettingsUsersClient } from "./components/settings-users-client";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const access = await requireApprovedAccess();
  const users = await listCabinetUsers();

  const rows = users.map((u) => ({
    id: u.id,
    email: u.email,
    name: u.name,
    role: u.role,
    status: u.status,
    createdAt: format(u.createdAt, "d MMM yyyy, HH:mm", { locale: uk }),
  }));

  return (
    <div className="flex-col">
      <div className="flex-1 space-y-4 p-8 pt-6">
        <Heading
          title="Налаштування"
          description="Керування доступом до кабінету. Поки роль лише admin — нових користувачів треба підтвердити."
        />
        <Separator />
        <SettingsUsersClient users={rows} currentUserId={access.id} />
      </div>
    </div>
  );
}
