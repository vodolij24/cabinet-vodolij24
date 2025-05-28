"use client";

import { Plus } from "lucide-react";
import { useParams, useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/ui/data-table";
import { Heading } from "@/components/ui/heading";
import { Separator } from "@/components/ui/separator";

import { BotTrransactionsColumn, columns} from "./columns";
import { DataTableTransactions } from "@/components/ui/data-table-transactions";

interface SizesClientProps {
  data: BotTrransactionsColumn[];
}

export const BotTransactions: React.FC<SizesClientProps> = ({
  data
}) => {
  const params = useParams();
  const router = useRouter();

  return (
    <>
      <div className="flex items-center justify-between">
        <Heading title={`Транзакції (${data.length})`} description="Транзакції через бота" />
      
      </div>
      <Separator />
      <DataTableTransactions searchKey="date" columns={columns} data={data} />
    </>
  );
};
