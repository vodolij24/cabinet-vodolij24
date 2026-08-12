"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import axios from "axios";
import { toast } from "react-hot-toast";
import { Check, Pencil, Trash2, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export type MachineRow = {
  id: number;
  name: string | null;
  location: string;
  technicianId: number | null;
  technicianName: string | null;
  status: string | null;
  todayLiters: number;
  todayCash: number;
  todayCashless: number;
  cashInMachine: number;
  lastCollectionDate: string | null;
  lastCollectionSum: number | null;
  filterSpeed: number | null;
  waterTds: number | null;
  waterQualityValue: number | null;
  waterMetricsDate: string | null;
};

export type TechnicianOption = {
  id: number;
  name: string;
};

type TxFilter = "all" | "cash" | "cashless";

type TxRow = {
  id: number;
  date: string;
  liters: number;
  cash: number;
  card: number;
  online: number;
  cashless: number;
  cardId: number | null;
  cardOwner: {
    name: string | null;
    phone: string | null;
    cardNumber: string | null;
  } | null;
};

function formatLiters(n: number) {
  return n.toLocaleString("uk-UA");
}

function formatMoney(n: number) {
  return n.toLocaleString("uk-UA");
}

function formatMoneyFull(n: number) {
  return `${n.toLocaleString("uk-UA")} грн`;
}

/** Пороги каси для баджів (грн) */
const CASHBOX_WARN = 1000;
const CASHBOX_ALERT = 2500;

function cashboxBadgeClass(amount: number): string {
  if (amount >= CASHBOX_ALERT) {
    return "bg-rose-600 text-white hover:bg-rose-600";
  }
  if (amount >= CASHBOX_WARN) {
    return "bg-amber-500 text-white hover:bg-amber-500";
  }
  return "bg-emerald-600 text-white hover:bg-emerald-600";
}

function CashboxCell({
  amount,
  lastCollectionDate,
  lastCollectionSum,
}: {
  amount: number;
  lastCollectionDate: string | null;
  lastCollectionSum: number | null;
}) {
  const tip = lastCollectionDate
    ? `Інкас. ${lastCollectionDate}${
        lastCollectionSum != null
          ? ` · ${formatMoneyFull(lastCollectionSum)}`
          : ""
      }`
    : "Інкасацій немає";

  return (
    <div className="flex flex-col items-end" title={tip}>
      <Badge
        className={`px-1.5 py-0 text-[11px] tabular-nums ${cashboxBadgeClass(amount)}`}
      >
        {formatMoney(amount)}
      </Badge>
      {lastCollectionDate ? (
        <div className="max-w-[72px] truncate text-[10px] leading-tight text-muted-foreground">
          {lastCollectionDate.split(",")[0]}
        </div>
      ) : null}
    </div>
  );
}

function tdsBadgeClass(tds: number): string {
  if (tds > 150) return "bg-rose-600 text-white hover:bg-rose-600";
  if (tds >= 50) return "bg-amber-500 text-white hover:bg-amber-500";
  return "bg-emerald-600 text-white hover:bg-emerald-600";
}

function speedBadgeClass(speed: number): string {
  if (speed < 8) return "bg-rose-600 text-white hover:bg-rose-600";
  if (speed < 15) return "bg-amber-500 text-white hover:bg-amber-500";
  return "bg-emerald-600 text-white hover:bg-emerald-600";
}

function formatSpeed(n: number) {
  return n.toLocaleString("uk-UA", { maximumFractionDigits: 1 });
}

function MetricCell({
  value,
  unit,
  date,
  badgeClass,
  empty = "—",
}: {
  value: number | null;
  unit: string;
  date: string | null;
  badgeClass: (n: number) => string;
  empty?: string;
}) {
  if (value == null) {
    return <span className="text-muted-foreground">{empty}</span>;
  }
  return (
    <Badge
      className={`px-1.5 py-0 text-[11px] tabular-nums ${badgeClass(value)}`}
      title={date || undefined}
    >
      {formatSpeed(value)}
      {unit ? ` ${unit}` : ""}
    </Badge>
  );
}

function filterTitle(filter: TxFilter) {
  if (filter === "cash") return "Готівкові транзакції";
  if (filter === "cashless") return "Безготівкові транзакції";
  return "Усі транзакції";
}

export function MachinesClient({
  machines,
  technicians,
  todayLabel,
}: {
  machines: MachineRow[];
  technicians: TechnicianOption[];
  todayLabel: string;
}) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<number | "new" | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [filterTech, setFilterTech] = useState("all");
  const [searchId, setSearchId] = useState("");
  const [draftId, setDraftId] = useState("");
  const [draftName, setDraftName] = useState("");
  const [draftLocation, setDraftLocation] = useState("");
  const [draftTech, setDraftTech] = useState("none");
  const [editId, setEditId] = useState<number | null>(null);
  const [edit, setEdit] = useState({
    name: "",
    location: "",
    technicianId: "none",
  });
  const [txOpen, setTxOpen] = useState(false);
  const [txLoading, setTxLoading] = useState(false);
  const [txMachine, setTxMachine] = useState<MachineRow | null>(null);
  const [txFilter, setTxFilter] = useState<TxFilter>("all");
  const [txRows, setTxRows] = useState<TxRow[]>([]);

  const filteredMachines = useMemo(() => {
    let rows = machines;

    const idQuery = searchId.trim();
    if (idQuery) {
      rows = rows.filter((m) => String(m.id).includes(idQuery));
    }

    if (filterTech === "none") {
      rows = rows.filter((m) => m.technicianId === null);
    } else if (filterTech !== "all") {
      const id = parseInt(filterTech, 10);
      rows = rows.filter((m) => m.technicianId === id);
    }

    return rows;
  }, [machines, filterTech, searchId]);

  const openTxLog = async (machine: MachineRow, filter: TxFilter) => {
    setTxMachine(machine);
    setTxFilter(filter);
    setTxOpen(true);
    setTxRows([]);
    try {
      setTxLoading(true);
      const { data } = await axios.get<{ transactions: TxRow[] }>(
        `/api/machines/${machine.id}/transactions?filter=${filter}`
      );
      setTxRows(data.transactions || []);
    } catch {
      toast.error("Не вдалося завантажити транзакції");
      setTxOpen(false);
    } finally {
      setTxLoading(false);
    }
  };

  const onSync = async () => {
    try {
      setSyncing(true);
      const { data } = await axios.post("/api/machines/sync");
      toast.success(
        `Soliton: ${data.total} · нових ${data.created} · оновлено ${data.updated}` +
          (data.metrics
            ? ` · метрики ${data.metrics.updated}/${data.metrics.total}`
            : "")
      );
      router.refresh();
    } catch {
      toast.error("Не вдалося синхронізувати з Soliton");
    } finally {
      setSyncing(false);
    }
  };

  const startEdit = (m: MachineRow) => {
    setEditId(m.id);
    setEdit({
      name: m.name || "",
      location: m.location || "",
      technicianId: m.technicianId ? String(m.technicianId) : "none",
    });
  };

  const onCreate = async () => {
    if (!draftLocation.trim()) {
      toast.error("Вкажіть локацію");
      return;
    }
    try {
      setBusyId("new");
      await axios.post("/api/machines", {
        id: draftId.trim() || undefined,
        name: draftName.trim() || null,
        location: draftLocation.trim(),
        technicianId: draftTech === "none" ? null : draftTech,
      });
      setDraftId("");
      setDraftName("");
      setDraftLocation("");
      setDraftTech("none");
      toast.success("Автомат додано");
      router.refresh();
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 409) {
        toast.error("Такий номер автомата вже є");
      } else {
        toast.error("Не вдалося створити");
      }
    } finally {
      setBusyId(null);
    }
  };

  const onSave = async (id: number) => {
    if (!edit.location.trim()) {
      toast.error("Вкажіть локацію");
      return;
    }
    try {
      setBusyId(id);
      await axios.patch(`/api/machines/${id}`, {
        name: edit.name.trim() || null,
        location: edit.location.trim(),
        technicianId: edit.technicianId === "none" ? null : edit.technicianId,
      });
      setEditId(null);
      toast.success("Збережено");
      router.refresh();
    } catch {
      toast.error("Не вдалося зберегти");
    } finally {
      setBusyId(null);
    }
  };

  const onDelete = async (id: number) => {
    try {
      setBusyId(id);
      await axios.delete(`/api/machines/${id}`);
      toast.success("Видалено");
      router.refresh();
    } catch {
      toast.error("Не вдалося видалити");
    } finally {
      setBusyId(null);
    }
  };

  const statusBadge = (status: string | null) => {
    if (status === "operational") {
      return (
        <span
          className="inline-block h-2.5 w-2.5 rounded-full bg-emerald-600"
          title="ok"
        />
      );
    }
    if (status === "maintenance") {
      return (
        <span
          className="inline-block h-2.5 w-2.5 rounded-full bg-amber-500"
          title="maintenance"
        />
      );
    }
    if (status === "out_of_service") {
      return (
        <span
          className="inline-block h-2.5 w-2.5 rounded-full bg-rose-600"
          title="offline"
        />
      );
    }
    return (
      <span
        className="inline-block h-2.5 w-2.5 rounded-full bg-slate-400"
        title={status || "—"}
      />
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant="secondary"
          disabled={syncing || busyId !== null}
          onClick={onSync}
        >
          {syncing ? "Синхронізація…" : "Оновити з Soliton"}
        </Button>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground whitespace-nowrap">
            № апарату
          </span>
          <Input
            value={searchId}
            onChange={(e) => setSearchId(e.target.value)}
            placeholder="153"
            inputMode="numeric"
            className="w-[120px]"
          />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground whitespace-nowrap">
            Фільтр техніка
          </span>
          <Select value={filterTech} onValueChange={setFilterTech}>
            <SelectTrigger className="w-[240px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Усі автомати</SelectItem>
              <SelectItem value="none">Без техніка</SelectItem>
              {technicians.map((t) => (
                <SelectItem key={t.id} value={String(t.id)}>
                  {t.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <span className="text-sm text-muted-foreground">
          Показано {filteredMachines.length} з {machines.length} · показники за{" "}
          {todayLabel}
        </span>
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        <div className="space-y-1">
          <label className="text-sm text-muted-foreground">№ автомата</label>
          <Input
            value={draftId}
            onChange={(e) => setDraftId(e.target.value)}
            placeholder="напр. 153"
            inputMode="numeric"
          />
        </div>
        <div className="space-y-1">
          <label className="text-sm text-muted-foreground">Назва</label>
          <Input
            value={draftName}
            onChange={(e) => setDraftName(e.target.value)}
            placeholder="Ваша назва"
          />
        </div>
        <div className="space-y-1">
          <label className="text-sm text-muted-foreground">Локація</label>
          <Input
            value={draftLocation}
            onChange={(e) => setDraftLocation(e.target.value)}
            placeholder="Вулиця / місце"
          />
        </div>
        <div className="space-y-1">
          <label className="text-sm text-muted-foreground">Технік</label>
          <Select
            value={draftTech}
            onValueChange={setDraftTech}
            disabled={technicians.length === 0}
          >
            <SelectTrigger>
              <SelectValue
                placeholder={
                  technicians.length === 0
                    ? "Немає техніків у налаштуваннях"
                    : "Технік"
                }
              />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Не призначено</SelectItem>
              {technicians.map((t) => (
                <SelectItem key={t.id} value={String(t.id)}>
                  {t.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <Button onClick={onCreate} disabled={busyId === "new"}>
        Додати автомат
      </Button>

      <div className="rounded-md border">
        <Table className="w-full table-fixed text-xs">
          <TableHeader>
            <TableRow>
              <TableHead className="w-[44px] px-1.5">№</TableHead>
              <TableHead className="w-[12%] px-1.5">Назва</TableHead>
              <TableHead className="w-[14%] px-1.5">Локація</TableHead>
              <TableHead className="w-[10%] px-1.5">Технік</TableHead>
              <TableHead className="w-[56px] px-1 text-right" title="Об'єм, л">
                л
              </TableHead>
              <TableHead className="w-[56px] px-1 text-right" title="Готівка">
                Гот.
              </TableHead>
              <TableHead
                className="w-[56px] px-1 text-right"
                title="Безготівка"
              >
                Безг.
              </TableHead>
              <TableHead className="w-[72px] px-1 text-right">Каса</TableHead>
              <TableHead
                className="w-[56px] px-1 text-right"
                title="Швидкість фільтрації"
              >
                Шв.
              </TableHead>
              <TableHead className="w-[56px] px-1 text-right" title="TDS">
                TDS
              </TableHead>
              <TableHead className="w-[28px] px-0.5" title="Статус" />
              <TableHead className="w-[64px] px-1 text-right" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredMachines.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={12}
                  className="text-center text-muted-foreground"
                >
                  {machines.length === 0
                    ? "Немає автоматів у реєстрі"
                    : "Немає автоматів за цим фільтром"}
                </TableCell>
              </TableRow>
            ) : (
              filteredMachines.map((m) => {
                const busy = busyId === m.id;
                const editing = editId === m.id;

                if (editing) {
                  return (
                    <TableRow key={m.id} className="align-middle">
                      <TableCell className="px-1.5 font-medium">{m.id}</TableCell>
                      <TableCell className="px-1">
                        <Input
                          className="h-7 text-xs"
                          value={edit.name}
                          placeholder="Назва"
                          onChange={(e) =>
                            setEdit((s) => ({ ...s, name: e.target.value }))
                          }
                        />
                      </TableCell>
                      <TableCell className="px-1">
                        <Input
                          className="h-7 text-xs"
                          value={edit.location}
                          onChange={(e) =>
                            setEdit((s) => ({
                              ...s,
                              location: e.target.value,
                            }))
                          }
                        />
                      </TableCell>
                      <TableCell className="px-1">
                        <Select
                          value={edit.technicianId}
                          onValueChange={(v) =>
                            setEdit((s) => ({ ...s, technicianId: v }))
                          }
                        >
                          <SelectTrigger className="h-7 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">—</SelectItem>
                            {technicians.map((t) => (
                              <SelectItem key={t.id} value={String(t.id)}>
                                {t.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell className="px-1 text-right tabular-nums text-muted-foreground">
                        {formatLiters(m.todayLiters)}
                      </TableCell>
                      <TableCell className="px-1 text-right tabular-nums text-muted-foreground">
                        {formatMoney(m.todayCash)}
                      </TableCell>
                      <TableCell className="px-1 text-right tabular-nums text-muted-foreground">
                        {formatMoney(m.todayCashless)}
                      </TableCell>
                      <TableCell className="px-1 text-right">
                        <CashboxCell
                          amount={m.cashInMachine}
                          lastCollectionDate={m.lastCollectionDate}
                          lastCollectionSum={m.lastCollectionSum}
                        />
                      </TableCell>
                      <TableCell className="px-1 text-right">
                        <MetricCell
                          value={m.filterSpeed}
                          unit=""
                          date={m.waterMetricsDate}
                          badgeClass={speedBadgeClass}
                        />
                      </TableCell>
                      <TableCell className="px-1 text-right">
                        <MetricCell
                          value={m.waterTds}
                          unit=""
                          date={m.waterMetricsDate}
                          badgeClass={tdsBadgeClass}
                        />
                      </TableCell>
                      <TableCell className="px-0.5 text-center">
                        {statusBadge(m.status)}
                      </TableCell>
                      <TableCell className="px-1">
                        <div className="flex justify-end gap-0.5">
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7 text-emerald-700"
                            disabled={busy}
                            onClick={() => onSave(m.id)}
                            title="Зберегти"
                            aria-label="Зберегти"
                          >
                            <Check className="h-4 w-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7"
                            disabled={busy}
                            onClick={() => setEditId(null)}
                            title="Скасувати"
                            aria-label="Скасувати"
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                }

                return (
                  <TableRow key={m.id} className="align-middle">
                    <TableCell className="px-1.5 font-medium">{m.id}</TableCell>
                    <TableCell
                      className="truncate px-1.5"
                      title={m.name || undefined}
                    >
                      {m.name || "—"}
                    </TableCell>
                    <TableCell
                      className="truncate px-1.5"
                      title={m.location || undefined}
                    >
                      {m.location || "—"}
                    </TableCell>
                    <TableCell
                      className="truncate px-1.5"
                      title={m.technicianName || undefined}
                    >
                      {m.technicianName || "—"}
                    </TableCell>
                    <TableCell className="px-1 text-right tabular-nums">
                      <button
                        type="button"
                        className="underline-offset-2 hover:underline"
                        onClick={() => openTxLog(m, "all")}
                        title="Лог усіх транзакцій"
                      >
                        {formatLiters(m.todayLiters)}
                      </button>
                    </TableCell>
                    <TableCell className="px-1 text-right tabular-nums">
                      <button
                        type="button"
                        className="underline-offset-2 hover:underline"
                        onClick={() => openTxLog(m, "cash")}
                        title="Лог готівки"
                      >
                        {formatMoney(m.todayCash)}
                      </button>
                    </TableCell>
                    <TableCell className="px-1 text-right tabular-nums">
                      <button
                        type="button"
                        className="underline-offset-2 hover:underline"
                        onClick={() => openTxLog(m, "cashless")}
                        title="Лог безготівки"
                      >
                        {formatMoney(m.todayCashless)}
                      </button>
                    </TableCell>
                    <TableCell className="px-1 text-right">
                      <CashboxCell
                        amount={m.cashInMachine}
                        lastCollectionDate={m.lastCollectionDate}
                        lastCollectionSum={m.lastCollectionSum}
                      />
                    </TableCell>
                    <TableCell className="px-1 text-right">
                      <MetricCell
                        value={m.filterSpeed}
                        unit=""
                        date={m.waterMetricsDate}
                        badgeClass={speedBadgeClass}
                      />
                    </TableCell>
                    <TableCell className="px-1 text-right">
                      <MetricCell
                        value={m.waterTds}
                        unit=""
                        date={m.waterMetricsDate}
                        badgeClass={tdsBadgeClass}
                      />
                    </TableCell>
                    <TableCell className="px-0.5 text-center">
                      {statusBadge(m.status)}
                    </TableCell>
                    <TableCell className="px-1">
                      <div className="flex justify-end gap-0.5">
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7"
                          disabled={busy}
                          onClick={() => startEdit(m)}
                          title="Редагувати"
                          aria-label="Редагувати"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7 text-rose-600 hover:text-rose-700"
                          disabled={busy}
                          onClick={() => onDelete(m.id)}
                          title="Видалити"
                          aria-label="Видалити"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={txOpen} onOpenChange={setTxOpen}>
        <DialogContent className="sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle>
              {filterTitle(txFilter)} · №{txMachine?.id}
            </DialogTitle>
            <DialogDescription>
              {txMachine?.name || txMachine?.location || "Автомат"} · за{" "}
              {todayLabel} (Europe/Kyiv)
            </DialogDescription>
          </DialogHeader>

          {txLoading ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Завантаження…
            </p>
          ) : txRows.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Немає транзакцій за сьогодні
            </p>
          ) : (
            <div className="max-h-[60vh] overflow-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Час</TableHead>
                    <TableHead className="text-right">Об&apos;єм</TableHead>
                    {txFilter === "all" || txFilter === "cash" ? (
                      <TableHead className="text-right">Готівка</TableHead>
                    ) : null}
                    {txFilter === "all" || txFilter === "cashless" ? (
                      <>
                        <TableHead className="text-right">Картка</TableHead>
                        <TableHead className="text-right">Онлайн</TableHead>
                      </>
                    ) : null}
                    <TableHead>Власник картки</TableHead>
                    <TableHead className="text-right">Картка ID</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {txRows.map((row) => {
                    const isCardTx = row.card > 0 || row.online > 0;
                    const owner = isCardTx ? row.cardOwner : null;
                    return (
                      <TableRow key={row.id}>
                        <TableCell className="whitespace-nowrap text-sm">
                          {row.date}
                        </TableCell>
                        <TableCell className="text-right tabular-nums whitespace-nowrap">
                          {formatLiters(row.liters)} л
                        </TableCell>
                        {txFilter === "all" || txFilter === "cash" ? (
                          <TableCell className="text-right tabular-nums whitespace-nowrap">
                            {formatMoneyFull(row.cash)}
                          </TableCell>
                        ) : null}
                        {txFilter === "all" || txFilter === "cashless" ? (
                          <>
                            <TableCell className="text-right tabular-nums whitespace-nowrap">
                              {formatMoneyFull(row.card)}
                            </TableCell>
                            <TableCell className="text-right tabular-nums whitespace-nowrap">
                              {formatMoneyFull(row.online)}
                            </TableCell>
                          </>
                        ) : null}
                        <TableCell className="min-w-[160px] text-sm">
                          {isCardTx ? (
                            owner ? (
                              <div>
                                <div className="font-medium">
                                  {owner.name || "Без імені"}
                                </div>
                                {owner.phone ? (
                                  <div className="text-xs text-muted-foreground">
                                    {owner.phone}
                                  </div>
                                ) : null}
                                {owner.cardNumber ? (
                                  <div className="text-xs text-muted-foreground">
                                    № {owner.cardNumber}
                                  </div>
                                ) : null}
                              </div>
                            ) : (
                              <span className="text-muted-foreground">
                                Не знайдено
                              </span>
                            )
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {row.cardId ?? "—"}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
          {!txLoading && txRows.length > 0 ? (
            <p className="text-xs text-muted-foreground">
              Записів: {txRows.length}
            </p>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
