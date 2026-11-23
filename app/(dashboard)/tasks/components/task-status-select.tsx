"use client";

import { useEffect, useState } from "react";
import axios from "axios";
import { useRouter } from "next/navigation";
import { toast } from "react-hot-toast";

import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CABINET_TASK_STATUSES, taskStatusLabel } from "@/lib/task-fields";

export function TaskStatusSelect({
  taskId,
  status,
  showCloseButton = false,
  className,
}: {
  taskId: number;
  status: string | null;
  showCloseButton?: boolean;
  className?: string;
}) {
  const router = useRouter();
  const [value, setValue] = useState(status || "todo");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setValue(status || "todo");
  }, [status]);

  const options = CABINET_TASK_STATUSES.some((item) => item.value === value)
    ? CABINET_TASK_STATUSES
    : [
        ...CABINET_TASK_STATUSES,
        { value, label: taskStatusLabel(value) },
      ];

  const onChange = async (next: string) => {
    if (next === value) return;
    const previous = value;
    setValue(next);
    setLoading(true);
    try {
      await axios.patch(`/api/tasks/${taskId}/status`, { status: next });
      toast.success(next === "done" ? "Задачу закрито" : "Статус оновлено");
      router.refresh();
    } catch (error) {
      setValue(previous);
      const msg = axios.isAxiosError(error)
        ? error.response?.data || "Не вдалося змінити статус"
        : "Не вдалося змінити статус";
      toast.error(typeof msg === "string" ? msg : "Не вдалося змінити статус");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      data-row-click-ignore
      className="flex flex-wrap items-center gap-2"
      onClick={(event) => event.stopPropagation()}
      onPointerDown={(event) => event.stopPropagation()}
    >
      <Select value={value} onValueChange={onChange} disabled={loading}>
        <SelectTrigger className={className ?? "h-8 w-[240px]"}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((item) => (
            <SelectItem key={item.value} value={item.value}>
              {item.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {showCloseButton && value !== "done" ? (
        <Button
          type="button"
          variant="secondary"
          size="sm"
          disabled={loading}
          onClick={() => onChange("done")}
        >
          Закрити задачу
        </Button>
      ) : null}
    </div>
  );
}
