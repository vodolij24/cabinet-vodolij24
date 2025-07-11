"use client";

import { Plus } from "lucide-react";
import { useParams, useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/ui/data-table";
import { Heading } from "@/components/ui/heading";
import { Separator } from "@/components/ui/separator";

import { columns, TaskColumn } from "./columns";

interface SizesClientProps {
  data: TaskColumn[];
}

export const SizesClient: React.FC<SizesClientProps> = ({
  data
}) => {
  const params = useParams();
  const router = useRouter();

  return (
    <>
      <div className="flex items-center justify-between">
        <Heading title={`Завдання (${data.length})`} description="Редагування і відслідковування задач" />
        <Button onClick={() => router.push(`/${params.storeId}/tasks/new`)}>
          <Plus className="mr-2 h-4 w-4" /> Додати нову задачу
        </Button>
      
      </div>
      <Separator />
      <DataTable searchKey="id" columns={columns} data={data} />
    </>
  );
};
