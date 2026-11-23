import prismadb from "@/lib/prismadb";
import { kyivDateLabel } from "@/lib/kyiv-date";
import { taskStatusLabel } from "@/lib/task-fields";
import {
  sendStaffTextNotification,
  setStaffTaskCommand,
} from "@/lib/telegram";

const activeTaskWhere = {
  OR: [{ status: null }, { status: { not: "done" } }],
};

type DigestTask = {
  id: number;
  title: string;
  description: string | null;
  status: string | null;
  dueAt: Date | null;
  workerId: number | null;
};

function formatTaskLine(task: DigestTask, index: number) {
  const due = task.dueAt ? kyivDateLabel(task.dueAt) : "без терміну";
  const description = task.description?.trim();
  const lines = [
    `${index}. ${task.title}`,
    `${taskStatusLabel(task.status)} · ${due}`,
  ];
  if (description) {
    lines.push(description.length > 180 ? `${description.slice(0, 177)}...` : description);
  }
  return lines.join("\n");
}

export function formatTaskDigest(tasks: DigestTask[]) {
  const body = tasks.map(formatTaskLine).join("\n\n");
  return `Ваші задачі (${tasks.length}):\n\n${body}\n\nВідкрити список у боті: /tasks`;
}

function splitTelegramText(text: string, limit = 3500) {
  if (text.length <= limit) return [text];
  const parts: string[] = [];
  let rest = text;
  while (rest.length > limit) {
    let cut = rest.lastIndexOf("\n", limit);
    if (cut < 200) cut = limit;
    parts.push(rest.slice(0, cut));
    rest = rest.slice(cut).trimStart();
  }
  if (rest) parts.push(rest);
  return parts;
}

export async function syncStaffTaskMenu(workerId: number | null | undefined) {
  if (!workerId) return;
  try {
    const worker = await prismadb.workers.findUnique({
      where: { id: workerId },
      select: { chat_id: true },
    });
    if (worker?.chat_id == null) return;
    const count = await prismadb.tasks.count({
      where: { workerId, ...activeTaskWhere },
    });
    await setStaffTaskCommand(worker.chat_id.toString(), count > 0);
  } catch (error) {
    console.error("[TASK_MENU]", error);
  }
}

export async function sendThursdayTaskDigests() {
  const [tasks, workers] = await Promise.all([
    prismadb.tasks.findMany({
      where: {
        workerId: { not: null },
        ...activeTaskWhere,
      },
      orderBy: [{ dueAt: "asc" }, { id: "asc" }],
      select: {
        id: true,
        title: true,
        description: true,
        status: true,
        dueAt: true,
        workerId: true,
      },
    }),
    prismadb.workers.findMany({
      where: { chat_id: { not: null } },
      select: { id: true, chat_id: true },
    }),
  ]);

  const byWorker = new Map<number, DigestTask[]>();
  let tasksWithoutChat = 0;
  const workerIdsWithChat = new Set(workers.map((worker) => worker.id));

  for (const task of tasks) {
    if (task.workerId == null) continue;
    if (!workerIdsWithChat.has(task.workerId)) {
      tasksWithoutChat += 1;
      continue;
    }
    const list = byWorker.get(task.workerId) ?? [];
    list.push(task);
    byWorker.set(task.workerId, list);
  }

  let sent = 0;
  let hidden = 0;
  let failed = 0;

  for (const worker of workers) {
    if (worker.chat_id == null) continue;
    const list = byWorker.get(worker.id) ?? [];
    const menuOk = await setStaffTaskCommand(
      worker.chat_id.toString(),
      list.length > 0
    );
    if (!menuOk) failed += 1;
    if (list.length === 0) {
      hidden += 1;
      continue;
    }

    const parts = splitTelegramText(formatTaskDigest(list));
    let delivered = true;
    for (const part of parts) {
      const ok = await sendStaffTextNotification(worker.chat_id.toString(), part);
      if (!ok) delivered = false;
    }
    if (delivered) sent += 1;
    else failed += 1;
  }

  return {
    sent,
    hidden,
    failed,
    workersWithChat: workers.length,
    tasksWithoutChat,
  };
}
