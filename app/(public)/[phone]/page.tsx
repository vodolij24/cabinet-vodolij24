import Image from "next/image";
import { notFound } from "next/navigation";

import { isPhoneRouteParam } from "@/lib/phone";
import {
  findPublicWorkerByPhoneDigits,
  getManagerPublicPage,
} from "@/lib/manager-public";
import { getTechnicianPublicPage } from "@/lib/technician-public";
import {
  getTechnicianFinanceSnapshot,
} from "@/lib/finance-month";
import { currentPeriodKey } from "@/lib/task-fields";
import { ManagerTasksClient } from "./components/manager-tasks-client";
import { TechnicianTasksClient } from "./components/technician-tasks-client";
import { TechnicianFinanceClient } from "./components/technician-finance-client";

export const dynamic = "force-dynamic";

function machineStatusLabel(status: string | null) {
  if (status === "operational") return "Працює";
  if (status === "maintenance") return "Сервіс";
  if (status === "out_of_service") return "Не працює";
  if (status === "low_water") return "Мало води";
  return status || "—";
}

async function ManagerPage({ phone }: { phone: string }) {
  const data = await getManagerPublicPage(phone);
  if (!data) notFound();

  const pendingTasks = data.tasks.filter((t) => t.reviewable);
  const archiveTasks = data.tasks.filter((t) => !t.reviewable);

  return (
    <main className="mx-auto max-w-3xl px-4 pb-8 pt-2 sm:px-6">
      <header className="mb-8 flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
        <Image
          src="/vodolij-logo.svg"
          alt="Vodolij"
          width={168}
          height={44}
          priority
          unoptimized
        />
        <div className="text-left sm:text-right">
          <p className="text-sm text-sky-700/70 dark:text-sky-300/70">
            Керівник
          </p>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-50">
            {data.manager.name || "Без імені"}
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {data.manager.phoneDigits}
          </p>
        </div>
      </header>

      <ManagerTasksClient
        phone={phone}
        pendingTasks={pendingTasks}
        archiveTasks={archiveTasks}
      />
    </main>
  );
}

async function TechnicianPage({ phone }: { phone: string }) {
  const data = await getTechnicianPublicPage(phone);
  if (!data) notFound();

  const { technician, machines, tasks, totalWaterLitersMonth, monthLabel } =
    data;

  const periodKey = currentPeriodKey();
  const finance = await getTechnicianFinanceSnapshot(
    technician.id,
    periodKey
  );

  const activeTasks = tasks.filter((t) => t.actionable);
  const archiveTasks = tasks.filter((t) => !t.actionable);

  return (
    <main className="mx-auto max-w-3xl px-4 pb-8 pt-2 sm:px-6">
      <header className="mb-8 flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
        <Image
          src="/vodolij-logo.svg"
          alt="Vodolij"
          width={168}
          height={44}
          priority
          unoptimized
        />
        <div className="text-left sm:text-right">
          <p className="text-sm text-sky-700/70 dark:text-sky-300/70">Технік</p>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-50">
            {technician.name || "Без імені"}
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {technician.phoneDigits}
          </p>
        </div>
      </header>

      <section className="mb-6 rounded-2xl border border-sky-100 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Реалізовано води · {monthLabel}
        </p>
        <p className="mt-1 text-3xl font-bold tabular-nums text-sky-800 dark:text-sky-300">
          {totalWaterLitersMonth.toLocaleString("uk-UA")}{" "}
          <span className="text-lg font-medium text-slate-500 dark:text-slate-400">
            л
          </span>
        </p>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Автоматів: {machines.length}
        </p>
      </section>

      {finance ? (
        <TechnicianFinanceClient
          phone={phone}
          periodKey={periodKey}
          monthLabel={monthLabel}
          initial={finance}
          section="main"
        />
      ) : null}

      <section className="mb-6 overflow-hidden rounded-2xl border border-sky-100 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="border-b border-sky-50 bg-sky-50/60 px-4 py-3 text-sm font-medium text-sky-900 dark:border-slate-800 dark:bg-slate-900/80 dark:text-sky-200">
          Автомати
        </div>
        {machines.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-slate-500 dark:text-slate-400">
            Поки немає призначених автоматів
          </p>
        ) : (
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            {machines.map((m) => (
              <li key={m.id} className="px-4 py-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-medium text-slate-900 dark:text-slate-100">
                      №{m.id}
                      {m.name ? ` · ${m.name}` : ""}
                    </p>
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                      {m.location}
                    </p>
                    {m.lat && m.lon ? (
                      <p className="mt-1 text-xs text-slate-400">
                        {m.lat}, {m.lon}
                      </p>
                    ) : null}
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-semibold tabular-nums text-sky-800 dark:text-sky-300">
                      {m.waterLitersMonth.toLocaleString("uk-UA")} л
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {machineStatusLabel(m.status)}
                    </p>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <TechnicianTasksClient
        phone={phone}
        activeTasks={activeTasks}
        archiveTasks={archiveTasks}
      />

      {finance ? (
        <TechnicianFinanceClient
          phone={phone}
          periodKey={periodKey}
          monthLabel={monthLabel}
          initial={finance}
          section="archive"
        />
      ) : null}
    </main>
  );
}

export default async function PublicWorkerPage({
  params,
}: {
  params: Promise<{ phone: string }>;
}) {
  const { phone } = await params;
  if (!isPhoneRouteParam(phone)) {
    notFound();
  }

  const worker = await findPublicWorkerByPhoneDigits(phone);
  if (!worker) {
    notFound();
  }

  if (worker.role === "manager") {
    return <ManagerPage phone={phone} />;
  }

  if (worker.role === "technician") {
    return <TechnicianPage phone={phone} />;
  }

  notFound();
}
