"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import axios from "axios";
import { toast } from "react-hot-toast";

import { MessageCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TicketsBlock } from "@/components/tickets-block";
import { CollectionCommentsThread } from "@/components/collection-comments";
import { Textarea } from "@/components/ui/textarea";
import type {
  CashierPublicHandover,
  CashierPublicPackage,
  CashierPublicTechnician,
} from "@/lib/cashier-public";
import type { TicketThread } from "@/lib/ticket-types";

function mismatch(h: Pick<CashierPublicHandover, "claimedPackages" | "receivedPackages">) {
  return h.claimedPackages !== h.receivedPackages;
}

export function CashierHandoversClient({
  phone,
  technicians: _technicians,
  handovers,
  packages,
  tickets = [],
  openTicketCollectionIds = [],
}: {
  phone: string;
  technicians: CashierPublicTechnician[];
  handovers: CashierPublicHandover[];
  packages: CashierPublicPackage[];
  tickets?: TicketThread[];
  openTicketCollectionIds?: number[];
}) {
  const [archiveOpen, setArchiveOpen] = useState(false);

  const current = handovers.filter((h) => !h.recountClosed);
  const archive = handovers.filter((h) => h.recountClosed);

  return (
    <div className="space-y-6">
      {tickets.length > 0 ? (
        <TicketsBlock
          title="Звернення по інкасаціях"
          tickets={tickets}
          basePath={`/api/public/cashier/${phone}/tickets`}
          hideAmounts
        />
      ) : null}

      <section className="overflow-hidden rounded-2xl border border-sky-100 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="border-b border-sky-50 bg-sky-50/60 px-4 py-3 dark:border-slate-800 dark:bg-slate-900/80">
          <span className="text-sm font-medium text-sky-900 dark:text-sky-200">
            Здача від техніка
          </span>
          <p className="mt-1 text-xs text-slate-500">
            Технік відмічає пакети у своєму списку. Тут зʼявляється список на
            прийом: № апарата та адреса, без суми бази.
          </p>
        </div>

        {current.length > 0 ? (
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            {current.map((h) => (
              <li key={h.id}>
                <HandoverCard
                  handover={h}
                  phone={phone}
                  allowManualPackage
                  openTicketIds={openTicketCollectionIds}
                  hasOpenTicket={tickets.some((t) => t.handoverId === h.id)}
                />
              </li>
            ))}
          </ul>
        ) : (
          <p className="px-4 py-8 text-center text-sm text-slate-500 dark:text-slate-400">
            Немає відкритої здачі. Технік передає пакети зі свого списку.
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
                  <HandoverCard
                    handover={h}
                    phone={phone}
                    showMachines
                    openTicketIds={openTicketCollectionIds}
                    hasOpenTicket={tickets.some((t) => t.handoverId === h.id)}
                  />
                </li>
              ))}
            </ul>
          )
        ) : null}
      </section>
    </div>
  );
}

function groupPackagesByMachine(packages: CashierPublicPackage[]) {
  const map = new Map<string, CashierPublicPackage[]>();
  for (const pkg of packages) {
    const list = map.get(pkg.machine) ?? [];
    list.push(pkg);
    map.set(pkg.machine, list);
  }
  return [...map.entries()].map(([machine, pkgs]) => ({
    machine,
    packages: pkgs,
    missingCount: pkgs.filter((p) => p.recountStatus === "missing").length,
  }));
}

function HandoverCard({
  handover,
  phone,
  showMachines = false,
  allowManualPackage = false,
  openTicketIds = [],
  hasOpenTicket = false,
}: {
  handover: CashierPublicHandover;
  phone?: string;
  showMachines?: boolean;
  allowManualPackage?: boolean;
  openTicketIds?: number[];
  hasOpenTicket?: boolean;
}) {
  const router = useRouter();
  const warn = mismatch(handover);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [packages, setPackages] = useState<CashierPublicPackage[] | null>(null);
  const [manualOpen, setManualOpen] = useState(false);
  const [deviceId, setDeviceId] = useState("");
  const [amount, setAmount] = useState("");
  const [comment, setComment] = useState("");
  const [manualBusy, setManualBusy] = useState(false);

  const needManual = Math.max(
    0,
    handover.receivedPackages - handover.collectionCount
  );

  const loadMachines = async () => {
    if (!phone || !showMachines) return;
    const next = !open;
    setOpen(next);
    if (!next || packages != null) return;
    try {
      setLoading(true);
      const { data } = await axios.get<{ packages: CashierPublicPackage[] }>(
        `/api/public/cashier/${phone}/handovers/${handover.id}/packages`
      );
      setPackages(data.packages ?? []);
    } catch {
      toast.error("Не вдалося завантажити деталізацію");
      setOpen(false);
    } finally {
      setLoading(false);
    }
  };

  const submitManual = async () => {
    if (!phone) return;
    const id = parseInt(deviceId.trim(), 10);
    const parsed = parseFloat(
      String(amount).replace(",", ".").replace(/\s/g, "")
    );
    if (!Number.isFinite(id) || id <= 0) {
      toast.error("Вкажіть номер апарата");
      return;
    }
    if (!Number.isFinite(parsed) || parsed < 0) {
      toast.error("Вкажіть суму");
      return;
    }
    try {
      setManualBusy(true);
      const { data } = await axios.post(
        `/api/public/cashier/${phone}/handovers/${handover.id}/manual-package`,
        { deviceId: id, amount: parsed, comment: comment.trim() || null }
      );
      toast.success(
        data?.handoverClosed
          ? "Пакет додано, здачу закрито"
          : "Пакет додано без даних апарата"
      );
      setDeviceId("");
      setAmount("");
      setComment("");
      setManualOpen(false);
      setPackages(null);
      router.refresh();
    } catch (error) {
      const message =
        axios.isAxiosError(error) && typeof error.response?.data === "string"
          ? error.response.data
          : "Не вдалося додати пакет";
      toast.error(message);
    } finally {
      setManualBusy(false);
    }
  };

  const machines = packages ? groupPackagesByMachine(packages) : [];

  return (
    <div className="space-y-2 px-4 py-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="inline-flex items-center gap-1.5 font-medium text-slate-900 dark:text-slate-100">
            {hasOpenTicket ? (
              <MessageCircle
                className="h-4 w-4 shrink-0 text-sky-600"
                aria-label="Відкрите звернення"
              />
            ) : null}
            {handover.technicianName}
          </p>
          <p className="text-xs text-slate-400">
            {handover.dateLabel} · {handover.timeLabel} · здача #{handover.id}
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
        {needManual > 0 ? (
          <span className="ml-2 font-medium text-amber-700 dark:text-amber-300">
            ще без даних апарата: {needManual}
          </span>
        ) : null}
      </p>

      {allowManualPackage && phone ? (
        <div className="pt-1">
          <button
            type="button"
            className="text-sm font-medium text-amber-800 dark:text-amber-300"
            onClick={() => setManualOpen((v) => !v)}
          >
            {manualOpen
              ? "Сховати форму"
              : "Додати зайвий пакет"}
          </button>
          {manualOpen ? (
            <div className="mt-3 space-y-3 rounded-xl border border-amber-200 bg-amber-50/60 p-3 dark:border-amber-900/50 dark:bg-amber-950/20">
              <p className="text-xs text-amber-900/80 dark:text-amber-200/80">
                Пакет, якого не було в списку техніка. Вкажіть № апарата і
                фактичну суму з кулька.
              </p>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <label className="text-xs text-slate-500">№ апарата</label>
                  <Input
                    type="text"
                    inputMode="numeric"
                    placeholder="Наприклад 272"
                    value={deviceId}
                    disabled={manualBusy}
                    onChange={(e) =>
                      setDeviceId(e.target.value.replace(/[^\d]/g, ""))
                    }
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-slate-500">Сума, грн</label>
                  <Input
                    type="number"
                    min={0}
                    step="0.01"
                    placeholder="0.00"
                    value={amount}
                    disabled={manualBusy}
                    onChange={(e) => setAmount(e.target.value)}
                  />
                </div>
              </div>
              <Textarea
                rows={2}
                placeholder="Коментар (необовʼязково)"
                value={comment}
                disabled={manualBusy}
                onChange={(e) => setComment(e.target.value)}
              />
              <Button
                size="sm"
                disabled={manualBusy}
                onClick={() => void submitManual()}
              >
                Зберегти пакет
              </Button>
            </div>
          ) : null}
        </div>
      ) : null}

      {showMachines && phone ? (
        <div className="pt-1">
          <button
            type="button"
            className="text-sm font-medium text-sky-700 dark:text-sky-300"
            onClick={() => void loadMachines()}
          >
            {open ? "Сховати автомати" : "Деталізація по автоматах"}
          </button>
          {open ? (
            loading ? (
              <p className="mt-2 text-sm text-slate-400">Завантаження…</p>
            ) : machines.length === 0 ? (
              <p className="mt-2 text-sm text-slate-500">
                У цій здачі немає інкасацій
              </p>
            ) : (
              <ul className="mt-3 space-y-3">
                {machines.map((m) => (
                  <li
                    key={m.machine}
                    className="rounded-xl bg-slate-50 px-3 py-3 dark:bg-slate-800/60"
                  >
                    <p className="flex items-center gap-1.5 font-medium text-slate-900 dark:text-slate-100">
                      {m.packages.some((p) => openTicketIds.includes(p.id)) ? (
                        <MessageCircle className="h-4 w-4 text-sky-600" />
                      ) : null}
                      {m.machine}
                    </p>
                    <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                      Пакетів: {m.packages.length}
                    </p>
                    {m.missingCount > 0 ? (
                      <p className="mt-1 text-sm font-medium text-rose-700">
                        Відсутніх пакетів: {m.missingCount}
                      </p>
                    ) : null}
                    <ul className="mt-2 space-y-1 text-xs text-slate-500">
                      {m.packages.map((pkg) => (
                        <li key={pkg.id}>
                          {pkg.dateLabel} {pkg.timeLabel}
                          {pkg.noDeviceData
                            ? " · без даних апарата"
                            : pkg.recountStatus === "missing"
                              ? " · відсутній"
                              : pkg.recountStatus === "done"
                                ? " · перераховано"
                                : ""}
                        </li>
                      ))}
                    </ul>
                  </li>
                ))}
              </ul>
            )
          ) : null}
        </div>
      ) : null}
    </div>
  );
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
  const [comment, setComment] = useState<Record<number, string>>({});
  const [editingId, setEditingId] = useState<number | null>(null);
  const [openComments, setOpenComments] = useState<Set<number>>(new Set());
  const [filterTechId, setFilterTechId] = useState("");
  const [filterDevice, setFilterDevice] = useState("");

  const technicianOptions = useMemo(() => {
    const map = new Map<number, string>();
    for (const pkg of packages) {
      if (pkg.technicianId == null) continue;
      if (!map.has(pkg.technicianId)) {
        map.set(pkg.technicianId, pkg.technicianName || `Технік #${pkg.technicianId}`);
      }
    }
    return [...map.entries()]
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name, "uk"));
  }, [packages]);

  const filtered = useMemo(() => {
    const deviceQuery = filterDevice.trim();
    return packages.filter((pkg) => {
      if (filterTechId && String(pkg.technicianId ?? "") !== filterTechId) {
        return false;
      }
      if (!deviceQuery) return true;
      if (pkg.deviceId == null) return false;
      return String(pkg.deviceId).includes(deviceQuery);
    });
  }, [packages, filterTechId, filterDevice]);

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
        missing
          ? { missing: true, comment: comment[pkg.id]?.trim() || null }
          : {
              actualReceived: parsed,
              comment: comment[pkg.id]?.trim() || null,
            }
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
      <div className="border-b border-sky-50 bg-sky-50/60 px-4 py-3 dark:border-slate-800 dark:bg-slate-900/80">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-sm font-medium text-sky-900 dark:text-sky-200">
            Перерахунок пакетів
          </span>
          <span className="text-xs text-slate-500">
            {packages.length === 0
              ? "0"
              : filtered.length === packages.length
                ? `${packages.length}`
                : `${filtered.length} з ${packages.length}`}
          </span>
        </div>
        {packages.length > 0 ? (
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <label className="text-xs text-slate-500">Технік</label>
              <select
                className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950"
                value={filterTechId}
                onChange={(e) => setFilterTechId(e.target.value)}
              >
                <option value="">Усі техніки</option>
                {technicianOptions.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs text-slate-500">№ апарата</label>
              <Input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                placeholder="Наприклад 272"
                value={filterDevice}
                onChange={(e) =>
                  setFilterDevice(e.target.value.replace(/[^\d]/g, ""))
                }
              />
            </div>
          </div>
        ) : null}
      </div>
      {packages.length === 0 ? (
        <p className="px-4 py-8 text-center text-sm text-slate-500">
          Немає пакетів на перерахунок
        </p>
      ) : filtered.length === 0 ? (
        <p className="px-4 py-8 text-center text-sm text-slate-500">
          Немає пакетів за фільтром
        </p>
      ) : (
        <ul className="divide-y divide-slate-100 dark:divide-slate-800">
          {filtered.map((pkg) => {
            const busy = busyId === pkg.id;
            const done = pkg.recountStatus === "done";
            const missing = pkg.recountStatus === "missing";
            const showForm = (!done && !missing) || editingId === pkg.id;
            const commentsOpen = openComments.has(pkg.id);
            return (
              <li key={pkg.id} className="space-y-3 px-4 py-4">
                <div>
                  <p className="font-medium text-slate-900 dark:text-slate-100">
                    {pkg.machine}
                  </p>
                  <p className="text-xs text-slate-400">
                    {pkg.technicianName} · {pkg.dateLabel} {pkg.timeLabel}
                    {pkg.isPhantom ? " · фантом" : ""}
                    {pkg.isManual ? " · вручну" : ""}
                  </p>
                  <p className="mt-1 text-xs font-medium text-slate-600 dark:text-slate-300">
                    {pkg.statusLabel}
                  </p>
                </div>
                {pkg.actualReceived != null && !showForm ? (
                  <p className="text-sm tabular-nums text-slate-600">
                    Ваш факт: {pkg.actualReceived.toLocaleString("uk-UA", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}{" "}
                    грн
                  </p>
                ) : null}
                {missing && !showForm ? (
                  <p className="text-sm font-medium text-rose-700">Відсутній</p>
                ) : null}
                {showForm ? (
                  <>
                    <Input
                      type="number"
                      min={0}
                      step="0.01"
                      placeholder="Фактично отримано, грн"
                      value={
                        actual[pkg.id] ??
                        (pkg.actualReceived != null
                          ? String(pkg.actualReceived)
                          : "")
                      }
                      disabled={busy}
                      onChange={(e) =>
                        setActual((m) => ({ ...m, [pkg.id]: e.target.value }))
                      }
                    />
                    <Textarea
                      rows={2}
                      placeholder="Коментар (стан кулька, маркування…)"
                      value={comment[pkg.id] ?? ""}
                      disabled={busy}
                      onChange={(e) =>
                        setComment((m) => ({ ...m, [pkg.id]: e.target.value }))
                      }
                    />
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
                      {editingId === pkg.id ? (
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={busy}
                          onClick={() => setEditingId(null)}
                        >
                          Скасувати
                        </Button>
                      ) : null}
                    </div>
                  </>
                ) : pkg.canEdit ? (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setEditingId(pkg.id)}
                  >
                    Змінити
                  </Button>
                ) : null}
                <button
                  type="button"
                  className="text-xs font-medium text-sky-700 dark:text-sky-300"
                  onClick={() =>
                    setOpenComments((prev) => {
                      const next = new Set(prev);
                      if (next.has(pkg.id)) next.delete(pkg.id);
                      else next.add(pkg.id);
                      return next;
                    })
                  }
                >
                  {commentsOpen ? "Сховати коментарі" : "Коментарі"}
                </button>
                {commentsOpen ? (
                  <CollectionCommentsThread
                    compact
                    endpoint={`/api/public/cashier/${phone}/collections/${pkg.id}/comments`}
                  />
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
