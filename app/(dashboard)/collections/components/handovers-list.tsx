"use client";

import { useMemo, useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";

import { handoverAlert } from "@/lib/collection-alert";

import type { CollectionColumn } from "./columns";
import { RecountCell } from "./recount-cell";
import { CollectionStatusBadge } from "./status-badge";

function money(n: number) {
  return `${n.toLocaleString("uk-UA", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} грн`;
}

type HandoverGroup = {
  id: number;
  technicianName: string;
  cashierName: string;
  date: string;
  time: string;
  dateMs: number;
  claimedPackages: number;
  receivedPackages: number;
  expectedSum: number;
  actualSum: number | null;
  packages: CollectionColumn[];
};

function groupHandovers(rows: CollectionColumn[]): HandoverGroup[] {
  const map = new Map<number, CollectionColumn[]>();
  for (const row of rows) {
    if (row.handoverId == null) continue;
    const list = map.get(row.handoverId) ?? [];
    list.push(row);
    map.set(row.handoverId, list);
  }

  return Array.from(map.entries())
    .map(([id, packages]) => {
      const first = packages[0];
      const expectedSum = packages.reduce((s, p) => s + p.totalValue, 0);
      const recounted = packages.filter(
        (p) => p.recountStatus === "done" && p.actualReceived != null
      );
      const actualSum =
        recounted.length === 0
          ? null
          : recounted.reduce((s, p) => s + (p.actualReceived ?? 0), 0);

      return {
        id,
        technicianName: first.technicianName,
        cashierName: first.cashierName,
        date: first.handoverDate,
        time: first.handoverTime,
        dateMs: first.handoverDateMs,
        claimedPackages: first.claimedPackages,
        receivedPackages: first.receivedPackages,
        expectedSum,
        actualSum,
        packages: packages.sort((a, b) => b.dateMs - a.dateMs),
      };
    })
    .sort((a, b) => b.dateMs - a.dateMs);
}

export function HandoversList({ data }: { data: CollectionColumn[] }) {
  const groups = useMemo(() => groupHandovers(data), [data]);
  const [openIds, setOpenIds] = useState<Set<number>>(() => new Set());

  const toggle = (id: number) => {
    setOpenIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  if (groups.length === 0) {
    return (
      <p className="rounded-md border px-4 py-8 text-center text-sm text-muted-foreground">
        Поки немає здач касиру
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {groups.map((group) => {
        const open = openIds.has(group.id);
        const alert = handoverAlert(group.packages);
        const mismatch = group.claimedPackages !== group.receivedPackages;
        return (
          <div
            key={group.id}
            className="overflow-hidden rounded-md border bg-card"
          >
            <button
              type="button"
              className="flex w-full flex-wrap items-center gap-3 px-4 py-3 text-left"
              onClick={() => toggle(group.id)}
            >
              {open ? (
                <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
              ) : (
                <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
              )}
              <div className="min-w-[180px] flex-1">
                <p className="font-medium">
                  Здача #{group.id} · {group.technicianName}
                </p>
                <p className="text-xs text-muted-foreground">
                  {group.date} {group.time}
                  {group.cashierName ? ` · ${group.cashierName}` : ""}
                </p>
              </div>
              <p className="text-sm tabular-nums text-muted-foreground">
                {group.packages.length} пакет.
                {mismatch
                  ? ` · заявлено ${group.claimedPackages} / отримано ${group.receivedPackages}`
                  : ""}
              </p>
              <p className="text-sm font-medium tabular-nums">
                {money(group.expectedSum)}
              </p>
              <CollectionStatusBadge alert={alert} />
            </button>

            {open ? (
              <div className="border-t">
                <table className="w-full text-sm">
                  <thead className="bg-muted/40 text-left text-xs text-muted-foreground">
                    <tr>
                      <th className="px-4 py-2 font-medium">Автомат</th>
                      <th className="px-3 py-2 font-medium">Дата</th>
                      <th className="px-3 py-2 font-medium">Метал</th>
                      <th className="px-3 py-2 font-medium">Папір</th>
                      <th className="px-3 py-2 font-medium">Очікувано</th>
                      <th className="px-3 py-2 font-medium">Фактично</th>
                      <th className="px-3 py-2 font-medium">Різниця</th>
                      <th className="px-3 py-2 font-medium">Статус</th>
                      <th className="px-3 py-2 font-medium" />
                    </tr>
                  </thead>
                  <tbody>
                    {group.packages.map((pkg) => (
                      <tr key={pkg.id} className="border-t">
                        <td className="px-4 py-2">{pkg.machine}</td>
                        <td className="px-3 py-2 whitespace-nowrap">
                          {pkg.date} {pkg.time}
                        </td>
                        <td className="px-3 py-2 tabular-nums">{pkg.sumCoins}</td>
                        <td className="px-3 py-2 tabular-nums">
                          {pkg.sumBanknotes}
                        </td>
                        <td className="px-3 py-2 tabular-nums">{pkg.total}</td>
                        <td className="px-3 py-2 tabular-nums">
                          {pkg.actualReceivedLabel}
                        </td>
                        <td className="px-3 py-2 tabular-nums">
                          {pkg.differenceLabel}
                        </td>
                        <td className="px-3 py-2">
                          <CollectionStatusBadge alert={pkg.alert} />
                        </td>
                        <td className="px-3 py-2 text-right">
                          <RecountCell data={pkg} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
