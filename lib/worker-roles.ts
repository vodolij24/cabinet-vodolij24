export const WORKER_ROLES = [
  { value: "manager", label: "Керівник" },
  { value: "technician", label: "Технік" },
  { value: "financier", label: "Фінансист" },
  { value: "cashier", label: "Касир" },
  { value: "area", label: "Площина" },
] as const;

export type WorkerRole = (typeof WORKER_ROLES)[number]["value"];

export const WORKER_ROLE_VALUES = WORKER_ROLES.map((r) => r.value);

export function isWorkerRole(value: unknown): value is WorkerRole {
  return (
    typeof value === "string" &&
    (WORKER_ROLE_VALUES as readonly string[]).includes(value)
  );
}

export function workerRoleLabel(role: string | null | undefined): string {
  if (!role) return "—";
  return WORKER_ROLES.find((r) => r.value === role)?.label ?? role;
}
