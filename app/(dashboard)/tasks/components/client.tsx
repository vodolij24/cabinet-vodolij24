"use client";

import { useMemo, useState } from "react";
import { CalendarClock, Plus, Wallet } from "lucide-react";
import { useRouter } from "next/navigation";
import axios from "axios";
import { toast } from "react-hot-toast";

import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/ui/data-table";
import { Heading } from "@/components/ui/heading";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { isManagerReviewableStatus } from "@/lib/task-fields";

import { columns, TaskColumn } from "./columns";

interface TasksClientProps {
  data: TaskColumn[];
}

export const TasksClient: React.FC<TasksClientProps> = ({ data }) => {
  const router = useRouter();
  const [generating, setGenerating] = useState(false);
  const [query, setQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterType, setFilterType] = useState("all");
  const [filterWorker, setFilterWorker] = useState("all");

  const workers = useMemo(() => {
    const map = new Map<string, string>();
    for (const row of data) {
      if (row.workerName) map.set(row.workerName, row.workerName);
    }
    return Array.from(map.values()).sort((a, b) => a.localeCompare(b, "uk"));
  }, [data]);

  const counts = useMemo(() => {
    let todo = 0;
    let awaiting = 0;
    let done = 0;
    for (const row of data) {
      if (row.statusKey === "done") done += 1;
      else if (isManagerReviewableStatus(row.statusKey)) awaiting += 1;
      else todo += 1;
    }
    return { todo, awaiting, done };
  }, [data]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return data.filter((row) => {
      if (filterType !== "all" && row.typeKey !== filterType) return false;

      if (filterStatus === "todo") {
        if (
          row.statusKey === "done" ||
          isManagerReviewableStatus(row.statusKey)
        ) {
          return false;
        }
      } else if (filterStatus === "awaiting") {
        if (!isManagerReviewableStatus(row.statusKey)) return false;
      } else if (filterStatus === "done") {
        if (row.statusKey !== "done") return false;
      }

      if (filterWorker !== "all" && row.workerName !== filterWorker) {
        return false;
      }

      if (!q) return true;
      const hay = [
        row.title,
        row.baseLocation,
        row.workerName,
        String(row.id),
        row.status || "",
      ]
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [data, query, filterStatus, filterType, filterWorker]);

  const onGenerateMonthly = async () => {
    try {
      setGenerating(true);
      const { data: result } = await axios.post("/api/tasks/generate-monthly");
      toast.success(
        `Місячні фінансові: створено ${result.created}, пропущено ${result.skipped} (${result.periodKey})`
      );
      router.refresh();
    } catch {
      toast.error("Не вдалося створити місячні задачі");
    } finally {
      setGenerating(false);
    }
  };

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Heading
          title={`Завдання (${data.length})`}
          description="Операційні та фінансові задачі · статуси · утримання."
        />
        <div className="flex flex-wrap gap-2">
          <Button
            variant="secondary"
            disabled={generating}
            onClick={onGenerateMonthly}
          >
            <Wallet className="mr-2 h-4 w-4" />
            {generating ? "Створення…" : "Місячні фінансові"}
          </Button>
          <Button onClick={() => router.push(`/tasks/new`)}>
            <Plus className="mr-2 h-4 w-4" /> Додати задачу
          </Button>
        </div>
      </div>
      <Separator />

      <div className="flex flex-wrap gap-2 text-sm">
        <span className="inline-flex items-center gap-1.5 rounded-md border bg-muted/40 px-2.5 py-1 text-muted-foreground">
          <CalendarClock className="h-3.5 w-3.5" />
          До виконання:{" "}
          <span className="font-medium text-foreground">{counts.todo}</span>
        </span>
        <span className="inline-flex items-center gap-1.5 rounded-md border border-amber-200 bg-amber-50 px-2.5 py-1 text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100">
          Очікує керівника:{" "}
          <span className="font-medium">{counts.awaiting}</span>
        </span>
        <span className="inline-flex items-center gap-1.5 rounded-md border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-100">
          Закрито: <span className="font-medium">{counts.done}</span>
        </span>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <label className="text-sm text-muted-foreground">Пошук</label>
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Назва, база, виконавець…"
            className="w-[240px]"
          />
        </div>
        <div className="space-y-1">
          <label className="text-sm text-muted-foreground">Статус</label>
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-[200px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Усі</SelectItem>
              <SelectItem value="todo">До виконання</SelectItem>
              <SelectItem value="awaiting">Очікує керівника</SelectItem>
              <SelectItem value="done">Закрито</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <label className="text-sm text-muted-foreground">Тип</label>
          <Select value={filterType} onValueChange={setFilterType}>
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Усі</SelectItem>
              <SelectItem value="operational">Операційна</SelectItem>
              <SelectItem value="financial">Фінансова</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <label className="text-sm text-muted-foreground">Виконавець</label>
          <Select value={filterWorker} onValueChange={setFilterWorker}>
            <SelectTrigger className="w-[200px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Усі</SelectItem>
              {workers.map((name) => (
                <SelectItem key={name} value={name}>
                  {name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <span className="pb-2 text-sm text-muted-foreground">
          Показано {filtered.length} з {data.length}
        </span>
      </div>

      <DataTable searchKey="title" columns={columns} data={filtered} hideSearch />
    </>
  );
};
