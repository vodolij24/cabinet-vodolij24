"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import axios from "axios";
import { toast } from "react-hot-toast";
import { Check, Plus } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { kyivDateInputValue } from "@/lib/kyiv-date";
import {
  PAYMENT_CATEGORIES,
  PAYMENT_DUE_GROUPS,
  PAYMENT_FUND_SOURCES,
  PAYMENT_PRIORITIES,
  PAYMENT_STATUSES,
  paymentDueGroup,
  summarizePayments,
  type PaymentRequestView,
} from "@/lib/payment-requests-shared";

function money(n: number) {
  return `${n.toLocaleString("uk-UA")} грн`;
}

const STATUS_BADGE: Record<string, string> = {
  pending:
    "border-transparent bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200",
  approved:
    "border-transparent bg-sky-100 text-sky-800 dark:bg-sky-900/60 dark:text-sky-200",
  paid: "border-transparent bg-emerald-600 text-white",
  partial: "border-transparent bg-teal-600 text-white",
  cancelled:
    "border-transparent bg-slate-400 text-white dark:bg-slate-600",
  overdue: "border-transparent bg-rose-600 text-white",
};

const PRIORITY_BADGE: Record<string, string> = {
  urgent: "border-transparent bg-rose-600 text-white",
  normal:
    "border-transparent bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200",
  low: "border-transparent bg-slate-100 text-slate-500",
};

function SummaryCard({
  label,
  value,
  hint,
  emphasize,
}: {
  label: string;
  value: string;
  hint?: string;
  emphasize?: "danger" | "success";
}) {
  return (
    <div className="rounded-xl border bg-card px-4 py-3 shadow-sm">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p
        className={
          emphasize === "danger"
            ? "mt-1 text-xl font-semibold tabular-nums text-rose-700 dark:text-rose-300"
            : emphasize === "success"
              ? "mt-1 text-xl font-semibold tabular-nums text-emerald-700 dark:text-emerald-300"
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

export function PaymentsClient({
  initialItems,
}: {
  initialItems: PaymentRequestView[];
}) {
  const router = useRouter();
  const [items, setItems] = useState(initialItems);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [createOpen, setCreateOpen] = useState(false);
  const [payOpen, setPayOpen] = useState<PaymentRequestView | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);

  const [form, setForm] = useState({
    title: "",
    amount: "",
    dueDate: kyivDateInputValue(new Date()),
    priority: "normal",
    category: "other",
    fundSource: "",
    fundSourceNote: "",
    description: "",
  });

  const [payForm, setPayForm] = useState({
    paidAmount: "",
    paidByName: "",
    paidAt: kyivDateInputValue(new Date()),
  });

  const summary = useMemo(() => summarizePayments(items), [items]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter((item) => {
      if (statusFilter !== "all" && item.effectiveStatus !== statusFilter) {
        return false;
      }
      if (priorityFilter !== "all" && item.priority !== priorityFilter) {
        return false;
      }
      if (!q) return true;
      return (
        item.title.toLowerCase().includes(q) ||
        item.authorName.toLowerCase().includes(q) ||
        (item.paidByName || "").toLowerCase().includes(q) ||
        item.description?.toLowerCase().includes(q)
      );
    });
  }, [items, query, statusFilter, priorityFilter]);

  const grouped = useMemo(() => {
    const map = new Map<string, PaymentRequestView[]>();
    for (const group of PAYMENT_DUE_GROUPS) {
      map.set(group.value, []);
    }
    for (const item of filtered) {
      const key = paymentDueGroup(item);
      map.get(key)?.push(item);
    }
    return PAYMENT_DUE_GROUPS.map((g) => ({
      ...g,
      items: map.get(g.value) || [],
    })).filter((g) => g.items.length > 0);
  }, [filtered]);

  const refresh = async () => {
    const { data } = await axios.get<{ items: PaymentRequestView[] }>(
      "/api/payments"
    );
    setItems(data.items);
    router.refresh();
  };

  const patch = async (
    id: number,
    body: Record<string, unknown>,
    success: string
  ) => {
    try {
      setBusyId(id);
      await axios.patch(`/api/payments/${id}`, body);
      toast.success(success);
      await refresh();
    } catch (error) {
      const message =
        axios.isAxiosError(error) && typeof error.response?.data === "string"
          ? error.response.data
          : "Помилка збереження";
      toast.error(message);
    } finally {
      setBusyId(null);
    }
  };

  const createRequest = async () => {
    if (!form.title.trim()) {
      toast.error("Вкажіть назву");
      return;
    }
    try {
      setBusyId(-1);
      await axios.post("/api/payments", {
        title: form.title.trim(),
        amount: form.amount,
        dueDate: form.dueDate,
        priority: form.priority,
        category: form.category,
        fundSource: form.fundSource || undefined,
        fundSourceNote: form.fundSourceNote || undefined,
        description: form.description || undefined,
      });
      toast.success("Заявку створено");
      setCreateOpen(false);
      setForm({
        title: "",
        amount: "",
        dueDate: kyivDateInputValue(new Date()),
        priority: "normal",
        category: "other",
        fundSource: "",
        fundSourceNote: "",
        description: "",
      });
      await refresh();
    } catch (error) {
      const message =
        axios.isAxiosError(error) && typeof error.response?.data === "string"
          ? error.response.data
          : "Не вдалося створити заявку";
      toast.error(message);
    } finally {
      setBusyId(null);
    }
  };

  const openPayDialog = (item: PaymentRequestView) => {
    setPayForm({
      paidAmount: String(item.amount),
      paidByName: "",
      paidAt: kyivDateInputValue(new Date()),
    });
    setPayOpen(item);
  };

  const submitPay = async () => {
    if (!payOpen) return;
    await patch(
      payOpen.id,
      {
        action: "mark_paid",
        paidAmount: payForm.paidAmount,
        paidByName: payForm.paidByName || undefined,
        paidAt: payForm.paidAt,
      },
      "Оплату зафіксовано"
    );
    setPayOpen(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Замість чату оплат — єдиний список заявок зі статусами.
        </p>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Створити заявку
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard
          label="До сплати цього тижня"
          value={String(summary.dueThisWeek)}
          hint={money(summary.dueThisWeekAmount)}
        />
        <SummaryCard
          label="Прострочено"
          value={String(summary.overdueCount)}
          hint={money(summary.overdueAmount)}
          emphasize={summary.overdueCount > 0 ? "danger" : undefined}
        />
        <SummaryCard
          label="Оплачено за місяць"
          value={String(summary.paidThisMonth)}
          hint={money(summary.paidThisMonthAmount)}
          emphasize="success"
        />
        <SummaryCard
          label="Не враховано"
          value={String(summary.unaccountedCount)}
          emphasize={summary.unaccountedCount > 0 ? "danger" : undefined}
        />
      </div>

      <div className="flex flex-wrap gap-3">
        <Input
          className="max-w-xs"
          placeholder="Пошук за назвою, автором…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Статус" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Усі статуси</SelectItem>
            {PAYMENT_STATUSES.map((s) => (
              <SelectItem key={s.value} value={s.value}>
                {s.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={priorityFilter} onValueChange={setPriorityFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Пріоритет" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Усі пріоритети</SelectItem>
            {PAYMENT_PRIORITIES.map((p) => (
              <SelectItem key={p.value} value={p.value}>
                {p.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {grouped.length === 0 ? (
        <p className="rounded-xl border bg-card px-4 py-12 text-center text-sm text-muted-foreground">
          Немає заявок за обраними фільтрами
        </p>
      ) : (
        grouped.map((group) => (
          <section key={group.value} className="space-y-3">
            <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">
              {group.label} ({group.items.length})
            </h3>
            <ul className="space-y-3">
              {group.items.map((item) => {
                const busy = busyId === item.id;
                const open =
                  item.status !== "paid" &&
                  item.status !== "cancelled" &&
                  item.status !== "partial";
                return (
                  <li
                    key={item.id}
                    className="rounded-xl border bg-card p-4 shadow-sm"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-medium">{item.title}</p>
                          <Badge
                            className={
                              STATUS_BADGE[item.effectiveStatus] ||
                              STATUS_BADGE.pending
                            }
                          >
                            {item.effectiveStatusLabel}
                          </Badge>
                          <Badge
                            className={
                              PRIORITY_BADGE[item.priority] ||
                              PRIORITY_BADGE.normal
                            }
                          >
                            {item.priorityLabel}
                          </Badge>
                          {item.accounted ? (
                            <Badge className="border-transparent bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200">
                              <Check className="mr-1 h-3 w-3" />
                              Враховано
                            </Badge>
                          ) : null}
                        </div>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {item.categoryLabel} · до {item.dueDateLabel} ·{" "}
                          {money(item.amount)}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          Створив: {item.authorName}
                          {item.fundSource
                            ? ` · Джерело: ${item.fundSourceLabel}${
                                item.fundSourceNote
                                  ? ` (${item.fundSourceNote})`
                                  : ""
                              }`
                            : ""}
                        </p>
                        {item.description ? (
                          <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                            {item.description}
                          </p>
                        ) : null}
                        {item.paidByName ? (
                          <p className="mt-2 text-sm text-emerald-700 dark:text-emerald-300">
                            Оплатив: {item.paidByName}
                            {item.paidAmount != null
                              ? ` · ${money(item.paidAmount)}`
                              : ""}
                          </p>
                        ) : null}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {item.status === "pending" ? (
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={busy}
                            onClick={() =>
                              void patch(
                                item.id,
                                { action: "approve" },
                                "Заявку погоджено"
                              )
                            }
                          >
                            Погодити
                          </Button>
                        ) : null}
                        {open ? (
                          <Button
                            size="sm"
                            disabled={busy}
                            onClick={() => openPayDialog(item)}
                          >
                            Оплачено
                          </Button>
                        ) : null}
                        {(item.status === "paid" ||
                          item.status === "partial") &&
                        !item.accounted ? (
                          <Button
                            size="sm"
                            variant="secondary"
                            disabled={busy}
                            onClick={() =>
                              void patch(
                                item.id,
                                { action: "toggle_accounted", accounted: true },
                                "Позначено як враховано"
                              )
                            }
                          >
                            Врахувати
                          </Button>
                        ) : null}
                        {item.accounted ? (
                          <Button
                            size="sm"
                            variant="ghost"
                            disabled={busy}
                            onClick={() =>
                              void patch(
                                item.id,
                                { action: "toggle_accounted", accounted: false },
                                "Знято позначку враховано"
                              )
                            }
                          >
                            Скас. врах.
                          </Button>
                        ) : null}
                        {open ? (
                          <Button
                            size="sm"
                            variant="destructive"
                            disabled={busy}
                            onClick={() =>
                              void patch(
                                item.id,
                                { action: "cancel" },
                                "Заявку скасовано"
                              )
                            }
                          >
                            Скасувати
                          </Button>
                        ) : null}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        ))
      )}

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Нова заявка на оплату</DialogTitle>
            <DialogDescription>
              Зафіксуйте платіж, щоб не загубився в чаті.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <label className="text-sm text-muted-foreground">Назва</label>
              <Input
                value={form.title}
                onChange={(e) =>
                  setForm((f) => ({ ...f, title: e.target.value }))
                }
                placeholder="Оренда, постачальник…"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-sm text-muted-foreground">Сума, грн</label>
                <Input
                  type="number"
                  min={1}
                  step={1}
                  value={form.amount}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, amount: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm text-muted-foreground">
                  Дата оплати
                </label>
                <Input
                  type="date"
                  value={form.dueDate}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, dueDate: e.target.value }))
                  }
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-sm text-muted-foreground">Категорія</label>
                <Select
                  value={form.category}
                  onValueChange={(v) =>
                    setForm((f) => ({ ...f, category: v }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PAYMENT_CATEGORIES.map((c) => (
                      <SelectItem key={c.value} value={c.value}>
                        {c.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <label className="text-sm text-muted-foreground">Пріоритет</label>
                <Select
                  value={form.priority}
                  onValueChange={(v) =>
                    setForm((f) => ({ ...f, priority: v }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PAYMENT_PRIORITIES.map((p) => (
                      <SelectItem key={p.value} value={p.value}>
                        {p.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-sm text-muted-foreground">
                  Джерело коштів
                </label>
                <Select
                  value={form.fundSource || "none"}
                  onValueChange={(v) =>
                    setForm((f) => ({
                      ...f,
                      fundSource: v === "none" ? "" : v,
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Не вказано" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Не вказано</SelectItem>
                    {PAYMENT_FUND_SOURCES.map((s) => (
                      <SelectItem key={s.value} value={s.value}>
                        {s.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <label className="text-sm text-muted-foreground">
                  Коментар до джерела
                </label>
                <Input
                  value={form.fundSourceNote}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, fundSourceNote: e.target.value }))
                  }
                  placeholder="Рахунок, каса…"
                />
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-sm text-muted-foreground">Коментар</label>
              <Textarea
                value={form.description}
                onChange={(e) =>
                  setForm((f) => ({ ...f, description: e.target.value }))
                }
                rows={3}
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setCreateOpen(false)}>
                Скасувати
              </Button>
              <Button
                disabled={busyId === -1}
                onClick={() => void createRequest()}
              >
                Створити
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!payOpen} onOpenChange={(o) => !o && setPayOpen(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Зафіксувати оплату</DialogTitle>
            <DialogDescription>{payOpen?.title}</DialogDescription>
          </DialogHeader>
          {payOpen ? (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Очікується: {money(payOpen.amount)}
              </p>
              <div className="space-y-1">
                <label className="text-sm text-muted-foreground">
                  Фактично сплачено, грн
                </label>
                <Input
                  type="number"
                  min={0}
                  step={1}
                  value={payForm.paidAmount}
                  onChange={(e) =>
                    setPayForm((f) => ({ ...f, paidAmount: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm text-muted-foreground">
                  Хто оплатив
                </label>
                <Input
                  value={payForm.paidByName}
                  onChange={(e) =>
                    setPayForm((f) => ({ ...f, paidByName: e.target.value }))
                  }
                  placeholder="Імʼя"
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm text-muted-foreground">
                  Дата оплати
                </label>
                <Input
                  type="date"
                  value={payForm.paidAt}
                  onChange={(e) =>
                    setPayForm((f) => ({ ...f, paidAt: e.target.value }))
                  }
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => setPayOpen(null)}>
                  Скасувати
                </Button>
                <Button
                  disabled={busyId === payOpen.id}
                  onClick={() => void submitPay()}
                >
                  Зберегти
                </Button>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
