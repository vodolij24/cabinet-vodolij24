"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import axios from "axios";
import { toast } from "react-hot-toast";
import { RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { CollectionCommentsThread } from "@/components/collection-comments";
import type { TechnicianPublicCollections } from "@/lib/technician-public";

function packagesWord(n: number) {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return "пакет";
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return "пакети";
  return "пакетів";
}

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

function groupByMachine(packages: TechnicianPublicCollections["packages"]) {
  const map = new Map<string, typeof packages>();
  for (const pkg of packages) {
    const list = map.get(pkg.machine) ?? [];
    list.push(pkg);
    map.set(pkg.machine, list);
  }
  return [...map.entries()]
    .map(([machine, pkgs]) => ({
      machine,
      packages: pkgs,
      latestMs: pkgs[0]?.dateMs ?? 0,
    }))
    .sort((a, b) => b.latestMs - a.latestMs);
}

export function TechnicianPublicShell({
  phone,
  technicianName,
  phoneDigits,
  initialCollections,
  initialTab,
  children,
}: {
  phone: string;
  technicianName: string;
  phoneDigits: string;
  initialCollections: TechnicianPublicCollections;
  initialTab?: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [tab, setTab] = useState<"home" | "collections">(
    initialTab === "collections" ? "collections" : "home"
  );
  const [collections, setCollections] =
    useState<TechnicianPublicCollections>(initialCollections);
  const [refreshing, setRefreshing] = useState(false);

  const setView = (next: "home" | "collections") => {
    setTab(next);
    const url =
      next === "collections" ? `${pathname}?tab=collections` : pathname;
    window.history.replaceState(null, "", url);
  };

  const refresh = useCallback(async (silent = false) => {
    try {
      if (!silent) setRefreshing(true);
      const { data } = await axios.get<{
        collections: TechnicianPublicCollections;
      }>(`/api/public/technician/${phone}/collections`);
      if (data?.collections) setCollections(data.collections);
    } catch {
      if (!silent) toast.error("Не вдалося оновити інкасації");
    } finally {
      if (!silent) setRefreshing(false);
    }
  }, [phone]);

  useEffect(() => {
    if (tab !== "collections") return;
    const id = window.setInterval(() => {
      void refresh(true);
    }, 30_000);
    return () => window.clearInterval(id);
  }, [tab, refresh]);

  const groups = useMemo(
    () => groupByMachine(collections.packages),
    [collections.packages]
  );

  return (
    <main className="mx-auto max-w-3xl px-4 pb-8 pt-2 sm:px-6">
      <header className="mb-8 w-full">
        <div className="flex w-full items-start justify-between gap-3">
          <PublicLogo />
          {tab === "collections" ? (
            <Button
              size="sm"
              variant="outline"
              className="shrink-0"
              onClick={() => setView("home")}
            >
              На головну
            </Button>
          ) : (
            <Button
              size="sm"
              className="shrink-0"
              onClick={() => setView("collections")}
            >
              Інкасації
              {collections.packageCount > 0 ? (
                <span className="ml-0.5 inline-flex min-w-5 items-center justify-center rounded-full bg-sky-100 px-1.5 text-xs tabular-nums text-sky-900 dark:bg-sky-950 dark:text-sky-100">
                  {collections.packageCount}
                </span>
              ) : null}
            </Button>
          )}
        </div>
        <div className="mt-4">
          <p className="text-sm text-sky-700/70 dark:text-sky-300/70">Технік</p>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-50">
            {technicianName}
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {phoneDigits}
          </p>
        </div>
      </header>

      {tab === "collections" ? (
        <CollectionsView
          phone={phone}
          collections={collections}
          groups={groups}
          refreshing={refreshing}
          onRefresh={() => void refresh(false)}
          onChanged={() => void refresh(true)}
        />
      ) : (
        children
      )}
    </main>
  );
}

function CollectionsView({
  phone,
  collections,
  groups,
  refreshing,
  onRefresh,
  onChanged,
}: {
  phone: string;
  collections: TechnicianPublicCollections;
  groups: ReturnType<typeof groupByMachine>;
  refreshing: boolean;
  onRefresh: () => void;
  onChanged: () => void;
}) {
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [cashierId, setCashierId] = useState("");
  const [busy, setBusy] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [manualOpen, setManualOpen] = useState(false);

  useEffect(() => {
    if (collections.cashiers.length === 1 && !cashierId) {
      setCashierId(String(collections.cashiers[0].id));
    }
  }, [collections.cashiers, cashierId]);

  const toggle = (id: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const allIds = collections.packages.map((p) => p.id);
  const allSelected =
    allIds.length > 0 && allIds.every((id) => selected.has(id));

  const toggleAll = () => {
    setSelected(allSelected ? new Set() : new Set(allIds));
  };

  const submitHandover = async () => {
    if (selected.size === 0) {
      toast.error("Відмітьте пакети для здачі");
      return;
    }
    if (!cashierId) {
      toast.error("Оберіть касира");
      return;
    }
    try {
      setBusy(true);
      await axios.post(`/api/public/technician/${phone}/collections/handover`, {
        collectionIds: [...selected],
        cashierId: Number(cashierId),
      });
      toast.success("Пакети передано касиру");
      setSelected(new Set());
      onChanged();
    } catch (error) {
      const message =
        axios.isAxiosError(error) && typeof error.response?.data === "string"
          ? error.response.data
          : "Не вдалося передати пакети";
      toast.error(message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-sky-100 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-start justify-between gap-3">
          <p className="text-sm text-slate-500 dark:text-slate-400">
            На руках · не здано касиру
          </p>
          <Button
            size="sm"
            variant="outline"
            disabled={refreshing}
            onClick={onRefresh}
            className="shrink-0"
          >
            <RefreshCw
              className={`mr-1.5 h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`}
            />
            Оновити
          </Button>
        </div>
        <p className="mt-1 text-3xl font-bold tabular-nums text-sky-800 dark:text-sky-300">
          {collections.packageCount}
        </p>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          {packagesWord(collections.packageCount)} · Автоматів:{" "}
          {collections.machineCount}
        </p>
      </section>

      <section className="overflow-hidden rounded-2xl border border-sky-100 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-sky-50 bg-sky-50/60 px-4 py-3 dark:border-slate-800 dark:bg-slate-900/80">
          <span className="text-sm font-medium text-sky-900 dark:text-sky-200">
            На руках
          </span>
          {collections.packageCount > 0 ? (
            <button
              type="button"
              className="text-sm font-medium text-sky-700 dark:text-sky-300"
              onClick={toggleAll}
            >
              {allSelected ? "Зняти всі" : "Обрати всі"}
            </button>
          ) : null}
        </div>
        {collections.packageCount === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-slate-500 dark:text-slate-400">
            Немає інкасацій на руках
          </p>
        ) : (
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            {groups.map((group) => (
              <li key={group.machine} className="px-4 py-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <p className="font-medium text-slate-900 dark:text-slate-100">
                    {group.machine}
                  </p>
                  <p className="text-sm tabular-nums text-sky-800 dark:text-sky-300">
                    {group.packages.length} {packagesWord(group.packages.length)}
                  </p>
                </div>
                <ul className="mt-3 space-y-2">
                  {group.packages.map((pkg) => (
                    <OnHandRow
                      key={pkg.id}
                      phone={phone}
                      pkg={pkg}
                      checked={selected.has(pkg.id)}
                      onToggle={() => toggle(pkg.id)}
                      onChanged={onChanged}
                    />
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        )}

        {collections.packageCount > 0 ? (
          <div className="space-y-3 border-t border-slate-100 px-4 py-4 dark:border-slate-800">
            {collections.cashiers.length > 1 ? (
              <div className="space-y-1">
                <label className="text-sm text-slate-500">Касир</label>
                <select
                  className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950"
                  value={cashierId}
                  disabled={busy}
                  onChange={(e) => setCashierId(e.target.value)}
                >
                  <option value="">Оберіть касира</option>
                  {collections.cashiers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}
            <Button
              className="w-full"
              disabled={busy || selected.size === 0}
              onClick={() => void submitHandover()}
            >
              Передати касиру ({selected.size})
            </Button>
          </div>
        ) : null}
      </section>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <button
          type="button"
          className="flex w-full items-center justify-between px-4 py-3 text-left text-sm font-medium text-slate-800 dark:text-slate-200"
          onClick={() => setManualOpen((v) => !v)}
        >
          <span>Додати інкасацію вручну</span>
          <span className="text-xs text-slate-500">
            {manualOpen ? "Сховати" : "Відкрити"}
          </span>
        </button>
        {manualOpen ? (
          <ManualAddForm
            phone={phone}
            machines={collections.machines}
            onDone={() => {
              setManualOpen(false);
              onChanged();
            }}
          />
        ) : null}
      </section>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <button
          type="button"
          className="flex w-full items-center justify-between px-4 py-3 text-left text-sm font-medium text-slate-800 dark:text-slate-200"
          onClick={() => setHistoryOpen((v) => !v)}
        >
          <span>Історія ({collections.history.length})</span>
          <span className="text-xs text-slate-500">
            {historyOpen ? "Згорнути" : "Розгорнути"}
          </span>
        </button>
        {historyOpen ? (
          collections.history.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-slate-500">
              Історія порожня
            </p>
          ) : (
            <ul className="divide-y divide-slate-100 dark:divide-slate-800">
              {collections.history.map((pkg) => (
                <HistoryRow key={pkg.id} phone={phone} pkg={pkg} />
              ))}
            </ul>
          )
        ) : null}
      </section>
    </div>
  );
}

function OnHandRow({
  phone,
  pkg,
  checked,
  onToggle,
  onChanged,
}: {
  phone: string;
  pkg: TechnicianPublicCollections["packages"][number];
  checked: boolean;
  onToggle: () => void;
  onChanged: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [phantomOpen, setPhantomOpen] = useState(false);
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);

  const markPhantom = async () => {
    if (!comment.trim()) {
      toast.error("Напишіть коментар");
      return;
    }
    try {
      setBusy(true);
      await axios.post(
        `/api/public/technician/${phone}/collections/${pkg.id}/phantom`,
        { comment: comment.trim() }
      );
      toast.success("Позначено як фантом / збій");
      setPhantomOpen(false);
      setComment("");
      onChanged();
    } catch (error) {
      const message =
        axios.isAxiosError(error) && typeof error.response?.data === "string"
          ? error.response.data
          : "Не вдалося позначити";
      toast.error(message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <li className="rounded-xl bg-slate-50 px-3 py-2.5 dark:bg-slate-800/60">
      <label className="flex cursor-pointer items-start gap-3">
        <input
          type="checkbox"
          className="mt-1 size-4"
          checked={checked}
          onChange={onToggle}
        />
        <span className="min-w-0 flex-1">
          <p className="text-xs text-slate-500">
            {pkg.dateLabel} · {pkg.timeLabel}
          </p>
          <p className="mt-0.5 text-sm text-slate-700 dark:text-slate-200">
            {pkg.statusLabel}
            {pkg.isPhantom ? " · фантом" : ""}
            {pkg.isManual ? " · вручну" : ""}
            {pkg.overdue ? ` · на руках ${pkg.agingDays} дн.` : ""}
          </p>
        </span>
      </label>
      <div className="mt-2 flex flex-wrap gap-2 pl-7">
        <button
          type="button"
          className="text-xs font-medium text-sky-700 dark:text-sky-300"
          onClick={() => setOpen((v) => !v)}
        >
          {open ? "Сховати коментарі" : "Коментарі"}
        </button>
        {!pkg.isPhantom ? (
          <button
            type="button"
            className="text-xs font-medium text-amber-800 dark:text-amber-300"
            onClick={() => setPhantomOpen((v) => !v)}
          >
            Фантом / збій
          </button>
        ) : null}
      </div>
      {open ? (
        <div className="mt-2 pl-7">
          <CollectionCommentsThread
            compact
            endpoint={`/api/public/technician/${phone}/collections/${pkg.id}/comments`}
          />
        </div>
      ) : null}
      {phantomOpen ? (
        <div className="mt-2 space-y-2 pl-7">
          <Textarea
            rows={2}
            placeholder="Чому це фантом / збій картки"
            value={comment}
            disabled={busy}
            onChange={(e) => setComment(e.target.value)}
          />
          <Button size="sm" disabled={busy} onClick={() => void markPhantom()}>
            Позначити фантомом
          </Button>
        </div>
      ) : null}
    </li>
  );
}

function HistoryRow({
  phone,
  pkg,
}: {
  phone: string;
  pkg: TechnicianPublicCollections["packages"][number];
}) {
  const [open, setOpen] = useState(false);
  return (
    <li className="space-y-2 px-4 py-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="font-medium text-slate-900 dark:text-slate-100">
            {pkg.machine}
          </p>
          <p className="text-xs text-slate-400">
            {pkg.dateLabel} · {pkg.timeLabel}
          </p>
        </div>
        <p className="text-xs font-medium text-slate-600 dark:text-slate-300">
          {pkg.statusLabel}
        </p>
      </div>
      <button
        type="button"
        className="text-xs font-medium text-sky-700 dark:text-sky-300"
        onClick={() => setOpen((v) => !v)}
      >
        {open ? "Сховати коментарі" : "Коментарі"}
      </button>
      {open ? (
        <CollectionCommentsThread
          compact
          endpoint={`/api/public/technician/${phone}/collections/${pkg.id}/comments`}
        />
      ) : null}
    </li>
  );
}

function ManualAddForm({
  phone,
  machines,
  onDone,
}: {
  phone: string;
  machines: TechnicianPublicCollections["machines"];
  onDone: () => void;
}) {
  const now = new Date();
  const [deviceId, setDeviceId] = useState("");
  const [date, setDate] = useState(now.toLocaleDateString("en-CA", { timeZone: "Europe/Kyiv" }));
  const [time, setTime] = useState(
    now.toLocaleTimeString("en-GB", {
      timeZone: "Europe/Kyiv",
      hour: "2-digit",
      minute: "2-digit",
    })
  );
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!deviceId) {
      toast.error("Оберіть автомат");
      return;
    }
    if (!comment.trim()) {
      toast.error("Напишіть причину");
      return;
    }
    try {
      setBusy(true);
      await axios.post(`/api/public/technician/${phone}/collections/manual`, {
        deviceId: Number(deviceId),
        date,
        time,
        comment: comment.trim(),
      });
      toast.success("Інкасацію додано на руки");
      setComment("");
      onDone();
    } catch (error) {
      const message =
        axios.isAxiosError(error) && typeof error.response?.data === "string"
          ? error.response.data
          : "Не вдалося додати";
      toast.error(message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3 px-4 pb-4">
      <p className="text-xs text-slate-500">
        Якщо апарат не віддав дані в Soliton. Суму не вказуйте.
      </p>
      <div className="space-y-1">
        <label className="text-sm text-slate-500">Автомат</label>
        <select
          className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950"
          value={deviceId}
          disabled={busy}
          onChange={(e) => setDeviceId(e.target.value)}
        >
          <option value="">Оберіть автомат</option>
          {machines.map((m) => (
            <option key={m.id} value={m.id}>
              {m.label}
            </option>
          ))}
        </select>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <label className="text-sm text-slate-500">Дата</label>
          <Input
            type="date"
            value={date}
            disabled={busy}
            onChange={(e) => setDate(e.target.value)}
          />
        </div>
        <div className="space-y-1">
          <label className="text-sm text-slate-500">Час</label>
          <Input
            type="time"
            value={time}
            disabled={busy}
            onChange={(e) => setTime(e.target.value)}
          />
        </div>
      </div>
      <Textarea
        rows={3}
        placeholder="Причина ручного додавання"
        value={comment}
        disabled={busy}
        onChange={(e) => setComment(e.target.value)}
      />
      <Button size="sm" disabled={busy} onClick={() => void submit()}>
        Додати на руки
      </Button>
    </div>
  );
}
