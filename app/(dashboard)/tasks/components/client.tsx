"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import axios from "axios";
import { toast } from "react-hot-toast";

import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/ui/data-table";
import { Heading } from "@/components/ui/heading";
import { Separator } from "@/components/ui/separator";

import { columns, TaskColumn } from "./columns";

interface TasksClientProps {
  data: TaskColumn[];
}

export const TasksClient: React.FC<TasksClientProps> = ({ data }) => {
  const router = useRouter();
  const [generating, setGenerating] = useState(false);

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
          description="Назва, база, термін, утримання, виконавець (один / кілька / категорія)."
        />
        <div className="flex flex-wrap gap-2">
          <Button
            variant="secondary"
            disabled={generating}
            onClick={onGenerateMonthly}
          >
            {generating ? "Створення…" : "Місячні фінансові для техніків"}
          </Button>
          <Button onClick={() => router.push(`/tasks/new`)}>
            <Plus className="mr-2 h-4 w-4" /> Додати нову задачу
          </Button>
        </div>
      </div>
      <Separator />
      <DataTable searchKey="title" columns={columns} data={data} />
    </>
  );
};
