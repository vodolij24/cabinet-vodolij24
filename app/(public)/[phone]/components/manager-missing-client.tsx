"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import axios from "axios";
import { toast } from "react-hot-toast";

import { Button } from "@/components/ui/button";
import type { ManagerPublicMissing } from "@/lib/manager-public";

function money(n: number) {
  return `${n.toLocaleString("uk-UA", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} грн`;
}

export function ManagerMissingClient({
  phone,
  events,
}: {
  phone: string;
  events: ManagerPublicMissing[];
}) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<number | null>(null);

  const ack = async (id: number) => {
    try {
      setBusyId(id);
      await axios.post(`/api/public/manager/${phone}/missing/${id}`);
      toast.success("Ознайомлено");
      router.refresh();
    } catch {
      toast.error("Не вдалося підтвердити");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <section className="mb-6 overflow-hidden rounded-2xl border border-rose-100 bg-white shadow-sm dark:border-rose-900/40 dark:bg-slate-900">
      <div className="border-b border-rose-50 bg-rose-50/70 px-4 py-3 text-sm font-medium text-rose-900 dark:border-rose-900/40 dark:bg-rose-950/30 dark:text-rose-200">
        Відсутні інкасації ({events.length})
      </div>
      {events.length === 0 ? (
        <p className="px-4 py-8 text-center text-sm text-slate-500 dark:text-slate-400">
          Немає відсутніх пакетів
        </p>
      ) : (
        <ul className="divide-y divide-slate-100 dark:divide-slate-800">
          {events.map((e) => (
            <li
              key={e.id}
              className="flex flex-wrap items-start justify-between gap-3 px-4 py-4"
            >
              <div>
                <p className="font-medium text-slate-900 dark:text-slate-100">
                  {e.machine}
                </p>
                <p className="text-sm text-slate-500">
                  {e.technicianName} · здача #{e.handoverId}
                </p>
                <p className="mt-1 text-sm tabular-nums text-slate-700 dark:text-slate-300">
                  Очікувана сума {money(e.expectedSum)}
                </p>
                <p className="text-xs text-slate-400">
                  {e.dateLabel} · {e.timeLabel}
                </p>
              </div>
              <Button
                size="sm"
                disabled={busyId === e.id}
                onClick={() => void ack(e.id)}
              >
                Ознайомлений
              </Button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
