"use client";

import * as z from "zod";
import axios from "axios";
import { useMemo, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "react-hot-toast";
import { Trash } from "lucide-react";
import { tasks, workers } from "@/lib/generated/prisma";
import { useRouter } from "next/navigation";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Separator } from "@/components/ui/separator";
import { Heading } from "@/components/ui/heading";
import { AlertModal } from "@/components/modals/alert-modal";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TASK_SCHEDULES, TASK_TYPES } from "@/lib/task-fields";
import { WORKER_ROLES } from "@/lib/worker-roles";

const formSchema = z
  .object({
    title: z.string().min(1, "Назва обовʼязкова"),
    description: z.string(),
    baseLocation: z.string(),
    dueAt: z.string(),
    type: z.enum(["operational", "financial"]),
    schedule: z.enum(["once", "monthly"]),
    salaryDeduction: z.string(),
    deviceId: z.string(),
    priority: z.string(),
    assignMode: z.enum(["one", "many", "role"]),
    workerId: z.string(),
    workerIds: z.array(z.string()),
    assignRole: z.string(),
  })
  .superRefine((data, ctx) => {
    const hasDevice = data.deviceId && data.deviceId !== "none";
    if (!hasDevice && !data.baseLocation.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "База (локація) обовʼязкова без апарату",
        path: ["baseLocation"],
      });
    }

    if (data.salaryDeduction.trim()) {
      if (!/^\d+$/.test(data.salaryDeduction.trim())) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Лише цілі числа (грн)",
          path: ["salaryDeduction"],
        });
      } else if (parseInt(data.salaryDeduction.trim(), 10) % 100 !== 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Сума має бути кратна 100",
          path: ["salaryDeduction"],
        });
      }
    }

    if (data.assignMode === "one" && !data.workerId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Оберіть виконавця",
        path: ["workerId"],
      });
    }
    if (data.assignMode === "many" && data.workerIds.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Оберіть хоча б одного виконавця",
        path: ["workerIds"],
      });
    }
    if (data.assignMode === "role" && !data.assignRole) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Оберіть категорію",
        path: ["assignRole"],
      });
    }
  });

type TaskFormValues = z.infer<typeof formSchema>;

interface TaskFormProps {
  initialData: tasks | null;
  workers: workers[];
  machines: {
    id: number;
    name: string | null;
    location: string;
    technicianId: number | null;
  }[];
}

function toDateInputValue(d: Date | null | undefined) {
  if (!d) return "";
  const date = new Date(d);
  if (Number.isNaN(date.getTime())) return "";
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function machineLabel(m: {
  id: number;
  name: string | null;
  location: string;
}) {
  const parts = [`№${m.id}`];
  if (m.name?.trim()) parts.push(m.name.trim());
  if (m.location?.trim()) parts.push(m.location.trim());
  return parts.join(" · ");
}

export const DriversForm: React.FC<TaskFormProps> = ({
  initialData,
  workers,
  machines,
}) => {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const isEdit = !!initialData;

  const title = isEdit ? "Редагувати завдання" : "Створити завдання";
  const description = isEdit ? "Редагувати завдання." : "Створити завдання";
  const toastMessage = isEdit ? "Завдання оновлено." : "Завдання створено.";
  const action = isEdit ? "Зберегти зміни" : "Створити";

  const form = useForm<TaskFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: initialData
      ? {
          title: initialData.title || "",
          description: initialData.description || "",
          baseLocation: initialData.baseLocation || "",
          dueAt: toDateInputValue(initialData.dueAt),
          type:
            initialData.type === "financial" ? "financial" : "operational",
          schedule:
            initialData.schedule === "monthly" ? "monthly" : "once",
          salaryDeduction:
            initialData.salaryDeduction != null
              ? String(initialData.salaryDeduction)
              : "",
          deviceId: initialData.deviceId
            ? String(initialData.deviceId)
            : "none",
          priority: initialData.priority || "medium",
          assignMode: "one",
          workerId: String(initialData.workerId || ""),
          workerIds: initialData.workerId
            ? [String(initialData.workerId)]
            : [],
          assignRole: "",
        }
      : {
          title: "",
          description: "",
          baseLocation: "",
          dueAt: "",
          type: "operational",
          schedule: "once",
          salaryDeduction: "",
          deviceId: "none",
          priority: "medium",
          assignMode: "one",
          workerId: "",
          workerIds: [],
          assignRole: "",
        },
  });

  const taskType = form.watch("type");
  const assignMode = form.watch("assignMode");
  const workerIds = form.watch("workerIds");
  const workerId = form.watch("workerId");
  const deviceId = form.watch("deviceId");
  const hasSelectedDevice = Boolean(deviceId && deviceId !== "none");

  const activeWorkers = useMemo(
    () => workers.filter((w) => w.active !== false),
    [workers]
  );

  const selectedTechnicianIds = useMemo(() => {
    if (isEdit || assignMode === "one") {
      const id = parseInt(workerId || "", 10);
      return Number.isFinite(id) ? new Set([id]) : new Set<number>();
    }
    if (assignMode === "many") {
      return new Set(
        workerIds
          .map((id) => parseInt(id, 10))
          .filter((id) => Number.isFinite(id))
      );
    }
    return new Set<number>();
  }, [isEdit, assignMode, workerId, workerIds]);

  const sortedMachines = useMemo(() => {
    const assigned: typeof machines = [];
    const rest: typeof machines = [];
    for (const m of machines) {
      if (
        m.technicianId != null &&
        selectedTechnicianIds.has(m.technicianId)
      ) {
        assigned.push(m);
      } else {
        rest.push(m);
      }
    }
    return [...assigned, ...rest];
  }, [machines, selectedTechnicianIds]);

  const onSubmit = async (data: TaskFormValues) => {
    try {
      setLoading(true);
      const payload: Record<string, unknown> = {
        title: data.title,
        description: data.description,
        baseLocation: data.baseLocation.trim() || null,
        dueAt: data.dueAt || null,
        type: data.type,
        schedule: data.type === "financial" ? data.schedule : null,
        salaryDeduction: data.salaryDeduction.trim()
          ? parseInt(data.salaryDeduction.trim(), 10)
          : null,
        deviceId:
          data.deviceId && data.deviceId !== "none"
            ? parseInt(data.deviceId, 10)
            : null,
        priority: data.priority,
      };

      if (isEdit) {
        payload.workerId = data.workerId;
        await axios.patch(`/api/tasks/${initialData!.id}`, payload);
      } else if (data.assignMode === "role") {
        payload.assignRole = data.assignRole;
        await axios.post(`/api/tasks`, payload);
      } else if (data.assignMode === "many") {
        payload.workerIds = data.workerIds;
        await axios.post(`/api/tasks`, payload);
      } else {
        payload.workerId = data.workerId;
        await axios.post(`/api/tasks`, payload);
      }

      router.refresh();
      router.push(`/tasks`);
      toast.success(toastMessage);
    } catch (error) {
      const msg = axios.isAxiosError(error)
        ? error.response?.data || "Трапилась помилка."
        : "Трапилась помилка.";
      toast.error(typeof msg === "string" ? msg : "Трапилась помилка.");
    } finally {
      setLoading(false);
    }
  };

  const onDelete = async () => {
    try {
      setLoading(true);
      await axios.delete(`/api/tasks/${initialData?.id}`);
      router.refresh();
      router.push(`/tasks`);
      toast.success("Завдання видалено.");
    } catch {
      toast.error("Make sure you removed all related data first.");
    } finally {
      setLoading(false);
      setOpen(false);
    }
  };

  const toggleWorker = (id: string, checked: boolean) => {
    const set = new Set(workerIds);
    if (checked) set.add(id);
    else set.delete(id);
    form.setValue("workerIds", [...set], { shouldValidate: true });
  };

  return (
    <>
      <AlertModal
        isOpen={open}
        onClose={() => setOpen(false)}
        onConfirm={onDelete}
        loading={loading}
      />

      <div className="flex items-center justify-between">
        <Heading title={title} description={description} />
        {initialData && (
          <Button
            disabled={loading}
            variant="destructive"
            size="sm"
            onClick={() => setOpen(true)}
          >
            <Trash className="h-4 w-4" />
          </Button>
        )}
      </div>

      <Separator />

      <Form {...form}>
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="w-full space-y-8"
        >
          <div className="gap-8 md:grid md:grid-cols-2">
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Назва</FormLabel>
                  <FormControl>
                    <Input
                      disabled={loading}
                      placeholder="Назва задачі"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="baseLocation"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    База (локація)
                    {hasSelectedDevice ? " (опційно)" : ""}
                  </FormLabel>
                  <FormControl>
                    <Input
                      disabled={loading}
                      placeholder={
                        hasSelectedDevice
                          ? "Опційно, якщо обрано апарат"
                          : "Локація / база"
                      }
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem className="md:col-span-2">
                  <FormLabel>Опис</FormLabel>
                  <FormControl>
                    <Input
                      disabled={loading}
                      placeholder="Опис задачі"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="dueAt"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Термін виконання</FormLabel>
                  <FormControl>
                    <Input type="date" disabled={loading} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="salaryDeduction"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Утримання із заробітної плати</FormLabel>
                  <FormControl>
                    <Input
                      disabled={loading}
                      inputMode="numeric"
                      placeholder="напр. 500, 1000 (кратно 100)"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Тип задачі</FormLabel>
                  <Select
                    disabled={loading}
                    onValueChange={field.onChange}
                    value={field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Тип" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {TASK_TYPES.map((t) => (
                        <SelectItem key={t.value} value={t.value}>
                          {t.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="deviceId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Апарат (опційно)</FormLabel>
                  <Select
                    disabled={loading}
                    onValueChange={field.onChange}
                    value={field.value || "none"}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Без апарату" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="none">Без апарату</SelectItem>
                      {sortedMachines.map((m) => {
                        const assigned =
                          m.technicianId != null &&
                          selectedTechnicianIds.has(m.technicianId);
                        return (
                          <SelectItem
                            key={m.id}
                            value={String(m.id)}
                            className={assigned ? "font-bold" : undefined}
                          >
                            {machineLabel(m)}
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {taskType === "financial" ? (
              <FormField
                control={form.control}
                name="schedule"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Розклад</FormLabel>
                    <Select
                      disabled={loading}
                      onValueChange={field.onChange}
                      value={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Розклад" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {TASK_SCHEDULES.map((s) => (
                          <SelectItem key={s.value} value={s.value}>
                            {s.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            ) : null}

            {!isEdit ? (
              <FormField
                control={form.control}
                name="assignMode"
                render={({ field }) => (
                  <FormItem className="md:col-span-2">
                    <FormLabel>Призначення</FormLabel>
                    <Select
                      disabled={loading}
                      onValueChange={field.onChange}
                      value={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="one">Одному співробітнику</SelectItem>
                        <SelectItem value="many">
                          Декільком співробітникам
                        </SelectItem>
                        <SelectItem value="role">
                          Усій категорії (ролі)
                        </SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            ) : null}

            {isEdit || assignMode === "one" ? (
              <FormField
                control={form.control}
                name="workerId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Виконавець</FormLabel>
                    <Select
                      disabled={loading}
                      onValueChange={field.onChange}
                      value={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Обрати працівника" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {activeWorkers.map((worker) => (
                          <SelectItem
                            key={worker.id}
                            value={String(worker.id)}
                          >
                            {worker.name}
                            {worker.role ? ` · ${worker.role}` : ""}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            ) : null}

            {!isEdit && assignMode === "many" ? (
              <FormField
                control={form.control}
                name="workerIds"
                render={() => (
                  <FormItem className="md:col-span-2">
                    <FormLabel>Виконавці</FormLabel>
                    <div className="max-h-56 space-y-2 overflow-y-auto rounded-md border p-3">
                      {activeWorkers.map((worker) => {
                        const id = String(worker.id);
                        const checked = workerIds.includes(id);
                        return (
                          <label
                            key={worker.id}
                            className="flex cursor-pointer items-center gap-2 text-sm"
                          >
                            <Checkbox
                              checked={checked}
                              onCheckedChange={(v) =>
                                toggleWorker(id, v === true)
                              }
                              disabled={loading}
                            />
                            <span>
                              {worker.name || `Worker #${worker.id}`}
                              {worker.role ? ` · ${worker.role}` : ""}
                            </span>
                          </label>
                        );
                      })}
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />
            ) : null}

            {!isEdit && assignMode === "role" ? (
              <FormField
                control={form.control}
                name="assignRole"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Категорія працівників</FormLabel>
                    <Select
                      disabled={loading}
                      onValueChange={field.onChange}
                      value={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Оберіть роль" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {WORKER_ROLES.map((r) => (
                          <SelectItem key={r.value} value={r.value}>
                            Усім: {r.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            ) : null}
          </div>

          <Button disabled={loading} className="ml-auto" type="submit">
            {action}
          </Button>
        </form>
      </Form>
    </>
  );
};
