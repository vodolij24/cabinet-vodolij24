"use client";

import { useMemo, useState } from "react";

import { TicketCard } from "@/components/tickets-block";
import type { TicketThread } from "@/lib/ticket-types";

export function TicketsClient({ tickets }: { tickets: TicketThread[] }) {
  const [tab, setTab] = useState<"open" | "closed">("open");
  const open = useMemo(
    () => tickets.filter((t) => t.status === "open"),
    [tickets]
  );
  const closed = useMemo(
    () => tickets.filter((t) => t.status === "closed"),
    [tickets]
  );
  const list = tab === "open" ? open : closed;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className={`rounded-md px-3 py-1.5 text-sm ${
            tab === "open" ? "bg-sky-700 text-white" : "bg-muted"
          }`}
          onClick={() => setTab("open")}
        >
          Відкриті ({open.length})
        </button>
        <button
          type="button"
          className={`rounded-md px-3 py-1.5 text-sm ${
            tab === "closed" ? "bg-sky-700 text-white" : "bg-muted"
          }`}
          onClick={() => setTab("closed")}
        >
          Архів ({closed.length})
        </button>
      </div>
      {list.length === 0 ? (
        <p className="rounded-md border px-4 py-8 text-center text-sm text-muted-foreground">
          {tab === "open" ? "Немає відкритих звернень" : "Архів порожній"}
        </p>
      ) : (
        <div className="space-y-3">
          {list.map((ticket) => (
            <TicketCard
              key={ticket.id}
              ticket={ticket}
              basePath="/api/tickets"
              canClose={false}
            />
          ))}
        </div>
      )}
    </div>
  );
}
