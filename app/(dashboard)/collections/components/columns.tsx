"use client";

import { ColumnDef } from "@tanstack/table-core";
import { MessageCircle } from "lucide-react";

import type { RecountAlert } from "@/lib/collection-alert";

import { CellAction } from "./cell-action";
import { CollectionStatusBadge } from "./status-badge";

export type CollectionColumn = {
  id: number;
  machine: string;
  deviceId: number | null;
  date: string;
  time: string;
  dateMs: number;
  technicianId: number | null;
  technicianName: string;
  cashierName: string;
  countCoins: number;
  sumCoinsValue: number;
  sumCoins: string;
  countBanknotes: number;
  sumBanknotesValue: number;
  sumBanknotes: string;
  totalValue: number;
  total: string;
  handedOver: boolean;
  handoverId: number | null;
  handoverDate: string;
  handoverTime: string;
  handoverDateMs: number;
  claimedPackages: number;
  receivedPackages: number;
  recountStatus: string | null;
  recountClosed: boolean;
  actualReceived: number | null;
  actualReceivedLabel: string;
  difference: number | null;
  differenceLabel: string;
  alert: RecountAlert | null;
  openTicket: boolean;
  search: string;
};

export const columns: ColumnDef<CollectionColumn>[] = [
  {
    accessorKey: "machine",
    header: "Автомат",
    cell: ({ row }) => (
      <span className="inline-flex items-center gap-1.5">
        {row.original.openTicket ? (
          <MessageCircle
            className="h-4 w-4 shrink-0 text-sky-600"
            aria-label="Відкрите звернення"
          />
        ) : null}
        {row.original.machine}
      </span>
    ),
  },
  {
    accessorKey: "date",
    header: "Дата",
  },
  {
    accessorKey: "time",
    header: "Час",
  },
  {
    accessorKey: "technicianName",
    header: "Технік",
  },
  {
    accessorKey: "countCoins",
    header: "К-сть монет",
  },
  {
    accessorKey: "sumCoins",
    header: "Сума монет",
  },
  {
    accessorKey: "countBanknotes",
    header: "К-сть купюр",
  },
  {
    accessorKey: "sumBanknotes",
    header: "Сума купюр",
  },
  {
    accessorKey: "total",
    header: "Разом",
  },
  {
    accessorKey: "actualReceivedLabel",
    header: "Фактично",
  },
  {
    accessorKey: "differenceLabel",
    header: "Різниця",
    cell: ({ row }) => {
      const diff = row.original.difference;
      if (diff == null) return "—";
      return (
        <span
          className={
            row.original.alert === "alarm"
              ? "font-medium text-red-700 dark:text-red-300"
              : row.original.alert === "warning"
                ? "font-medium text-amber-700 dark:text-amber-300"
                : undefined
          }
        >
          {row.original.differenceLabel}
        </span>
      );
    },
  },
  {
    id: "status",
    header: "Статус",
    cell: ({ row }) => <CollectionStatusBadge alert={row.original.alert} />,
  },
  {
    id: "actions",
    cell: ({ row }) => <CellAction data={row.original} />,
  },
];
