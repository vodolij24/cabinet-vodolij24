"use client";

import { Heading } from "@/components/ui/heading";
import { Separator } from "@/components/ui/separator";

import { BotTrransactionsColumn, columns } from "./columns";
import { DataTableTransactions } from "@/components/ui/data-table-transactions";

interface BotTransactionsProps {
  data: BotTrransactionsColumn[];
}

export const BotTransactions: React.FC<BotTransactionsProps> = ({ data }) => {
  return (
    <>
      <div className="flex items-center justify-between">
        <Heading
          title={`Транзакції (${data.length})`}
          description="Транзакції за останні 30 днів"
        />
      </div>
      <Separator />
      <DataTableTransactions searchKey="cardId" columns={columns} data={data} />
    </>
  );
};
