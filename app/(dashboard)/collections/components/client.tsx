"use client";

import { useEffect, useMemo, useState } from "react";

import { DataTable } from "@/components/ui/data-table";
import { Heading } from "@/components/ui/heading";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  COLLECTION_PERIOD_PRESETS,
  kyivCustomPeriodBounds,
  kyivDateInputValue,
  kyivPeriodBounds,
  type CollectionPeriodPreset,
} from "@/lib/kyiv-date";
import { columns, CollectionColumn } from "./columns";
import { HandoversList } from "./handovers-list";
import { ReviewQueue } from "./review-queue";
import type { AntifraudItem, ReviewQueueItem } from "@/lib/collection-lifecycle";

type BoardSummary = {
  collections: number;
  machines: number;
  sumCoins: number;
  sumBanknotes: number;
  total: number;
};

type BoardAnalytics = {
  autoPct: number | null;
  mismatchPct: number | null;
  techRows: { name: string; total: number; mismatch: number }[];
  phantomMachines: [string, { phantoms: number }][];
};

function money(n: number) {
  return n.toLocaleString("uk-UA", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function emptySummary(): BoardSummary {
  return {
    collections: 0,
    machines: 0,
    sumCoins: 0,
    sumBanknotes: 0,
    total: 0,
  };
}

function emptyAnalytics(): BoardAnalytics {
  return {
    autoPct: null,
    mismatchPct: null,
    techRows: [],
    phantomMachines: [],
  };
}

function summarizeUnhanded(rows: CollectionColumn[]): BoardSummary {
  const machines = new Set<string>();
  let sumCoins = 0;
  let sumBanknotes = 0;
  let total = 0;
  let collections = 0;
  for (const row of rows) {
    if (row.handedOver) continue;
    collections += 1;
    machines.add(
      row.deviceId != null ? `id:${row.deviceId}` : `name:${row.machine}`
    );
    sumCoins += row.sumCoinsValue;
    sumBanknotes += row.sumBanknotesValue;
    total += row.totalValue;
  }
  return { collections, machines: machines.size, sumCoins, sumBanknotes, total };
}

function analyzeRows(rows: CollectionColumn[]): BoardAnalytics {
  const withFact = rows.filter(
    (r) => r.actualReceived != null && r.recountStatus === "done"
  );
  const mismatch = withFact.filter((r) => r.deltaPct != null && r.deltaPct > 2);
  const autoClosed = rows.filter((r) => r.lifecycleStatus === "closed_auto").length;
  const closed =
    autoClosed + rows.filter((r) => r.lifecycleStatus === "closed_manual").length;
  const byTech = new Map<string, { name: string; total: number; mismatch: number }>();
  for (const row of withFact) {
    const key = String(row.technicianId ?? row.technicianName);
    const cur = byTech.get(key) ?? {
      name: row.technicianName,
      total: 0,
      mismatch: 0,
    };
    cur.total += 1;
    if (row.deltaPct != null && row.deltaPct > 2) cur.mismatch += 1;
    byTech.set(key, cur);
  }
  const byMachine = new Map<string, { phantoms: number }>();
  for (const row of rows) {
    if (!row.isPhantom) continue;
    const cur = byMachine.get(row.machine) ?? { phantoms: 0 };
    cur.phantoms += 1;
    byMachine.set(row.machine, cur);
  }
  return {
    autoPct: closed > 0 ? Math.round((autoClosed / closed) * 1000) / 10 : null,
    mismatchPct:
      withFact.length > 0
        ? Math.round((mismatch.length / withFact.length) * 1000) / 10
        : null,
    techRows: [...byTech.values()]
      .sort((a, b) => b.mismatch / b.total - a.mismatch / a.total)
      .slice(0, 5),
    phantomMachines: [...byMachine.entries()]
      .sort((a, b) => b[1].phantoms - a[1].phantoms)
      .slice(0, 5),
  };
}

function SummaryCard({
  label,
  value,
  hint,
  emphasize,
}: {
  label: string;
  value: string;
  hint?: string;
  emphasize?: boolean;
}) {
  return (
    <div className="rounded-xl border bg-card px-4 py-3 shadow-sm">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p
        className={
          emphasize
            ? "mt-1 text-xl font-semibold tabular-nums text-sky-800 dark:text-sky-300"
            : "mt-1 text-xl font-semibold tabular-nums"
        }
      >
        {value}
      </p>
      {hint ? (
        <p className="mt-0.5 text-xs text-muted-foreground tabular-nums">{hint}</p>
      ) : null}
    </div>
  );
}

function Pulse({ className }: { className: string }) {
  return <div className={`animate-pulse rounded-md bg-muted ${className}`} />;
}

function BoardSkeleton() {
  return (
    <div className="space-y-3" aria-busy="true">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="rounded-xl border bg-card px-4 py-3 shadow-sm">
            <Pulse className="h-3 w-24" />
            <Pulse className="mt-3 h-7 w-28" />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <div className="rounded-xl border bg-card px-4 py-3 shadow-sm">
          <Pulse className="h-3 w-40" />
          <Pulse className="mt-3 h-7 w-16" />
          <Pulse className="mt-2 h-3 w-48" />
        </div>
        <div className="rounded-xl border bg-card px-4 py-3 shadow-sm">
          <Pulse className="h-3 w-44" />
          <Pulse className="mt-3 h-4 w-36" />
          <Pulse className="mt-2 h-4 w-28" />
        </div>
      </div>
      <div className="rounded-xl border bg-card p-4 shadow-sm">
        <Pulse className="h-8 w-full" />
        <Pulse className="mt-3 h-8 w-full" />
        <Pulse className="mt-3 h-8 w-full" />
        <Pulse className="mt-3 h-8 w-3/4" />
      </div>
    </div>
  );
}

interface CollectionsClientProps {
  technicians: { id: number; name: string }[];
  reviewQueue: ReviewQueueItem[];
  overdue: AntifraudItem[];
  overdueTotal: number;
}

export const CollectionsClient: React.FC<CollectionsClientProps> = ({
  technicians,
  reviewQueue,
  overdue,
  overdueTotal,
}) => {
  const [query, setQuery] = useState("");
  const [filterTechnician, setFilterTechnician] = useState("all");
  const [period, setPeriod] = useState<CollectionPeriodPreset>("month");
  const [customFrom, setCustomFrom] = useState(kyivDateInputValue(new Date()));
  const [customTo, setCustomTo] = useState(kyivDateInputValue(new Date()));
  const [rows, setRows] = useState<CollectionColumn[]>([]);
  const [boardSummary, setBoardSummary] = useState<BoardSummary>(emptySummary);
  const [boardAnalytics, setBoardAnalytics] =
    useState<BoardAnalytics>(emptyAnalytics);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const bounds = useMemo(() => {
    if (period === "custom") {
      return kyivCustomPeriodBounds(customFrom, customTo);
    }
    return kyivPeriodBounds(period);
  }, [period, customFrom, customTo]);

  useEffect(() => {
    if (!bounds) {
      setRows([]);
      setBoardSummary(emptySummary());
      setBoardAnalytics(emptyAnalytics());
      setLoading(false);
      setError("Некоректний період");
      return;
    }

    const params = new URLSearchParams({ period });
    if (period === "custom") {
      params.set("from", customFrom);
      params.set("to", customTo);
    }
    if (filterTechnician !== "all") {
      params.set("technicianId", filterTechnician);
    }

    const ac = new AbortController();
    const delay = period === "custom" ? 280 : 0;
    const timer = window.setTimeout(() => {
      setLoading(true);
      setError(null);
      fetch(`/api/collections/board?${params.toString()}`, {
        signal: ac.signal,
      })
        .then(async (res) => {
          if (!res.ok) {
            throw new Error(
              (await res.text()) || "Не вдалося завантажити таблицю"
            );
          }
          return res.json() as Promise<{
            rows: CollectionColumn[];
            summary: BoardSummary;
            analytics: BoardAnalytics;
          }>;
        })
        .then((board) => {
          setRows(board.rows ?? []);
          setBoardSummary(board.summary ?? emptySummary());
          setBoardAnalytics(board.analytics ?? emptyAnalytics());
        })
        .catch((err: unknown) => {
          if (ac.signal.aborted) return;
          setRows([]);
          setBoardSummary(emptySummary());
          setBoardAnalytics(emptyAnalytics());
          setError(
            err instanceof Error ? err.message : "Не вдалося завантажити таблицю"
          );
        })
        .finally(() => {
          if (!ac.signal.aborted) setLoading(false);
        });
    }, delay);

    return () => {
      window.clearTimeout(timer);
      ac.abort();
    };
  }, [period, customFrom, customTo, filterTechnician, bounds]);

  const technicianOptions = useMemo(() => {
    const map = new Map<number, string>();
    for (const t of technicians) {
      map.set(t.id, t.name);
    }
    for (const row of rows) {
      if (row.technicianId != null && !map.has(row.technicianId)) {
        map.set(row.technicianId, row.technicianName);
      }
    }
    return Array.from(map.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name, "uk"));
  }, [technicians, rows]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((row) => row.search.toLowerCase().includes(q));
  }, [rows, query]);

  const handed = useMemo(
    () => filtered.filter((row) => row.handedOver),
    [filtered]
  );

  const summary = useMemo(
    () => (query.trim() ? summarizeUnhanded(filtered) : boardSummary),
    [query, filtered, boardSummary]
  );

  const analytics = useMemo(
    () => (query.trim() ? analyzeRows(filtered) : boardAnalytics),
    [query, filtered, boardAnalytics]
  );

  const titleCount = loading ? "…" : String(filtered.length);

  return (
    <>
      <Heading
        title={`Інкасації (${titleCount})`}
        description="Підсумки рахують лише нездані інкасації. Технік — відповідальний за автомат. Таблиця підвантажується за обраний період."
      />
      <Separator />

      {overdueTotal > 0 ? (
        <div className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm dark:border-amber-900 dark:bg-amber-950/30">
          <p className="font-medium text-amber-900 dark:text-amber-200">
            Антифрод: на руках понад 7 днів — {overdueTotal}
          </p>
          <ul className="mt-2 space-y-1 text-amber-900/80 dark:text-amber-100/80">
            {overdue.map((item) => (
              <li key={item.id}>
                {item.technicianName} · {item.machine} · {item.dateLabel} ·{" "}
                {item.agingDays} дн.
              </li>
            ))}
          </ul>
          {overdueTotal > overdue.length ? (
            <p className="mt-2 text-xs text-amber-900/70 dark:text-amber-100/70">
              Показано {overdue.length} з {overdueTotal}. Повний список — у фільтрі
              періоду.
            </p>
          ) : null}
        </div>
      ) : null}

      <Heading
        title={`На розгляді (${reviewQueue.length})`}
        description="Окрема черга ручного закриття. Не змішується з таблицею всіх інкасацій."
      />
      <ReviewQueue items={reviewQueue} technicians={technicians} />
      <Separator />

      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <label className="text-sm text-muted-foreground">Період</label>
          <Select
            value={period}
            onValueChange={(v) => setPeriod(v as CollectionPeriodPreset)}
          >
            <SelectTrigger className="w-[220px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {COLLECTION_PERIOD_PRESETS.map((p) => (
                <SelectItem key={p.value} value={p.value}>
                  {p.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {period === "custom" ? (
          <>
            <div className="space-y-1">
              <label className="text-sm text-muted-foreground">Від</label>
              <Input
                type="date"
                value={customFrom}
                onChange={(e) => setCustomFrom(e.target.value)}
                className="w-[160px]"
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm text-muted-foreground">До</label>
              <Input
                type="date"
                value={customTo}
                onChange={(e) => setCustomTo(e.target.value)}
                className="w-[160px]"
              />
            </div>
          </>
        ) : null}

        <div className="space-y-1">
          <label className="text-sm text-muted-foreground">Технік</label>
          <Select
            value={filterTechnician}
            onValueChange={setFilterTechnician}
          >
            <SelectTrigger className="w-[220px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Усі</SelectItem>
              {technicianOptions.map((t) => (
                <SelectItem key={t.id} value={String(t.id)}>
                  {t.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1">
          <label className="text-sm text-muted-foreground">Пошук</label>
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Автомат, технік…"
            className="w-[240px]"
            disabled={loading}
          />
        </div>

        <span className="pb-2 text-sm text-muted-foreground">
          {bounds
            ? `${bounds.fromKey} – ${bounds.toKey}`
            : "Некоректний період"}
          {" · "}
          {loading ? "завантаження…" : `${filtered.length} з ${rows.length}`}
        </span>
      </div>

      {error ? (
        <p className="rounded-xl border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {error}
        </p>
      ) : null}

      {loading ? (
        <BoardSkeleton />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
            <SummaryCard
              label="Інкасацій (нездані)"
              value={summary.collections.toLocaleString("uk-UA")}
            />
            <SummaryCard
              label="Автоматів"
              value={summary.machines.toLocaleString("uk-UA")}
            />
            <SummaryCard
              label="Разом"
              value={`${money(summary.total)} грн`}
              emphasize
            />
            <SummaryCard
              label="Монети"
              value={`${money(summary.sumCoins)} грн`}
            />
            <SummaryCard
              label="Купюри"
              value={`${money(summary.sumBanknotes)} грн`}
            />
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div className="rounded-xl border bg-card px-4 py-3 shadow-sm">
              <p className="text-xs text-muted-foreground">Автозакриття за період</p>
              <p className="mt-1 text-xl font-semibold tabular-nums">
                {analytics.autoPct == null ? "—" : `${analytics.autoPct}%`}
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Розбіжності факт vs база:{" "}
                {analytics.mismatchPct == null ? "—" : `${analytics.mismatchPct}%`}
              </p>
            </div>
            <div className="rounded-xl border bg-card px-4 py-3 shadow-sm">
              <p className="text-xs text-muted-foreground">Топ розбіжностей (техніки)</p>
              {analytics.techRows.length === 0 ? (
                <p className="mt-2 text-sm text-muted-foreground">Немає фактів</p>
              ) : (
                <ul className="mt-2 space-y-1 text-sm">
                  {analytics.techRows.map((t) => (
                    <li key={t.name}>
                      {t.name}: {t.mismatch}/{t.total}
                    </li>
                  ))}
                </ul>
              )}
              {analytics.phantomMachines.length > 0 ? (
                <p className="mt-2 text-xs text-muted-foreground">
                  Фантоми:{" "}
                  {analytics.phantomMachines
                    .map(([name, v]) => `${name} (${v.phantoms})`)
                    .join(" · ")}
                </p>
              ) : null}
            </div>
          </div>

          <DataTable
            searchKey="search"
            columns={columns}
            data={filtered}
            hideSearch
          />

          <Separator />
          <Heading
            title={`Здачі (${new Set(handed.map((r) => r.handoverId)).size})`}
            description="Сума і статус здачі. Розгорніть, щоб побачити перерахунок кожного пакета."
          />
          <HandoversList data={handed} />
        </>
      )}
    </>
  );
};
