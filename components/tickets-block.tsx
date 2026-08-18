"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import axios from "axios";
import { toast } from "react-hot-toast";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ticketRoleLabel, type TicketThread } from "@/lib/ticket-types";

function money(n: number) {
  return `${n.toLocaleString("uk-UA", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} грн`;
}

export function TicketsBlock({
  tickets,
  basePath,
  canClose = false,
  emptyText = "Немає відкритих звернень",
  title = "Звернення",
}: {
  tickets: TicketThread[];
  basePath: string;
  canClose?: boolean;
  emptyText?: string;
  title?: string;
}) {
  if (tickets.length === 0) {
    return (
      <section className="overflow-hidden rounded-2xl border border-sky-100 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="border-b border-sky-50 bg-sky-50/60 px-4 py-3 text-sm font-medium text-sky-900 dark:border-slate-800 dark:bg-slate-900/80 dark:text-sky-200">
          {title}
        </div>
        <p className="px-4 py-8 text-center text-sm text-slate-500">{emptyText}</p>
      </section>
    );
  }

  return (
    <section className="space-y-3">
      <h3 className="text-sm font-medium text-sky-900 dark:text-sky-200">
        {title} ({tickets.length})
      </h3>
      {tickets.map((ticket) => (
        <TicketCard
          key={ticket.id}
          ticket={ticket}
          basePath={basePath}
          canClose={canClose}
        />
      ))}
    </section>
  );
}

export function TicketCard({
  ticket,
  basePath,
  canClose,
}: {
  ticket: TicketThread;
  basePath: string;
  canClose: boolean;
}) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const closed = ticket.status === "closed";

  const send = async () => {
    if (!text.trim()) {
      toast.error("Напишіть повідомлення");
      return;
    }
    try {
      setBusy(true);
      await axios.post(`${basePath}/${ticket.id}/messages`, {
        body: text.trim(),
      });
      setText("");
      toast.success("Надіслано");
      router.refresh();
    } catch (error) {
      const message =
        axios.isAxiosError(error) && typeof error.response?.data === "string"
          ? error.response.data
          : "Не вдалося надіслати";
      toast.error(message);
    } finally {
      setBusy(false);
    }
  };

  const close = async () => {
    try {
      setBusy(true);
      await axios.post(`${basePath}/${ticket.id}/close`);
      toast.success("Звернення закрито");
      router.refresh();
    } catch (error) {
      const message =
        axios.isAxiosError(error) && typeof error.response?.data === "string"
          ? error.response.data
          : "Не вдалося закрити";
      toast.error(message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="overflow-hidden rounded-2xl border border-sky-100 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="border-b border-sky-50 bg-sky-50/60 px-4 py-3 dark:border-slate-800 dark:bg-slate-900/80">
        <p className="font-medium text-slate-900 dark:text-slate-100">
          {ticket.machine}
        </p>
        <p className="text-xs text-slate-500">
          {ticket.technicianName}
          {ticket.handoverId ? ` · здача #${ticket.handoverId}` : ""}
          {" · "}
          {ticket.dateLabel} {ticket.timeLabel}
        </p>
        <p className="mt-1 text-sm tabular-nums text-slate-600 dark:text-slate-300">
          Очікувано {money(ticket.expectedSum)}
          {ticket.actualReceived != null
            ? ` · факт ${money(ticket.actualReceived)}`
            : ""}
        </p>
        {closed ? (
          <p className="mt-1 text-xs text-slate-400">
            Закрито
            {ticket.closedByName ? ` · ${ticket.closedByName}` : ""}
          </p>
        ) : null}
      </div>
      <ul className="space-y-3 px-4 py-3">
        {ticket.messages.map((m) => (
          <li key={m.id}>
            <p className="text-xs text-slate-400">
              {m.authorName} · {ticketRoleLabel(m.authorRole)} · {m.dateLabel}{" "}
              {m.timeLabel}
            </p>
            <p className="whitespace-pre-wrap text-sm text-slate-800 dark:text-slate-100">
              {m.body}
            </p>
          </li>
        ))}
      </ul>
      {!closed ? (
        <div className="space-y-2 border-t border-slate-100 px-4 py-3 dark:border-slate-800">
          <Textarea
            rows={3}
            placeholder="Відповідь…"
            value={text}
            disabled={busy}
            onChange={(e) => setText(e.target.value)}
          />
          <div className="flex flex-wrap gap-2">
            <Button size="sm" disabled={busy} onClick={() => void send()}>
              Надіслати
            </Button>
            {canClose ? (
              <Button
                size="sm"
                variant="outline"
                disabled={busy}
                onClick={() => void close()}
              >
                Закрити звернення
              </Button>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
