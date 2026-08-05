"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import axios from "axios";
import { toast } from "react-hot-toast";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export type SettingsUserRow = {
  id: string;
  email: string | null;
  name: string | null;
  role: string;
  status: string;
  createdAt: string;
};

export function SettingsUsersClient({
  users,
  currentUserId,
}: {
  users: SettingsUserRow[];
  currentUserId: string;
}) {
  const router = useRouter();
  const [loadingId, setLoadingId] = useState<string | null>(null);

  const onAction = async (id: string, status: "approved" | "rejected") => {
    try {
      setLoadingId(id);
      await axios.patch(`/api/settings/users/${id}`, { status });
      toast.success(status === "approved" ? "Користувача підтверджено" : "Доступ відхилено");
      router.refresh();
    } catch {
      toast.error("Не вдалося оновити статус");
    } finally {
      setLoadingId(null);
    }
  };

  const statusBadge = (status: string) => {
    if (status === "approved") {
      return <Badge className="bg-emerald-600 hover:bg-emerald-600">approved</Badge>;
    }
    if (status === "rejected") {
      return <Badge variant="destructive">rejected</Badge>;
    }
    return <Badge variant="secondary">pending</Badge>;
  };

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Користувач</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Роль</TableHead>
            <TableHead>Статус</TableHead>
            <TableHead>Створено</TableHead>
            <TableHead className="text-right">Дії</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {users.length === 0 ? (
            <TableRow>
              <TableCell colSpan={6} className="text-center text-muted-foreground">
                Поки немає записів
              </TableCell>
            </TableRow>
          ) : (
            users.map((user) => {
              const isSelf = user.id === currentUserId;
              const busy = loadingId === user.id;

              return (
                <TableRow key={user.id}>
                  <TableCell className="font-medium">
                    {user.name || "—"}
                    {isSelf ? (
                      <span className="ml-2 text-xs text-muted-foreground">(ви)</span>
                    ) : null}
                  </TableCell>
                  <TableCell>{user.email || "—"}</TableCell>
                  <TableCell>{user.role}</TableCell>
                  <TableCell>{statusBadge(user.status)}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {user.createdAt}
                  </TableCell>
                  <TableCell className="text-right space-x-2">
                    {user.status !== "approved" && (
                      <Button
                        size="sm"
                        disabled={busy}
                        onClick={() => onAction(user.id, "approved")}
                      >
                        Підтвердити
                      </Button>
                    )}
                    {user.status !== "rejected" && !isSelf && (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={busy}
                        onClick={() => onAction(user.id, "rejected")}
                      >
                        Відхилити
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              );
            })
          )}
        </TableBody>
      </Table>
    </div>
  );
}
