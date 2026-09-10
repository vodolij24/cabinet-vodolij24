"use client";

import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { toast } from "react-hot-toast";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { CollectionCommentsThread } from "@/components/collection-comments";
import type {
  CollectionCommentDto,
  CollectionStatusEventDto,
  ReviewQueueItem,
} from "@/lib/collection-lifecycle";
import { COLLECTION_ISSUE_LABEL } from "@/lib/collection-status";

function money(n: number) {
  return `${n.toLocaleString("uk-UA", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} грн`;
}

function ReviewCardBody({
  collectionId,
  busy,
  reason,
  onReasonChange,
  onClose,
}: {
  collectionId: number;
  busy: boolean;
  reason: string;
  onReasonChange: (value: string) => void;
  onClose: () => void;
}) {
  const [comments, setComments] = useState<CollectionCommentDto[] | null>(null);
  const [events, setEvents] = useState<CollectionStatusEventDto[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    axios
      .get<{
        comments: CollectionCommentDto[];
        events: CollectionStatusEventDto[];
      }>(`/api/collections/${collectionId}/thread`)
      .then(({ data }) => {
        if (cancelled) return;
        setComments(data.comments ?? []);
        setEvents(data.events ?? []);
      })
      .catch(() => {
        if (cancelled) return;
        setComments([]);
        setEvents([]);
        toast.error("Не вдалося завантажити картку");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [collectionId]);

  if (loading || comments == null) {
    return (
      <div className="mt-4 space-y-3 border-t pt-4" aria-busy="true">
        <div className="h-4 w-40 animate-pulse rounded bg-muted" />
        <div className="h-16 w-full animate-pulse rounded bg-muted" />
        <div className="h-4 w-32 animate-pulse rounded bg-muted" />
      </div>
    );
  }

  return (
    <div className="mt-4 space-y-4 border-t pt-4">
      <div>
        <p className="mb-2 text-sm font-medium">Коментарі</p>
        <CollectionCommentsThread
          endpoint={`/api/collections/${collectionId}/thread`}
          initial={comments}
        />
      </div>
      <div>
        <p className="mb-2 text-sm font-medium">Журнал статусів</p>
        {events.length === 0 ? (
          <p className="text-sm text-muted-foreground">Поки порожньо</p>
        ) : (
          <ul className="space-y-1 text-sm">
            {events.map((e) => (
              <li key={e.id}>
                {e.dateLabel} {e.timeLabel} · {e.actorName}: {e.fromLabel} →{" "}
                {e.toLabel}
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className="space-y-2">
        <p className="text-sm font-medium">Ручне закриття</p>
        <Textarea
          rows={3}
          placeholder="Причина (помилка купюроприймача, фальшива купюра, підтверджений фантом…)"
          value={reason}
          disabled={busy}
          onChange={(e) => onReasonChange(e.target.value)}
        />
        <Button size="sm" disabled={busy} onClick={onClose}>
          Закрити вручну
        </Button>
      </div>
    </div>
  );
}

export function ReviewQueue({
  items,
  technicians,
}: {
  items: ReviewQueueItem[];
  technicians: { id: number; name: string }[];
}) {
  const router = useRouter();
  const [tech, setTech] = useState("all");
  const [issue, setIssue] = useState("all");
  const [openId, setOpenId] = useState<number | null>(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  const filtered = useMemo(() => {
    return items.filter((item) => {
      if (tech !== "all" && String(item.technicianId) !== tech) return false;
      if (issue !== "all" && item.issueType !== issue) return false;
      return true;
    });
  }, [items, tech, issue]);

  const close = async (id: number) => {
    if (!reason.trim()) {
      toast.error("Вкажіть причину закриття");
      return;
    }
    try {
      setBusy(true);
      await axios.post(`/api/collections/${id}/thread`, {
        action: "close",
        reason: reason.trim(),
      });
      toast.success("Закрито вручну");
      setReason("");
      setOpenId(null);
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

  const claim = async (id: number) => {
    try {
      setBusy(true);
      await axios.post(`/api/collections/${id}/thread`, { action: "claim" });
      toast.success("Взято в роботу");
      router.refresh();
    } catch (error) {
      const message =
        axios.isAxiosError(error) && typeof error.response?.data === "string"
          ? error.response.data
          : "Не вдалося взяти в роботу";
      toast.error(message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <label className="text-sm text-muted-foreground">Технік</label>
          <select
            className="h-10 rounded-md border bg-background px-3 text-sm"
            value={tech}
            onChange={(e) => setTech(e.target.value)}
          >
            <option value="all">Усі</option>
            {technicians.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <label className="text-sm text-muted-foreground">Тип</label>
          <select
            className="h-10 rounded-md border bg-background px-3 text-sm"
            value={issue}
            onChange={(e) => setIssue(e.target.value)}
          >
            <option value="all">Усі</option>
            {Object.entries(COLLECTION_ISSUE_LABEL).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <p className="pb-2 text-sm text-muted-foreground">
          {filtered.length} з {items.length}
        </p>
      </div>

      {filtered.length === 0 ? (
        <p className="rounded-xl border px-4 py-8 text-center text-sm text-muted-foreground">
          Черга порожня
        </p>
      ) : (
        <ul className="space-y-3">
          {filtered.map((item) => {
            const open = openId === item.id;
            return (
              <li key={item.id} className="rounded-xl border bg-card p-4 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-medium">{item.machine}</p>
                    <p className="text-sm text-muted-foreground">
                      {item.technicianName} · {item.dateLabel} {item.timeLabel}
                    </p>
                    <p className="mt-1 text-sm">
                      {item.issueLabel}
                      {item.claimedBy ? ` · в роботі: ${item.claimedBy}` : ""}
                    </p>
                  </div>
                  <div className="text-right text-sm tabular-nums">
                    <p>База {money(item.expected)}</p>
                    <p>
                      Факт{" "}
                      {item.missing
                        ? "відсутній"
                        : item.actualReceived == null
                          ? "—"
                          : money(item.actualReceived)}
                    </p>
                    <p>
                      Δ{" "}
                      {item.deltaUah == null
                        ? "—"
                        : `${money(item.deltaUah)}${
                            item.deltaPct != null ? ` · ${item.deltaPct}%` : ""
                          }`}
                    </p>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setOpenId(open ? null : item.id)}
                  >
                    {open ? "Згорнути" : "Картка"}
                  </Button>
                  {!item.claimedBy ? (
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={busy}
                      onClick={() => void claim(item.id)}
                    >
                      Взяти в роботу
                    </Button>
                  ) : null}
                </div>
                {open ? (
                  <ReviewCardBody
                    collectionId={item.id}
                    busy={busy}
                    reason={reason}
                    onReasonChange={setReason}
                    onClose={() => void close(item.id)}
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
