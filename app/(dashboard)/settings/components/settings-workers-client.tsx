"use client";

import { useEffect, useMemo, useState } from "react";
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

type Draft = { name: string; phone: string };

function needsProfile(worker: SettingsWorkerRow) {
  const name = (worker.name || "").trim();
  const phone = digitsOnlyPhone(worker.phone);
  return (
    !name ||
    name.startsWith("Telegram ") ||
    name === "unknown" ||
    phone.length < 10 ||
    !worker.role
  );
}

export function SettingsWorkersClient({
  workers,
  staffUsers,
}: {
  workers: SettingsWorkerRow[];
  staffUsers: StaffBotOption[];
}) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<number | null>(null);
  const [drafts, setDrafts] = useState<Record<number, Draft>>({});

  useEffect(() => {
    const next: Record<number, Draft> = {};
    for (const w of workers) {
      next[w.id] = {
        name: w.name || "",
        phone: w.phone || "",
      };
    }
    setDrafts(next);
  }, [workers]);

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

  const setDraft = (id: number, patch: Partial<Draft>) => {
    setDrafts((prev) => ({
      ...prev,
      [id]: { name: prev[id]?.name || "", phone: prev[id]?.phone || "", ...patch },
    }));
  };

  const draftDirty = (worker: SettingsWorkerRow) => {
    const d = drafts[worker.id];
    if (!d) return false;
    return (
      d.name.trim() !== (worker.name || "").trim() ||
      d.phone.trim() !== (worker.phone || "").trim()
    );
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
      } else if (axios.isAxiosError(error) && error.response?.status === 400) {
        toast.error(
          typeof error.response.data === "string"
            ? error.response.data
            : "Перевірте дані"
        );
      } else {
        toast.error("Не вдалося оновити");
      }
    } finally {
      setBusyId(null);
    }
  };

  const onSaveProfile = async (worker: SettingsWorkerRow) => {
    const d = drafts[worker.id];
    if (!d) return;
    const name = d.name.trim();
    if (!name) {
      toast.error("Вкажіть імʼя");
      return;
    }
    await patchWorker(
      worker.id,
      {
        name,
        phone: d.phone.trim() || null,
      },
      "Профіль збережено"
    );
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

  const pendingCount = workers.filter(needsProfile).length;

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Після <span className="font-medium">/start</span> у staff-боті працівник
        зʼявляється тут автоматично з Telegram ID. Далі заповніть імʼя, телефон і
        роль.
        {pendingCount > 0 ? (
          <>
            {" "}
            Залишилось заповнити:{" "}
            <span className="font-medium text-foreground">{pendingCount}</span>.
          </>
        ) : null}
      </p>

      {staffUsers.length === 0 ? (
        <p className="text-sm text-amber-800 dark:text-amber-200">
          Ніхто ще не натиснув Start у staff-боті.
        </p>
      ) : null}

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Імʼя</TableHead>
              <TableHead>Телефон</TableHead>
              <TableHead>Роль</TableHead>
              <TableHead>Telegram</TableHead>
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
                  Поки немає працівників — нехай натиснуть /start у боті
                </TableCell>
              </TableRow>
            ) : (
              workers.map((worker) => {
                const busy = busyId === worker.id;
                const options = optionsFor(worker.id, worker.chat_id);
                const draft = drafts[worker.id] || {
                  name: worker.name || "",
                  phone: worker.phone || "",
                };
                const dirty = draftDirty(worker);
                const incomplete = needsProfile(worker);

                return (
                  <TableRow
                    key={worker.id}
                    className={incomplete ? "bg-amber-50/50 dark:bg-amber-950/20" : undefined}
                  >
                    <TableCell className="min-w-[180px] align-top">
                      <Input
                        value={draft.name}
                        disabled={busy}
                        placeholder="Імʼя працівника"
                        onChange={(e) =>
                          setDraft(worker.id, { name: e.target.value })
                        }
                      />
                      {(worker.role === "technician" ||
                        worker.role === "manager") &&
                      digitsOnlyPhone(worker.phone).length >= 10 ? (
                        <a
                          className="mt-1 inline-block text-xs text-sky-600 hover:underline"
                          href={`/${digitsOnlyPhone(worker.phone)}`}
                          target="_blank"
                          rel="noreferrer"
                        >
                          /{digitsOnlyPhone(worker.phone)}
                        </a>
                      ) : null}
                      {incomplete ? (
                        <p className="mt-1 text-xs text-amber-800 dark:text-amber-200">
                          Заповніть профіль
                        </p>
                      ) : null}
                    </TableCell>
                    <TableCell className="min-w-[160px] align-top">
                      <Input
                        value={draft.phone}
                        disabled={busy}
                        placeholder="380…"
                        onChange={(e) =>
                          setDraft(worker.id, { phone: e.target.value })
                        }
                      />
                    </TableCell>
                    <TableCell className="min-w-[160px] align-top">
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
                    <TableCell className="min-w-[220px] align-top">
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
                    <TableCell className="align-top">
                      {worker.active ? (
                        <Badge className="bg-emerald-600 hover:bg-emerald-600">
                          active
                        </Badge>
                      ) : (
                        <Badge variant="secondary">inactive</Badge>
                      )}
                    </TableCell>
                    <TableCell className="space-y-2 text-right align-top">
                      <div className="flex flex-wrap justify-end gap-2">
                        <Button
                          size="sm"
                          disabled={busy || !dirty}
                          onClick={() => onSaveProfile(worker)}
                        >
                          Зберегти
                        </Button>
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
                      </div>
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
