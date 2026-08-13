"use client";

import { useMemo, useState } from "react";

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

function money(n: number) {
  return n.toLocaleString("uk-UA", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
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

interface CollectionsClientProps {
  data: CollectionColumn[];
  technicians: { id: number; name: string }[];
}

export const CollectionsClient: React.FC<CollectionsClientProps> = ({
  data,
  technicians,
}) => {
  const [query, setQuery] = useState("");
  const [filterTechnician, setFilterTechnician] = useState("all");
  const [period, setPeriod] = useState<CollectionPeriodPreset>("month");
  const [customFrom, setCustomFrom] = useState(kyivDateInputValue(new Date()));
  const [customTo, setCustomTo] = useState(kyivDateInputValue(new Date()));

  const technicianOptions = useMemo(() => {
    const map = new Map<number, string>();
    for (const t of technicians) {
      map.set(t.id, t.name);
    }
    for (const row of data) {
      if (row.technicianId != null && !map.has(row.technicianId)) {
        map.set(row.technicianId, row.technicianName);
      }
    }
    return Array.from(map.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name, "uk"));
  }, [technicians, data]);

  const bounds = useMemo(() => {
    if (period === "custom") {
      return kyivCustomPeriodBounds(customFrom, customTo);
    }
    return kyivPeriodBounds(period);
  }, [period, customFrom, customTo]);

  const matchesFilters = (row: CollectionColumn) => {
    if (bounds) {
      if (row.dateMs < bounds.from.getTime() || row.dateMs > bounds.to.getTime()) {
        return false;
      }
    } else if (period === "custom") {
      return false;
    }

    if (filterTechnician !== "all") {
      const id = Number(filterTechnician);
      if (row.technicianId !== id) return false;
    }

    const q = query.trim().toLowerCase();
    if (!q) return true;
    return row.search.toLowerCase().includes(q);
  };

  const filtered = useMemo(
    () => data.filter((row) => matchesFilters(row)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [data, query, filterTechnician, bounds, period]
  );

  const handed = useMemo(
    () => filtered.filter((row) => row.handedOver),
    [filtered]
  );

  const unhanded = useMemo(
    () => filtered.filter((row) => !row.handedOver),
    [filtered]
  );

  const summary = useMemo(() => {
    const machines = new Set<string>();
    let countCoins = 0;
    let sumCoins = 0;
    let countBanknotes = 0;
    let sumBanknotes = 0;
    let total = 0;
    for (const row of unhanded) {
      machines.add(
        row.deviceId != null ? `id:${row.deviceId}` : `name:${row.machine}`
      );
      countCoins += row.countCoins;
      sumCoins += row.sumCoinsValue;
      countBanknotes += row.countBanknotes;
      sumBanknotes += row.sumBanknotesValue;
      total += row.totalValue;
    }
    return {
      collections: unhanded.length,
      machines: machines.size,
      countCoins,
      sumCoins,
      countBanknotes,
      sumBanknotes,
      total,
    };
  }, [unhanded]);

  return (
    <>
      <Heading
        title={`Інкасації (${filtered.length})`}
        description="Підсумки рахують лише нездані інкасації. Технік — відповідальний за автомат."
      />
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
          />
        </div>

        <span className="pb-2 text-sm text-muted-foreground">
          {bounds
            ? `${bounds.fromKey} – ${bounds.toKey}`
            : "Некоректний період"}
          {" · "}
          {filtered.length} з {data.length}
        </span>
      </div>

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
          value={`${summary.countCoins.toLocaleString("uk-UA")} шт`}
          hint={`${money(summary.sumCoins)} грн`}
        />
        <SummaryCard
          label="Купюри"
          value={`${summary.countBanknotes.toLocaleString("uk-UA")} шт`}
          hint={`${money(summary.sumBanknotes)} грн`}
        />
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
  );
};
