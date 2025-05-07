"use client";

import { Plus } from "lucide-react";
import { useParams, useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/ui/data-table";
import { Heading } from "@/components/ui/heading";
import { Separator } from "@/components/ui/separator";

import { columns, DailyStatColumn } from "./columns";

interface SizesClientProps {
  data: DailyStatColumn[];
}

export const SizesClient: React.FC<SizesClientProps> = ({
  data
}) => {
  const params = useParams();
  const router = useRouter();

  return (
    <>
      <div className="flex items-center justify-between">
        <Heading title={`Щоденна статистика (${data.length})`} description="Статистика набору води через бота" />
      
      </div>
      <Separator />
      <DataTable searchKey="date" columns={columns} data={data} />
    </>
  );
};
