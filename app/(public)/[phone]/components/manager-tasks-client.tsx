"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import axios from "axios";
import { toast } from "react-hot-toast";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { ManagerPublicTask } from "@/lib/manager-public";

function TaskPhotos({ urls }: { urls: string[] }) {
  if (urls.length === 0) return null;
  return (
    <div className="mt-3 flex flex-wrap gap-2">
      {urls.map((url) => (
        <a
          key={url}
          href={url}
          target="_blank"
          rel="noreferrer"
          className="block overflow-hidden rounded-md border border-slate-200 dark:border-slate-700"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={url} alt="Фотозвіт" className="h-20 w-20 object-cover" />
        </a>
      ))}
    </div>
  );
}

function TaskCard({ task }: { task: ManagerPublicTask }) {
  return (
    <div className="min-w-0 flex-1">
      <p className="font-medium text-slate-900 dark:text-slate-100">
        {task.title}
      </p>
      <p className="text-xs text-slate-400">
        {task.typeLabel}
        {task.technicianName ? ` · ${task.technicianName}` : ""}
      </p>
      {task.description ? (
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
          {task.description}
        </p>
      ) : null}
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-500 dark:text-slate-400">
        {task.baseLocation ? <span>База: {task.baseLocation}</span> : null}
        <span>Дедлайн: {task.dueAt || "—"}</span>
        <span>
          Утримання:{" "}
          {task.salaryDeduction != null
            ? `${task.salaryDeduction.toLocaleString("uk-UA")} грн`
            : "—"}
        </span>
      </div>
      <p className="mt-2 text-xs font-medium text-sky-800 dark:text-sky-300">
        {task.statusLabel}
      </p>
      {task.technicianComment ? (
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
          Відповідь техніка: {task.technicianComment}
        </p>
      ) : null}
      {task.rejectReason ? (
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
          Причина відхилення: {task.rejectReason}
        </p>
      ) : null}
      {task.ackOnly && task.reviewable ? (
        <p className="mt-1 text-sm font-medium text-amber-800 dark:text-amber-300">
          Утримання вже застосовано
          {task.salaryDeduction != null
            ? ` (${task.salaryDeduction.toLocaleString("uk-UA")} грн)`
            : ""}
          . Потрібно лише ознайомлення.
        </p>
      ) : null}
      <TaskPhotos urls={task.photoUrls} />
      {!task.reviewable && task.managerDecision ? (
        <div className="mt-2 space-y-1 text-xs text-slate-500">
          <p className="font-medium text-slate-700 dark:text-slate-300">
            {task.managerDecisionLabel}
          </p>
          {task.managerComment ? (
            <p>Коментар керівника: {task.managerComment}</p>
          ) : null}
          {task.reviewedAt ? <p>Дата рішення: {task.reviewedAt}</p> : null}
        </div>
      ) : null}
    </div>
  );
}

export function ManagerTasksClient({
  phone,
  pendingTasks,
  archiveTasks,
}: {
  phone: string;
  pendingTasks: ManagerPublicTask[];
  archiveTasks: ManagerPublicTask[];
}) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<number | null>(null);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [mode, setMode] = useState<
    Record<number, "accept" | "reject" | "acknowledge" | null>
  >({});
  const [comment, setComment] = useState<Record<number, string>>({});

  const submit = async (
    task: ManagerPublicTask,
    action: "accept" | "reject" | "acknowledge"
  ) => {
    try {
      setBusyId(task.id);
      await axios.post(`/api/public/manager/${phone}/tasks/${task.id}`, {
        action,
        comment: (comment[task.id] || "").trim() || undefined,
      });
      toast.success(
        action === "acknowledge"
          ? "Ознайомлено · задачу закрито"
          : action === "accept"
            ? "Прийнято · задачу закрито без утримання"
            : "Не прийнято · задачу закрито з утриманням"
      );
      setMode((m) => ({ ...m, [task.id]: null }));
      setComment((c) => ({ ...c, [task.id]: "" }));
      router.refresh();
    } catch (error) {
      const msg = axios.isAxiosError(error)
        ? error.response?.data || "Помилка"
        : "Помилка";
      toast.error(typeof msg === "string" ? msg : "Помилка");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-2xl border border-sky-100 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="border-b border-sky-50 bg-sky-50/60 px-4 py-3 text-sm font-medium text-sky-900 dark:border-slate-800 dark:bg-slate-900/80 dark:text-sky-200">
          На перевірку ({pendingTasks.length})
        </div>
        {pendingTasks.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-slate-500 dark:text-slate-400">
            Немає задач на перевірку
          </p>
        ) : (
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            {pendingTasks.map((task) => {
              const currentMode = mode[task.id] || null;
              const busy = busyId === task.id;
              const deductionHint =
                task.salaryDeduction != null && task.salaryDeduction > 0
                  ? `${task.salaryDeduction.toLocaleString("uk-UA")} грн`
                  : "без суми (0)";

              return (
                <li key={task.id} className="space-y-3 px-4 py-4">
                  <TaskCard task={task} />
                  {task.ackOnly ? (
                    !currentMode ? (
                      <Button
                        size="sm"
                        disabled={busy}
                        onClick={() =>
                          setMode((m) => ({
                            ...m,
                            [task.id]: "acknowledge",
                          }))
                        }
                      >
                        Ознайомлений
                      </Button>
                    ) : (
                      <div className="space-y-2 rounded-lg border border-slate-200 p-3 dark:border-slate-700">
                        <p className="text-sm font-medium">
                          Підтвердити ознайомлення (утримання вже в балансі)
                        </p>
                        <Input
                          value={comment[task.id] || ""}
                          disabled={busy}
                          placeholder="Коментар керівника (опційно)"
                          onChange={(e) =>
                            setComment((c) => ({
                              ...c,
                              [task.id]: e.target.value,
                            }))
                          }
                        />
                        <div className="flex flex-wrap gap-2">
                          <Button
                            size="sm"
                            disabled={busy}
                            onClick={() => submit(task, "acknowledge")}
                          >
                            Підтвердити
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            disabled={busy}
                            onClick={() =>
                              setMode((m) => ({ ...m, [task.id]: null }))
                            }
                          >
                            Скасувати
                          </Button>
                        </div>
                      </div>
                    )
                  ) : !currentMode ? (
                    <div className="flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        disabled={busy}
                        onClick={() =>
                          setMode((m) => ({ ...m, [task.id]: "accept" }))
                        }
                      >
                        Прийняти
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={busy}
                        onClick={() =>
                          setMode((m) => ({ ...m, [task.id]: "reject" }))
                        }
                      >
                        Не прийняти
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-2 rounded-lg border border-slate-200 p-3 dark:border-slate-700">
                      <p className="text-sm font-medium">
                        {currentMode === "accept"
                          ? "Прийняти відповідь — закрити без утримання"
                          : `Не прийняти — застосувати утримання (${deductionHint})`}
                      </p>
                      <Input
                        value={comment[task.id] || ""}
                        disabled={busy}
                        placeholder="Коментар керівника (опційно)"
                        onChange={(e) =>
                          setComment((c) => ({
                            ...c,
                            [task.id]: e.target.value,
                          }))
                        }
                      />
                      <div className="flex flex-wrap gap-2">
                        <Button
                          size="sm"
                          disabled={busy}
                          onClick={() =>
                            submit(
                              task,
                              currentMode === "accept" ? "accept" : "reject"
                            )
                          }
                        >
                          Підтвердити
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={busy}
                          onClick={() =>
                            setMode((m) => ({ ...m, [task.id]: null }))
                          }
                        >
                          Скасувати
                        </Button>
                      </div>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <button
          type="button"
          className="flex w-full items-center justify-between border-b border-slate-100 bg-slate-50 px-4 py-3 text-left text-sm font-medium text-slate-800 dark:border-slate-800 dark:bg-slate-900/80 dark:text-slate-200"
          onClick={() => setArchiveOpen((v) => !v)}
        >
          <span>Архів рішень ({archiveTasks.length})</span>
          <span className="text-xs text-slate-500">
            {archiveOpen ? "Згорнути" : "Розгорнути"}
          </span>
        </button>
        {archiveOpen ? (
          archiveTasks.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-slate-500 dark:text-slate-400">
              Архів порожній
            </p>
          ) : (
            <ul className="divide-y divide-slate-100 dark:divide-slate-800">
              {archiveTasks.map((task) => (
                <li key={task.id} className="px-4 py-4 opacity-90">
                  <TaskCard task={task} />
                </li>
              ))}
            </ul>
          )
        ) : null}
      </section>
    </div>
  );
}
