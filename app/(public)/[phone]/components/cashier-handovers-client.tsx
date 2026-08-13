"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import axios from "axios";
import { toast } from "react-hot-toast";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type {
  CashierPublicHandover,
  CashierPublicPackage,
  CashierPublicTechnician,
} from "@/lib/cashier-public";

function mismatch(h: Pick<CashierPublicHandover, "claimedPackages" | "receivedPackages">) {
  return h.claimedPackages !== h.receivedPackages;
}

export function CashierHandoversClient({
  phone,
  technicians,
  handovers,
  packages,
}: {
  phone: string;
  technicians: CashierPublicTechnician[];
  handovers: CashierPublicHandover[];
  packages: CashierPublicPackage[];
}) {
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [technicianId, setTechnicianId] = useState("");
  const [claimed, setClaimed] = useState("");
  const [received, setReceived] = useState("");
  const [pending, setPending] = useState<{
    collectionCount: number;
    machineCount: number;
    since: string | null;
  } | null>(null);
  const [loadingPending, setLoadingPending] = useState(false);

  const latest = handovers[0] ?? null;
  const archive = handovers.slice(1);

  const selectedTech = useMemo(
    () => technicians.find((t) => String(t.id) === technicianId) || null,
    [technicians, technicianId]
  );

  const loadPending = async (id: string) => {
    setTechnicianId(id);
    setPending(null);
    if (!id) return;
    try {
      setLoadingPending(true);
      const { data } = await axios.get<{
        pending: {
          collectionCount: number;
          machineCount: number;
          since: string | null;
        };
      }>(`/api/public/cashier/${phone}/handovers`, {
        params: { technicianId: id },
      });
      setPending(data.pending);
    } catch {
      toast.error("Не вдалося порахувати інкасації");
    } finally {
      setLoadingPending(false);
    }
  };

  const reset = () => {
    setCreating(false);
    setTechnicianId("");
    setClaimed("");
    setReceived("");
    setPending(null);
  };

  const onSubmit = async () => {
    if (!technicianId) {
      toast.error("Оберіть техніка");
      return;
    }
    if (!/^\d+$/.test(claimed.trim()) || !/^\d+$/.test(received.trim())) {
      toast.error("Вкажіть кількість пакетів");
      return;
    }
    try {
      setBusy(true);
      await axios.post(`/api/public/cashier/${phone}/handovers`, {
        technicianId: Number(technicianId),
        claimedPackages: Number(claimed.trim()),
        receivedPackages: Number(received.trim()),
      });
      toast.success("Здачу інкасації збережено");
      reset();
      router.refresh();
    } catch (error) {
      const message =
        axios.isAxiosError(error) && typeof error.response?.data === "string"
          ? error.response.data
          : "Не вдалося зберегти здачу";
      toast.error(message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-2xl border border-sky-100 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-sky-50 bg-sky-50/60 px-4 py-3 dark:border-slate-800 dark:bg-slate-900/80">
          <span className="text-sm font-medium text-sky-900 dark:text-sky-200">
            Здача інкасації
          </span>
          {!creating ? (
            <Button size="sm" onClick={() => setCreating(true)}>
              Додати здачу інкасації
            </Button>
          ) : null}
        </div>

        {creating ? (
          <div className="space-y-4 px-4 py-4">
            <div className="space-y-1">
              <label className="text-sm text-slate-500">Технік</label>
              <select
                className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950"
                value={technicianId}
                disabled={busy}
                onChange={(e) => void loadPending(e.target.value)}
              >
                <option value="">Оберіть техніка</option>
                {technicians.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>

            {loadingPending ? (
              <p className="text-sm text-slate-400">Рахунок інкасацій…</p>
            ) : pending && selectedTech ? (
              <div className="rounded-xl bg-slate-50 px-3 py-3 text-sm dark:bg-slate-800/60">
                <p className="font-medium text-slate-800 dark:text-slate-100">
                  Інкасованих автоматів за БД: {pending.machineCount}
                </p>
                <p className="mt-1 text-slate-500">
                  Інкасацій з попередньої здачі: {pending.collectionCount}
                </p>
              </div>
            ) : null}

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <label className="text-sm text-slate-500">
                  Заявлено пакетів техніком
                </label>
                <Input
                  type="number"
                  min={0}
                  step={1}
                  value={claimed}
                  disabled={busy}
                  onChange={(e) => setClaimed(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm text-slate-500">
                  Отримано пакетів касиром
                </label>
                <Input
                  type="number"
                  min={0}
                  step={1}
                  value={received}
                  disabled={busy}
                  onChange={(e) => setReceived(e.target.value)}
                />
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button size="sm" disabled={busy} onClick={() => void onSubmit()}>
                Зберегти здачу
              </Button>
              <Button
                size="sm"
                variant="ghost"
                disabled={busy}
                onClick={reset}
              >
                Скасувати
              </Button>
            </div>
          </div>
        ) : latest ? (
          <HandoverCard handover={latest} />
        ) : (
          <p className="px-4 py-8 text-center text-sm text-slate-500 dark:text-slate-400">
            Поки немає здач інкасації
          </p>
        )}
      </section>

      <CashierPackages phone={phone} packages={packages} />

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <button
          type="button"
          className="flex w-full items-center justify-between border-b border-slate-100 bg-slate-50 px-4 py-3 text-left text-sm font-medium text-slate-800 dark:border-slate-800 dark:bg-slate-900/80 dark:text-slate-200"
          onClick={() => setArchiveOpen((v) => !v)}
        >
          <span>Архів здач ({archive.length})</span>
          <span className="text-xs text-slate-500">
            {archiveOpen ? "Згорнути" : "Розгорнути"}
          </span>
        </button>
        {archiveOpen ? (
          archive.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-slate-500 dark:text-slate-400">
              Архів порожній
            </p>
          ) : (
            <ul className="divide-y divide-slate-100 dark:divide-slate-800">
              {archive.map((h) => (
                <li key={h.id}>
                  <HandoverCard handover={h} />
                </li>
              ))}
            </ul>
          )
        ) : null}
      </section>
    </div>
  );
}

function HandoverCard({ handover }: { handover: CashierPublicHandover }) {
  const warn = mismatch(handover);
  return (
    <div className="space-y-2 px-4 py-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="font-medium text-slate-900 dark:text-slate-100">
            {handover.technicianName}
          </p>
          <p className="text-xs text-slate-400">
            {handover.dateLabel} · {handover.timeLabel}
          </p>
        </div>
        <p className="text-sm tabular-nums text-slate-600 dark:text-slate-300">
          Автоматів (БД): {handover.machineCount}
        </p>
      </div>
      <p className="text-sm text-slate-500">
        Заявлено {handover.claimedPackages} пакетів · отримано{" "}
        {handover.receivedPackages}
        {warn ? (
          <span className="ml-2 font-medium text-amber-700 dark:text-amber-300">
            розбіжність
          </span>
        ) : null}
      </p>
      <p className="text-xs text-slate-400">
        Інкасацій у здачі: {handover.collectionCount}
      </p>
    </div>
  );
}

function money(n: number) {
  return `${n.toLocaleString("uk-UA", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} грн`;
}

function CashierPackages({
  phone,
  packages,
}: {
  phone: string;
  packages: CashierPublicPackage[];
}) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<number | null>(null);
  const [actual, setActual] = useState<Record<number, string>>({});

  const submit = async (pkg: CashierPublicPackage, missing: boolean) => {
    const parsed = parseFloat(
      String(actual[pkg.id] ?? "").replace(",", ".").replace(/\s/g, "")
    );
    if (!missing && (!Number.isFinite(parsed) || parsed < 0)) {
      toast.error("Вкажіть фактично отриману суму");
      return;
    }
    try {
      setBusyId(pkg.id);
      const { data: result } = await axios.patch(
        `/api/public/cashier/${phone}/recount/${pkg.id}`,
        missing ? { missing: true } : { actualReceived: parsed }
      );
      if (result?.handoverClosed) {
        toast.success(
          result.missingNotified
            ? "Перерахунок здачі закрито. Керівника повідомлено."
            : "Перерахунок усіх пакетів здачі закрито."
        );
      } else {
        toast.success(missing ? "Позначено як відсутній" : "Перерахунок збережено");
      }
      router.refresh();
    } catch (error) {
      const message =
        axios.isAxiosError(error) && typeof error.response?.data === "string"
          ? error.response.data
          : "Помилка перерахунку";
      toast.error(message);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <section className="overflow-hidden rounded-2xl border border-sky-100 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="border-b border-sky-50 bg-sky-50/60 px-4 py-3 text-sm font-medium text-sky-900 dark:border-slate-800 dark:bg-slate-900/80 dark:text-sky-200">
        Перерахунок пакетів ({packages.length})
      </div>
      {packages.length === 0 ? (
        <p className="px-4 py-8 text-center text-sm text-slate-500">
          Немає пакетів на перерахунок
        </p>
      ) : (
        <ul className="divide-y divide-slate-100 dark:divide-slate-800">
          {packages.map((pkg) => {
            const busy = busyId === pkg.id;
            const done = pkg.recountStatus === "done";
            const missing = pkg.recountStatus === "missing";
            const expectedDiff =
              Number.isFinite(
                parseFloat(String(actual[pkg.id] ?? "").replace(",", "."))
              )
                ? pkg.total -
                  parseFloat(String(actual[pkg.id] ?? "").replace(",", "."))
                : null;
            return (
              <li key={pkg.id} className="space-y-3 px-4 py-4">
                <div>
                  <p className="font-medium text-slate-900 dark:text-slate-100">
                    {pkg.machine}
                  </p>
                  <p className="text-xs text-slate-400">
                    {pkg.technicianName} · {pkg.dateLabel} {pkg.timeLabel}
                  </p>
                  <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                    Метал {money(pkg.sumCoins)} · папір {money(pkg.sumBanknotes)} · разом{" "}
                    {money(pkg.total)}
                  </p>
                </div>
                {missing ? (
                  <p className="text-sm font-medium text-rose-700">Відсутній</p>
                ) : done ? (
                  <p className="text-sm text-slate-500">
                    Перераховано
                    {pkg.actualReceived != null
                      ? ` · ${money(pkg.actualReceived)}`
                      : ""}
                  </p>
                ) : (
                  <>
                    <Input
                      type="number"
                      min={0}
                      step="0.01"
                      placeholder="Фактично отримано, грн"
                      value={actual[pkg.id] ?? ""}
                      disabled={busy}
                      onChange={(e) =>
                        setActual((m) => ({ ...m, [pkg.id]: e.target.value }))
                      }
                    />
                    {expectedDiff != null ? (
                      <p className="text-xs text-slate-500">
                        Різниця {money(Math.round(expectedDiff * 100) / 100)}
                      </p>
                    ) : null}
                    <div className="flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        disabled={busy}
                        onClick={() => void submit(pkg, false)}
                      >
                        Зберегти
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        disabled={busy}
                        onClick={() => void submit(pkg, true)}
                      >
                        Відсутній
                      </Button>
                    </div>
                  </>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
