"use client";

import { useMemo, useState } from "react";
import axios from "axios";
import { toast } from "react-hot-toast";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import type { CollectionColumn } from "./columns";

function money(n: number) {
  return `${n.toLocaleString("uk-UA", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} грн`;
}

export function RecountCell({ data }: { data: CollectionColumn }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [actual, setActual] = useState(
    data.actualReceived != null ? String(data.actualReceived) : ""
  );

  const parsed = useMemo(() => {
    const n = parseFloat(String(actual).replace(",", ".").replace(/\s/g, ""));
    return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) / 100 : null;
  }, [actual]);

  const diff =
    parsed != null ? Math.round((data.totalValue - parsed) * 100) / 100 : null;

  const submit = async (missing: boolean) => {
    if (!missing && parsed == null) {
      toast.error("Вкажіть фактично отриману суму");
      return;
    }
    try {
      setBusy(true);
      const { data: result } = await axios.patch(
        `/api/collections/${data.id}/recount`,
        missing ? { missing: true } : { actualReceived: parsed }
      );
      if (result?.handoverClosed) {
        toast.success(
          result.missingNotified
            ? "Перерахунок здачі закрито. Керівника повідомлено про відсутні пакети."
            : "Перерахунок усіх пакетів здачі закрито."
        );
      } else {
        toast.success(missing ? "Позначено як відсутній" : "Перерахунок збережено");
      }
      setOpen(false);
      router.refresh();
    } catch (error) {
      const message =
        axios.isAxiosError(error) && typeof error.response?.data === "string"
          ? error.response.data
          : "Не вдалося зберегти перерахунок";
      toast.error(message);
    } finally {
      setBusy(false);
    }
  };

  if (data.recountStatus === "missing") {
    return (
      <span className="text-sm font-medium text-rose-700 dark:text-rose-300">
        Відсутній
      </span>
    );
  }
  if (data.recountClosed || data.recountStatus === "done") {
    return (
      <span className="text-xs text-muted-foreground">
        {data.recountClosed ? "Закрито" : "Перераховано"}
      </span>
    );
  }

  return (
    <>
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
        Перерахунок
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Перерахунок · {data.machine}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 text-sm">
            <p className="text-muted-foreground">
              {data.date} · {data.time} · {data.technicianName}
            </p>
            <div className="rounded-lg border bg-muted/40 px-3 py-2 space-y-1">
              <p>Металеві гроші — {data.sumCoins}</p>
              <p>Паперові гроші — {data.sumBanknotes}</p>
              <p className="font-medium">Загальна сума — {data.total}</p>
            </div>
            <div className="space-y-1">
              <label className="text-muted-foreground">
                Фактично отримано, грн
              </label>
              <Input
                type="number"
                min={0}
                step="0.01"
                value={actual}
                disabled={busy}
                onChange={(e) => setActual(e.target.value)}
              />
            </div>
            <p
              className={
                diff != null && diff !== 0
                  ? "font-medium text-amber-700 dark:text-amber-300"
                  : "text-muted-foreground"
              }
            >
              Різниця — {diff == null ? "—" : money(diff)}
            </p>
          </div>
          <DialogFooter className="gap-2 sm:justify-between">
            <Button
              variant="destructive"
              disabled={busy}
              onClick={() => void submit(true)}
            >
              Відсутній
            </Button>
            <div className="flex gap-2">
              <Button
                variant="ghost"
                disabled={busy}
                onClick={() => setOpen(false)}
              >
                Скасувати
              </Button>
              <Button disabled={busy} onClick={() => void submit(false)}>
                Зберегти
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
