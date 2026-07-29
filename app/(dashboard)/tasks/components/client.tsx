"use client";

import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";

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

  return (
    <>
      <div className="flex items-center justify-between">
        <Heading
          title={`Завдання (${data.length})`}
          description="Редагування і відслідковування задач"
        />
        <Button onClick={() => router.push(`/tasks/new`)}>
          <Plus className="mr-2 h-4 w-4" /> Додати нову задачу
        </Button>
      </div>
      <Separator />
      <DataTable searchKey="deviceId" columns={columns} data={data} />
    </>
  );
};
