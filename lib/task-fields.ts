export const TASK_TYPES = [
  { value: "operational", label: "Операційна" },
  { value: "financial", label: "Фінансова" },
] as const;

export type TaskType = (typeof TASK_TYPES)[number]["value"];

export const TASK_SCHEDULES = [
  { value: "once", label: "Одноразова" },
  { value: "monthly", label: "Регулярна (щомісяця)" },
] as const;

export type TaskSchedule = (typeof TASK_SCHEDULES)[number]["value"];

export function isTaskType(value: unknown): value is TaskType {
  return value === "operational" || value === "financial";
}

export function isTaskSchedule(value: unknown): value is TaskSchedule {
  return value === "once" || value === "monthly";
}

export function taskTypeLabel(type: string | null | undefined): string {
  if (type === "financial") return "Фінансова";
  return "Операційна";
}

export function taskScheduleLabel(schedule: string | null | undefined): string {
  if (schedule === "monthly") return "Щомісяця";
  if (schedule === "once") return "Одноразова";
  return "—";
}

/** Ціле число грн ≥ 0, кратне 100, або null якщо порожньо */
export function parseSalaryDeduction(value: unknown): number | null | "invalid" {
  if (value === null || value === undefined || value === "") {
    return null;
  }
  let n: number;
  if (typeof value === "number") {
    if (!Number.isInteger(value) || value < 0) return "invalid";
    n = value;
  } else if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return null;
    if (!/^\d+$/.test(trimmed)) return "invalid";
    n = parseInt(trimmed, 10);
  } else {
    return "invalid";
  }
  if (n % 100 !== 0) return "invalid";
  return n;
}

export function currentPeriodKey(date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

export const TASK_STATUS = {
  todo: "todo",
  awaiting_manager_confirm: "awaiting_manager_confirm",
  awaiting_manager_decision: "awaiting_manager_decision",
  /** Технік відхилив задачу з утриманням — утримання вже застосовано, керівник лише ознайомлюється */
  awaiting_manager_ack: "awaiting_manager_ack",
  done: "done",
} as const;

export const MANAGER_DECISION = {
  accepted: "accepted",
  rejected: "rejected",
  acknowledged: "acknowledged",
} as const;

export function taskStatusLabel(status: string | null | undefined): string {
  switch (status) {
    case "awaiting_manager_confirm":
      return "Очікує підтвердження керівника";
    case "awaiting_manager_decision":
      return "Очікує рішення керівника";
    case "awaiting_manager_ack":
      return "Очікує ознайомлення керівника";
    case "done":
      return "Закрито";
    case "in_progress":
      return "В роботі";
    case "todo":
    default:
      return status === "todo" || !status ? "До виконання" : status;
  }
}

export function managerDecisionLabel(
  decision: string | null | undefined,
  deductionApplied?: boolean | null
): string {
  if (decision === MANAGER_DECISION.accepted) {
    return "Прийнято · без утримання";
  }
  if (decision === MANAGER_DECISION.rejected) {
    return deductionApplied
      ? "Не прийнято · утримання застосовано"
      : "Не прийнято";
  }
  if (decision === MANAGER_DECISION.acknowledged) {
    return deductionApplied
      ? "Ознайомлено · утримання застосовано"
      : "Ознайомлено";
  }
  return "—";
}

export function isTechnicianActionableStatus(
  status: string | null | undefined
): boolean {
  return !status || status === "todo" || status === "in_progress";
}

export function isManagerReviewableStatus(
  status: string | null | undefined
): boolean {
  return (
    status === TASK_STATUS.awaiting_manager_confirm ||
    status === TASK_STATUS.awaiting_manager_decision ||
    status === TASK_STATUS.awaiting_manager_ack
  );
}

/** Відхилення техніком із утриманням — лише «Ознайомлений» */
export function isManagerAckOnlyTask(task: {
  status: string | null | undefined;
  salaryDeduction?: number | null;
  rejectReason?: string | null;
  deductionApplied?: boolean | null;
}): boolean {
  return (
    task.status === TASK_STATUS.awaiting_manager_ack ||
    (task.status === TASK_STATUS.awaiting_manager_decision &&
      Boolean(task.rejectReason) &&
      task.salaryDeduction != null &&
      task.salaryDeduction > 0 &&
      Boolean(task.deductionApplied))
  );
}
