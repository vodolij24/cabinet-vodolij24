"use client";

import { DataTable } from "@/components/ui/data-table";
import { Heading } from "@/components/ui/heading";
import { Separator } from "@/components/ui/separator";

import { columns, DailyStatColumn } from "./columns";

interface StatisticsClientProps {
  data: DailyStatColumn[];
}

export const StatisticsClient: React.FC<StatisticsClientProps> = ({ data }) => {
  return (
    <>
      <div className="flex items-center justify-between">
        <Heading
          title={`Щоденна статистика (${data.length})`}
          description="Статистика набору води через бота"
        />
      </div>
      <Separator />
      <DataTable searchKey="topDeviceId" columns={columns} data={data} />
    </>
  );
};
