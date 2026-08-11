"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import axios from "axios";
import { toast } from "react-hot-toast";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { TechnicianPublicTask } from "@/lib/technician-public";

const MAX_PHOTOS = 5;

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

function TaskCard({ task }: { task: TechnicianPublicTask }) {
  return (
    <div className="min-w-0 flex-1">
      <p className="font-medium text-slate-900 dark:text-slate-100">
        {task.title}
      </p>
      <p className="text-xs text-slate-400">{task.typeLabel}</p>
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
      {task.status === "awaiting_manager_ack" &&
      task.salaryDeduction != null &&
      task.salaryDeduction > 0 ? (
        <p className="mt-1 text-xs font-medium text-amber-800 dark:text-amber-300">
          Утримання застосовано (
          {task.salaryDeduction.toLocaleString("uk-UA")} грн)
        </p>
      ) : null}
      {task.technicianComment ? (
        <p className="mt-1 text-xs text-slate-500">
          Коментар: {task.technicianComment}
        </p>
      ) : null}
      {task.rejectReason ? (
        <p className="mt-1 text-xs text-slate-500">
          Причина відхилення: {task.rejectReason}
        </p>
      ) : null}
      {task.managerDecisionLabel ? (
        <p className="mt-1 text-xs font-medium text-slate-600 dark:text-slate-300">
          Рішення керівника: {task.managerDecisionLabel}
        </p>
      ) : null}
      <TaskPhotos urls={task.photoUrls} />
    </div>
  );
}

export function TechnicianTasksClient({
  phone,
  activeTasks,
  archiveTasks,
}: {
  phone: string;
  activeTasks: TechnicianPublicTask[];
  archiveTasks: TechnicianPublicTask[];
}) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<number | null>(null);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [mode, setMode] = useState<
    Record<number, "complete" | "reject" | null>
  >({});
  const [text, setText] = useState<Record<number, string>>({});
  const [photos, setPhotos] = useState<Record<number, File[]>>({});

  const setTaskMode = (id: number, next: "complete" | "reject" | null) => {
    setMode((m) => ({ ...m, [id]: next }));
    if (!next) {
      setPhotos((p) => ({ ...p, [id]: [] }));
    }
  };

  const onPickPhotos = (taskId: number, list: FileList | null) => {
    if (!list) return;
    const next = Array.from(list).slice(0, MAX_PHOTOS);
    setPhotos((p) => ({ ...p, [taskId]: next }));
  };

  const submit = async (
    task: TechnicianPublicTask,
    action: "complete" | "reject"
  ) => {
    const value = (text[task.id] || "").trim();
    if (!value) {
      toast.error(
        action === "complete"
          ? "Додайте коментар"
          : "Вкажіть причину відхилення"
      );
      return;
    }

    try {
      setBusyId(task.id);
      const form = new FormData();
      form.append("action", action);
      if (action === "complete") {
        form.append("comment", value);
      } else {
        form.append("reason", value);
      }
      for (const file of photos[task.id] || []) {
        form.append("photos", file);
      }

      await axios.post(
        `/api/public/technician/${phone}/tasks/${task.id}`,
        form
      );
      const hasDeduction =
        task.salaryDeduction != null && task.salaryDeduction > 0;
      toast.success(
        action === "complete"
          ? "Надіслано на підтвердження керівника"
          : hasDeduction
            ? "Відхилено · утримання застосовано, очікує ознайомлення керівника"
            : "Відхилення надіслано керівнику"
      );
      setTaskMode(task.id, null);
      setText((t) => ({ ...t, [task.id]: "" }));
      setPhotos((p) => ({ ...p, [task.id]: [] }));
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
          Мої задачі ({activeTasks.length})
        </div>
        {activeTasks.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-slate-500 dark:text-slate-400">
            Немає активних задач
          </p>
        ) : (
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            {activeTasks.map((task) => {
              const currentMode = mode[task.id] || null;
              const busy = busyId === task.id;
              const picked = photos[task.id] || [];

              return (
                <li key={task.id} className="space-y-3 px-4 py-4">
                  <TaskCard task={task} />
                  <div className="space-y-2">
                    {!currentMode ? (
                      <div className="flex flex-wrap gap-2">
                        <Button
                          size="sm"
                          disabled={busy}
                          onClick={() => setTaskMode(task.id, "complete")}
                        >
                          Виконати задачу
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={busy}
                          onClick={() => setTaskMode(task.id, "reject")}
                        >
                          Відхилити задачу
                        </Button>
                      </div>
                    ) : (
                      <div className="space-y-2 rounded-lg border border-slate-200 p-3 dark:border-slate-700">
                        <p className="text-sm font-medium">
                          {currentMode === "complete"
                            ? "Коментар до виконання"
                            : "Причина відхилення"}
                        </p>
                        <Input
                          value={text[task.id] || ""}
                          disabled={busy}
                          placeholder={
                            currentMode === "complete"
                              ? "Що зроблено…"
                              : "Чому відхиляєте…"
                          }
                          onChange={(e) =>
                            setText((t) => ({
                              ...t,
                              [task.id]: e.target.value,
                            }))
                          }
                        />
                        <div className="space-y-2">
                          <label className="block text-sm font-medium">
                            Фотозвіт
                            {currentMode === "reject" ? " (опційно)" : ""}
                          </label>
                          <Input
                            type="file"
                            accept="image/jpeg,image/png,image/webp"
                            multiple
                            disabled={busy}
                            onChange={(e) =>
                              onPickPhotos(task.id, e.target.files)
                            }
                          />
                          <p className="text-xs text-slate-400">
                            До {MAX_PHOTOS} фото, кожне до 5 МБ
                            {picked.length
                              ? ` · обрано: ${picked.length}`
                              : ""}
                          </p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <Button
                            size="sm"
                            disabled={busy}
                            onClick={() => submit(task, currentMode)}
                          >
                            Надіслати
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            disabled={busy}
                            onClick={() => setTaskMode(task.id, null)}
                          >
                            Скасувати
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
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
          <span>Архів ({archiveTasks.length})</span>
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
