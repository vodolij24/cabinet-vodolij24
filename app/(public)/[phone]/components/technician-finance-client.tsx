"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import axios from "axios";
import { toast } from "react-hot-toast";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type {
  FinanceExpenseEntry,
  FinanceTechnicianRow,
} from "@/lib/finance-month";

const MAX_PHOTOS = 5;

function money(n: number) {
  return `${n.toLocaleString("uk-UA")} грн`;
}

function PhotoGrid({ urls }: { urls: string[] }) {
  if (urls.length === 0) return null;
  return (
    <div className="mt-2 flex flex-wrap gap-2">
      {urls.map((url) => (
        <a
          key={url}
          href={url}
          target="_blank"
          rel="noreferrer"
          className="block overflow-hidden rounded-md border border-slate-200 dark:border-slate-700"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={url} alt="Фото витрати" className="h-16 w-16 object-cover" />
        </a>
      ))}
    </div>
  );
}

export function TechnicianFinanceClient({
  phone,
  periodKey,
  monthLabel,
  initial,
  section = "main",
}: {
  phone: string;
  periodKey: string;
  monthLabel: string;
  initial: FinanceTechnicianRow;
  /** main = ЗП + нова витрата; archive = архів витрат (під архівом задач) */
  section?: "main" | "archive";
}) {
  const router = useRouter();
  const [finance, setFinance] = useState(initial);
  const [creating, setCreating] = useState(false);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [type, setType] = useState<"fuel" | "other">("fuel");
  const [amount, setAmount] = useState("");
  const [comment, setComment] = useState("");
  const [photos, setPhotos] = useState<File[]>([]);

  useEffect(() => {
    setFinance(initial);
  }, [initial]);

  const resetForm = () => {
    setType("fuel");
    setAmount("");
    setComment("");
    setPhotos([]);
    setCreating(false);
  };

  const onSubmit = async () => {
    if (!amount.trim() || !/^\d+$/.test(amount.trim()) || Number(amount) <= 0) {
      toast.error("Вкажіть суму більше 0");
      return;
    }
    try {
      setBusy(true);
      const form = new FormData();
      form.append("periodKey", periodKey);
      form.append("type", type);
      form.append("amount", amount.trim());
      form.append("comment", comment.trim());
      for (const file of photos) {
        form.append("photos", file);
      }

      const { data } = await axios.post(
        `/api/public/technician/${phone}/finance`,
        form
      );
      if (data?.finance) {
        setFinance(data.finance);
      }
      toast.success("Витрату додано в баланс");
      resetForm();
      router.refresh();
    } catch (error) {
      const msg = axios.isAxiosError(error)
        ? error.response?.data || "Помилка"
        : "Помилка";
      toast.error(typeof msg === "string" ? msg : "Помилка");
    } finally {
      setBusy(false);
    }
  };

  if (section === "archive") {
    return (
      <section className="mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <button
          type="button"
          className="flex w-full items-center justify-between border-b border-slate-100 bg-slate-50 px-4 py-3 text-left text-sm font-medium text-slate-800 dark:border-slate-800 dark:bg-slate-900/80 dark:text-slate-200"
          onClick={() => setArchiveOpen((v) => !v)}
        >
          <span>Архів витрат ({finance.entries.length})</span>
          <span className="text-xs text-slate-500">
            {archiveOpen ? "Згорнути" : "Розгорнути"}
          </span>
        </button>
        {archiveOpen ? (
          finance.entries.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-slate-500">
              Архів порожній
            </p>
          ) : (
            <ul className="divide-y divide-slate-100 dark:divide-slate-800">
              {finance.entries.map((entry: FinanceExpenseEntry) => (
                <li key={entry.id} className="px-4 py-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="font-medium text-slate-900 dark:text-slate-100">
                        {entry.typeLabel}
                      </p>
                      {entry.comment ? (
                        <p className="mt-1 text-sm text-slate-500">
                          {entry.comment}
                        </p>
                      ) : null}
                      <p className="mt-1 text-xs text-slate-400">
                        {entry.createdAt}
                      </p>
                      <PhotoGrid urls={entry.photoUrls} />
                    </div>
                    <p className="text-lg font-semibold tabular-nums text-sky-800 dark:text-sky-300">
                      {money(entry.amount)}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )
        ) : null}
      </section>
    );
  }

  return (
    <div className="mb-6 space-y-6">
      <section className="overflow-hidden rounded-2xl border border-sky-100 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="border-b border-sky-50 bg-sky-50/60 px-4 py-3 text-sm font-medium text-sky-900 dark:border-slate-800 dark:bg-slate-900/80 dark:text-sky-200">
          Очікувана ЗП · {monthLabel}
        </div>
        <div className="space-y-3 px-4 py-4">
          <p className="text-3xl font-bold tabular-nums text-sky-800 dark:text-sky-300">
            {money(finance.payoutTotal)}
          </p>
          <ul className="space-y-2 text-sm text-slate-600 dark:text-slate-300">
            <li className="flex justify-between gap-3">
              <span>Автоматів</span>
              <span className="tabular-nums font-medium text-slate-900 dark:text-slate-100">
                {finance.machinesCount}
              </span>
            </li>
            <li className="flex justify-between gap-3">
              <span>Базова ЗП ({finance.machinesCount} × 300)</span>
              <span className="tabular-nums">{money(finance.baseSalary)}</span>
            </li>
            <li className="flex justify-between gap-3">
              <span>
                Премія (сер. {finance.avgNetworkLiters.toLocaleString("uk-UA")}{" "}
                л × 0,07)
              </span>
              <span className="tabular-nums">
                {money(finance.performanceBonus)}
              </span>
            </li>
            <li className="flex justify-between gap-3">
              <span>Ручні премії</span>
              <span className="tabular-nums">
                {money(finance.manualBonuses ?? 0)}
              </span>
            </li>
            <li className="flex justify-between gap-3">
              <span>Утримання із ЗП</span>
              <span className="tabular-nums text-rose-700 dark:text-rose-300">
                −{money(finance.deductions)}
              </span>
            </li>
            <li className="flex justify-between gap-3">
              <span>Паливо (транзакції)</span>
              <span className="tabular-nums text-emerald-700 dark:text-emerald-300">
                +{money(finance.fuelAmount)}
              </span>
            </li>
            <li className="flex justify-between gap-3">
              <span>Інші витрати (транзакції)</span>
              <span className="tabular-nums text-emerald-700 dark:text-emerald-300">
                +{money(finance.otherAmount)}
              </span>
            </li>
          </ul>
          <p className="text-xs text-slate-400">
            Підсумок = база + премія + ручні − утримання + витрати. Після
            створення витрату змінити не можна.
          </p>
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl border border-sky-100 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center justify-between border-b border-sky-50 bg-sky-50/60 px-4 py-3 dark:border-slate-800 dark:bg-slate-900/80">
          <span className="text-sm font-medium text-sky-900 dark:text-sky-200">
            Нова витрата
          </span>
          {!creating ? (
            <Button size="sm" onClick={() => setCreating(true)}>
              Додати
            </Button>
          ) : null}
        </div>

        {creating ? (
          <div className="space-y-3 px-4 py-4">
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant={type === "fuel" ? "default" : "outline"}
                disabled={busy}
                onClick={() => setType("fuel")}
              >
                Паливо
              </Button>
              <Button
                size="sm"
                variant={type === "other" ? "default" : "outline"}
                disabled={busy}
                onClick={() => setType("other")}
              >
                Інші витрати
              </Button>
            </div>
            <Input
              inputMode="numeric"
              disabled={busy}
              value={amount}
              placeholder="Сума, грн"
              onChange={(e) => setAmount(e.target.value)}
            />
            <Input
              disabled={busy}
              value={comment}
              placeholder={
                type === "fuel"
                  ? "Коментар (напр. обслужено 120 автоматів)"
                  : "Матеріали, парковка, мийка…"
              }
              onChange={(e) => setComment(e.target.value)}
            />
            <div className="space-y-1">
              <Input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                multiple
                disabled={busy}
                onChange={(e) =>
                  setPhotos(
                    Array.from(e.target.files || []).slice(0, MAX_PHOTOS)
                  )
                }
              />
              <p className="text-xs text-slate-400">
                Фото опційно, до {MAX_PHOTOS}
                {photos.length ? ` · обрано: ${photos.length}` : ""}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button disabled={busy} onClick={onSubmit}>
                Зберегти транзакцію
              </Button>
              <Button variant="ghost" disabled={busy} onClick={resetForm}>
                Скасувати
              </Button>
            </div>
          </div>
        ) : (
          <p className="px-4 py-4 text-sm text-slate-500">
            Оберіть «Паливо» або «Інші витрати» — після збереження запис піде в
            архів (внизу сторінки) і в баланс без можливості редагування.
          </p>
        )}
      </section>
    </div>
  );
}
