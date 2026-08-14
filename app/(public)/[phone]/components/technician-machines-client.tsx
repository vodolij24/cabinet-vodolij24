"use client";

import { useState } from "react";
import axios from "axios";

import type {
  TechnicianPublicMachine,
  TechnicianPublicSensor,
} from "@/lib/technician-public";

function machineStatusLabel(status: string | null) {
  if (status === "operational") return "Працює";
  if (status === "maintenance") return "Сервіс";
  if (status === "out_of_service") return "Не працює";
  if (status === "low_water") return "Мало води";
  return status || "—";
}

function money(n: number) {
  return `${n.toLocaleString("uk-UA")} грн`;
}

function sensorStateClass(state: string | null) {
  const s = (state || "").toLowerCase();
  if (s === "on" || s === "ok" || s === "1") {
    return "text-emerald-700 dark:text-emerald-300";
  }
  if (s === "off" || s === "error" || s === "0") {
    return "text-rose-700 dark:text-rose-300";
  }
  return "text-slate-500";
}

export function TechnicianMachinesClient({
  phone,
  machines,
}: {
  phone: string;
  machines: TechnicianPublicMachine[];
}) {
  const [open, setOpen] = useState(false);
  const [sensorsById, setSensorsById] = useState<
    Record<number, TechnicianPublicSensor[]>
  >({});
  const [loadingSensors, setLoadingSensors] = useState(false);
  const [sensorsLoaded, setSensorsLoaded] = useState(false);
  const cashTotal = machines.reduce((s, m) => s + m.cashInMachine, 0);

  const toggle = async () => {
    const next = !open;
    setOpen(next);
    if (!next || sensorsLoaded || machines.length === 0) return;
    const already = machines.some((m) => (m.sensors || []).length > 0);
    if (already) {
      setSensorsLoaded(true);
      return;
    }
    try {
      setLoadingSensors(true);
      const { data } = await axios.get<{
        sensors: Record<string, TechnicianPublicSensor[]>;
      }>(`/api/public/technician/${phone}/sensors`);
      const mapped: Record<number, TechnicianPublicSensor[]> = {};
      for (const [id, list] of Object.entries(data.sensors || {})) {
        mapped[Number(id)] = list;
      }
      setSensorsById(mapped);
      setSensorsLoaded(true);
    } catch {
      setSensorsLoaded(true);
    } finally {
      setLoadingSensors(false);
    }
  };

  return (
    <section className="mt-6 overflow-hidden rounded-2xl border border-sky-100 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <button
        type="button"
        className="flex w-full items-center justify-between border-b border-sky-50 bg-sky-50/60 px-4 py-3 text-left dark:border-slate-800 dark:bg-slate-900/80"
        onClick={() => void toggle()}
      >
        <span className="text-sm font-medium text-sky-900 dark:text-sky-200">
          Автомати ({machines.length})
        </span>
        <span className="text-right text-xs text-slate-500">
          <span className="mr-3 tabular-nums">Каса {money(cashTotal)}</span>
          {open ? "Згорнути" : "Розгорнути"}
        </span>
      </button>

      {open ? (
        machines.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-slate-500 dark:text-slate-400">
            Поки немає призначених автоматів
          </p>
        ) : (
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            {machines.map((m) => {
              const sensors = sensorsById[m.id] || m.sensors || [];
              return (
                <li key={m.id} className="space-y-2 px-4 py-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="font-medium text-slate-900 dark:text-slate-100">
                        №{m.id}
                        {m.name ? ` · ${m.name}` : ""}
                      </p>
                      <p className="text-sm text-slate-500 dark:text-slate-400">
                        {m.location}
                      </p>
                      <p className="mt-1 text-xs text-slate-400">
                        {machineStatusLabel(m.status)}
                        {m.waterLitersMonth
                          ? ` · ${m.waterLitersMonth.toLocaleString("uk-UA")} л/міс`
                          : ""}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-semibold tabular-nums text-sky-800 dark:text-sky-300">
                        {money(m.cashInMachine)}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {m.lastCollectionDate
                          ? `інкас. ${m.lastCollectionDate}${
                              m.lastCollectionSum != null
                                ? ` · ${money(m.lastCollectionSum)}`
                                : ""
                            }`
                          : "інкасацій немає"}
                      </p>
                    </div>
                  </div>

                  {(m.filterSpeed != null || m.waterTds != null) && (
                    <p className="text-xs text-slate-500">
                      {m.filterSpeed != null
                        ? `Швидкість фільтра ${m.filterSpeed.toLocaleString(
                            "uk-UA",
                            { maximumFractionDigits: 1 }
                          )}`
                        : ""}
                      {m.filterSpeed != null && m.waterTds != null
                        ? " · "
                        : ""}
                      {m.waterTds != null ? `TDS ${m.waterTds}` : ""}
                      {m.waterMetricsDate ? ` · ${m.waterMetricsDate}` : ""}
                    </p>
                  )}

                  {loadingSensors && !sensorsLoaded ? (
                    <p className="text-xs text-slate-400">
                      Завантаження датчиків…
                    </p>
                  ) : sensors.length > 0 ? (
                    <ul className="space-y-1 rounded-lg bg-slate-50 px-3 py-2 text-xs dark:bg-slate-800/60">
                      {sensors.map((s, i) => (
                        <li
                          key={`${m.id}-${s.name}-${i}`}
                          className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5"
                        >
                          <span className="text-slate-700 dark:text-slate-200">
                            {s.descr || s.name}
                            {s.state ? (
                              <span
                                className={`ml-1 ${sensorStateClass(s.state)}`}
                              >
                                · {s.state}
                              </span>
                            ) : null}
                          </span>
                          <span className="tabular-nums text-slate-900 dark:text-slate-100">
                            {s.value ?? "—"}
                          </span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-xs text-slate-400">
                      Немає даних датчиків
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
        )
      ) : null}
    </section>
  );
}
