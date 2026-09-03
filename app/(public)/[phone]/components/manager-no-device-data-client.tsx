"use client";

import { NO_DEVICE_DATA_WARN } from "@/lib/collection-alert";
import type { ManagerPublicNoDeviceData } from "@/lib/manager-public";

function money(n: number) {
  return `${n.toLocaleString("uk-UA", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} грн`;
}

export function ManagerNoDeviceDataClient({
  events,
}: {
  events: ManagerPublicNoDeviceData[];
}) {
  if (events.length === 0) return null;

  return (
    <section className="mb-6 overflow-hidden rounded-2xl border border-amber-200 bg-white shadow-sm dark:border-amber-900/50 dark:bg-slate-900">
      <div className="border-b border-amber-100 bg-amber-50/80 px-4 py-3 text-sm font-medium text-amber-950 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-100">
        Warn: {NO_DEVICE_DATA_WARN} ({events.length})
      </div>
      <ul className="divide-y divide-slate-100 dark:divide-slate-800">
        {events.map((e) => (
          <li key={e.id} className="px-4 py-4">
            <p className="font-medium text-slate-900 dark:text-slate-100">
              {e.machine}
            </p>
            <p className="text-sm text-slate-500">
              {e.technicianName} · здача #{e.handoverId}
            </p>
            <p className="mt-1 text-sm tabular-nums text-slate-700 dark:text-slate-300">
              Сума від касира {money(e.amount)}
            </p>
            <p className="text-xs text-slate-400">
              {e.dateLabel} · {e.timeLabel}
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}
