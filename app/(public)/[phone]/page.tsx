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
import { ManagerMissingClient } from "./components/manager-missing-client";
import { ManagerNoDeviceDataClient } from "./components/manager-no-device-data-client";
import { ManagerTasksClient } from "./components/manager-tasks-client";
import { TechnicianTasksClient } from "./components/technician-tasks-client";
import { TechnicianFinanceClient } from "./components/technician-finance-client";
import { TechnicianMachinesClient } from "./components/technician-machines-client";
import { TechnicianPublicShell } from "./components/technician-public-shell";
import { getCashierPublicPage } from "@/lib/cashier-public";
import { CashierHandoversClient } from "./components/cashier-handovers-client";
import { TicketsBlock } from "@/components/tickets-block";

export const dynamic = "force-dynamic";

function PublicLogo() {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/vodolij-logo.svg"
      alt="Vodolij"
      width={168}
      height={44}
      className="h-11 w-[168px]"
    />
  );
}

async function CashierPage({ phone }: { phone: string }) {
  const data = await getCashierPublicPage(phone);
  if (!data) notFound();

  return (
    <main className="mx-auto max-w-3xl px-4 pb-8 pt-2 sm:px-6">
      <header className="mb-8 flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
        <PublicLogo />
        <div className="text-left sm:text-right">
          <p className="text-sm text-sky-700/70 dark:text-sky-300/70">Касир</p>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-50">
            {data.cashier.name || "Без імені"}
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {data.cashier.phoneDigits}
          </p>
        </div>
      </header>

      <CashierHandoversClient
        phone={phone}
        technicians={data.technicians}
        handovers={data.handovers}
        packages={data.packages}
        tickets={data.tickets}
        openTicketCollectionIds={data.openTicketCollectionIds}
      />
    </main>
  );
}

async function ManagerPage({ phone }: { phone: string }) {
  const data = await getManagerPublicPage(phone);
  if (!data) notFound();

  const pendingTasks = data.tasks.filter((t) => t.reviewable);
  const archiveTasks = data.tasks.filter((t) => !t.reviewable);

  return (
    <main className="mx-auto max-w-3xl px-4 pb-8 pt-2 sm:px-6">
      <header className="mb-8 flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
        <PublicLogo />
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

      <ManagerMissingClient phone={phone} events={data.missingEvents} />
      <ManagerNoDeviceDataClient events={data.noDeviceDataEvents} />
      {data.overdueOnHand.length > 0 ? (
        <section className="mb-6 overflow-hidden rounded-2xl border border-amber-200 bg-white shadow-sm dark:border-amber-900/40 dark:bg-slate-900">
          <div className="border-b border-amber-100 bg-amber-50/80 px-4 py-3 text-sm font-medium text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-200">
            На руках понад 7 днів ({data.overdueOnHand.length})
          </div>
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            {data.overdueOnHand.map((item) => (
              <li key={item.id} className="px-4 py-3">
                <p className="font-medium text-slate-900 dark:text-slate-100">
                  {item.machine}
                </p>
                <p className="text-sm text-slate-500">
                  {item.technicianName} · {item.dateLabel} · {item.agingDays} дн.
                </p>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <div className="mb-6">
        <TicketsBlock
          title="Відкриті звернення"
          tickets={data.tickets}
          basePath={`/api/public/manager/${phone}/tickets`}
          canClose
          emptyText="Немає відкритих звернень"
        />
      </div>

      <ManagerTasksClient
        phone={phone}
        pendingTasks={pendingTasks}
        archiveTasks={archiveTasks}
      />
    </main>
  );
}

async function TechnicianPage({
  phone,
  tab,
}: {
  phone: string;
  tab?: string;
}) {
  const data = await getTechnicianPublicPage(phone);
  if (!data) notFound();

  const {
    technician,
    machines,
    tasks,
    tickets,
    collections,
    totalWaterLitersMonth,
    monthLabel,
  } = data;

  const periodKey = currentPeriodKey();
  const finance = await getTechnicianFinanceSnapshot(
    technician.id,
    periodKey
  );

  const activeTasks = tasks.filter((t) => t.actionable);
  const archiveTasks = tasks.filter((t) => !t.actionable);

  return (
    <TechnicianPublicShell
      phone={phone}
      technicianName={technician.name || "Без імені"}
      phoneDigits={technician.phoneDigits}
      initialCollections={collections}
      initialTab={tab}
    >
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

      {tickets.length > 0 ? (
        <div className="mb-6">
          <TicketsBlock
            title="Відкриті звернення"
            tickets={tickets}
            basePath={`/api/public/technician/${phone}/tickets`}
          />
        </div>
      ) : null}

      <TechnicianTasksClient
        phone={phone}
        activeTasks={activeTasks}
        archiveTasks={archiveTasks}
      />

      <TechnicianMachinesClient phone={phone} machines={machines} />

      {finance ? (
        <TechnicianFinanceClient
          phone={phone}
          periodKey={periodKey}
          monthLabel={monthLabel}
          initial={finance}
          section="archive"
        />
      ) : null}
    </TechnicianPublicShell>
  );
}

export default async function PublicWorkerPage({
  params,
  searchParams,
}: {
  params: Promise<{ phone: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { phone } = await params;
  const query = await searchParams;
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
    return <TechnicianPage phone={phone} tab={query.tab} />;
  }

  if (worker.role === "cashier") {
    return <CashierPage phone={phone} />;
  }

  notFound();
}
