"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import axios from "axios";
import { toast } from "react-hot-toast";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { WORKER_ROLES } from "@/lib/worker-roles";
import { digitsOnlyPhone } from "@/lib/phone";

export type SettingsWorkerRow = {
  id: number;
  name: string | null;
  phone: string | null;
  chat_id: string | null;
  role: string | null;
  active: boolean | null;
};

export type StaffBotOption = {
  chat_id: string;
  label: string;
};

export function SettingsWorkersClient({
  workers,
  staffUsers,
}: {
  workers: SettingsWorkerRow[];
  staffUsers: StaffBotOption[];
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState("none");
  const [creating, setCreating] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);

  const takenByWorker = useMemo(() => {
    const map = new Map<string, number>();
    for (const w of workers) {
      if (w.chat_id) map.set(w.chat_id, w.id);
    }
    return map;
  }, [workers]);

  const optionsFor = (workerId: number, currentChatId: string | null) => {
    const fromBot = [...staffUsers];
    if (
      currentChatId &&
      !fromBot.some((u) => u.chat_id === currentChatId)
    ) {
      fromBot.unshift({
        chat_id: currentChatId,
        label: `Поточний · ${currentChatId}`,
      });
    }
    return fromBot;
  };

  const onCreate = async () => {
    if (!name.trim()) {
      toast.error("Вкажіть імʼя працівника");
      return;
    }
    try {
      setCreating(true);
      await axios.post("/api/settings/workers", {
        name: name.trim(),
        phone: phone.trim() || null,
        role: role === "none" ? null : role,
        active: true,
      });
      setName("");
      setPhone("");
      setRole("none");
      toast.success("Працівника створено");
      router.refresh();
    } catch {
      toast.error("Не вдалося створити");
    } finally {
      setCreating(false);
    }
  };

  const patchWorker = async (
    id: number,
    payload: Record<string, unknown>,
    okMessage: string
  ) => {
    try {
      setBusyId(id);
      await axios.patch(`/api/settings/workers/${id}`, payload);
      toast.success(okMessage);
      router.refresh();
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 409) {
        toast.error(
          (error.response.data as { message?: string })?.message ||
            "Цей Telegram ID уже зайнятий"
        );
      } else {
        toast.error("Не вдалося оновити");
      }
    } finally {
      setBusyId(null);
    }
  };

  const onDelete = async (id: number) => {
    try {
      setBusyId(id);
      await axios.delete(`/api/settings/workers/${id}`);
      toast.success("Видалено");
      router.refresh();
    } catch {
      toast.error("Не вдалося видалити");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="flex-1 space-y-1">
          <label className="text-sm text-muted-foreground">Імʼя</label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Імʼя працівника"
          />
        </div>
        <div className="flex-1 space-y-1">
          <label className="text-sm text-muted-foreground">Телефон</label>
          <Input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="Опційно"
          />
        </div>
        <div className="w-full space-y-1 sm:w-48">
          <label className="text-sm text-muted-foreground">Роль</label>
          <Select value={role} onValueChange={setRole}>
            <SelectTrigger>
              <SelectValue placeholder="Роль" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Без ролі</SelectItem>
              {WORKER_ROLES.map((r) => (
                <SelectItem key={r.value} value={r.value}>
                  {r.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button onClick={onCreate} disabled={creating}>
          Додати
        </Button>
      </div>

      {staffUsers.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Ніхто ще не натиснув Start у staff-боті — селектор буде порожній, доки
          бот не надішле chat_id.
        </p>
      ) : null}

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Імʼя</TableHead>
              <TableHead>Роль</TableHead>
              <TableHead>Telegram</TableHead>
              <TableHead>Телефон</TableHead>
              <TableHead>Статус</TableHead>
              <TableHead className="text-right">Дії</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {workers.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={6}
                  className="text-center text-muted-foreground"
                >
                  Поки немає працівників
                </TableCell>
              </TableRow>
            ) : (
              workers.map((worker) => {
                const busy = busyId === worker.id;
                const options = optionsFor(worker.id, worker.chat_id);

                return (
                  <TableRow key={worker.id}>
                    <TableCell className="font-medium">
                      <div>{worker.name || "—"}</div>
                      {(worker.role === "technician" ||
                        worker.role === "manager") &&
                      digitsOnlyPhone(worker.phone).length >= 10 ? (
                        <a
                          className="text-xs text-sky-600 hover:underline"
                          href={`/${digitsOnlyPhone(worker.phone)}`}
                          target="_blank"
                          rel="noreferrer"
                        >
                          /{digitsOnlyPhone(worker.phone)}
                        </a>
                      ) : null}
                    </TableCell>
                    <TableCell className="min-w-[160px]">
                      <Select
                        disabled={busy}
                        value={worker.role ?? "none"}
                        onValueChange={(value) =>
                          patchWorker(
                            worker.id,
                            { role: value === "none" ? null : value },
                            "Роль оновлено"
                          )
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Роль" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Без ролі</SelectItem>
                          {WORKER_ROLES.map((r) => (
                            <SelectItem key={r.value} value={r.value}>
                              {r.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell className="min-w-[220px]">
                      <Select
                        disabled={busy}
                        value={worker.chat_id ?? "none"}
                        onValueChange={(value) =>
                          patchWorker(
                            worker.id,
                            { chat_id: value === "none" ? null : value },
                            value === "none"
                              ? "Telegram відвʼязано"
                              : "Telegram привʼязано"
                          )
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Оберіть з бота" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Не привʼязано</SelectItem>
                          {options.map((opt) => {
                            const ownerId = takenByWorker.get(opt.chat_id);
                            const takenByOther =
                              ownerId !== undefined && ownerId !== worker.id;
                            return (
                              <SelectItem
                                key={opt.chat_id}
                                value={opt.chat_id}
                                disabled={takenByOther}
                              >
                                {opt.label}
                                {takenByOther ? " (зайнято)" : ""}
                              </SelectItem>
                            );
                          })}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>{worker.phone || "—"}</TableCell>
                    <TableCell>
                      {worker.active ? (
                        <Badge className="bg-emerald-600 hover:bg-emerald-600">
                          active
                        </Badge>
                      ) : (
                        <Badge variant="secondary">inactive</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right space-x-2">
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={busy}
                        onClick={() =>
                          patchWorker(
                            worker.id,
                            { active: !worker.active },
                            worker.active ? "Деактивовано" : "Активовано"
                          )
                        }
                      >
                        {worker.active ? "Вимкнути" : "Увімкнути"}
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        disabled={busy}
                        onClick={() => onDelete(worker.id)}
                      >
                        Видалити
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
