"use client";

import { useEffect, useState } from "react";
import axios from "axios";
import { toast } from "react-hot-toast";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { CollectionCommentDto } from "@/lib/collection-lifecycle";

const ROLE_LABEL: Record<string, string> = {
  technician: "Технік",
  cashier: "Касир",
  reconciler: "Звіряльник",
  manager: "Керівник",
  system: "Система",
};

export function CollectionCommentsThread({
  endpoint,
  initial,
  compact,
}: {
  endpoint: string;
  initial?: CollectionCommentDto[];
  compact?: boolean;
}) {
  const [comments, setComments] = useState<CollectionCommentDto[]>(
    initial ?? []
  );
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(Boolean(initial));

  useEffect(() => {
    if (initial) {
      setComments(initial);
      setLoaded(true);
    }
  }, [initial]);

  useEffect(() => {
    if (initial) return;
    let cancelled = false;
    axios
      .get<{ comments: CollectionCommentDto[] }>(endpoint)
      .then(({ data }) => {
        if (!cancelled) {
          setComments(data.comments ?? []);
          setLoaded(true);
        }
      })
      .catch(() => {
        if (!cancelled) setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, [endpoint, initial]);

  const submit = async () => {
    if (!body.trim()) {
      toast.error("Напишіть коментар");
      return;
    }
    try {
      setBusy(true);
      const { data } = await axios.post<{ comment: CollectionCommentDto }>(
        endpoint,
        { body: body.trim() }
      );
      if (data?.comment) {
        setComments((prev) => [...prev, data.comment]);
      }
      setBody("");
      toast.success("Коментар додано");
    } catch (error) {
      const message =
        axios.isAxiosError(error) && typeof error.response?.data === "string"
          ? error.response.data
          : "Не вдалося зберегти коментар";
      toast.error(message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={compact ? "space-y-2" : "space-y-3"}>
      {loaded && comments.length === 0 ? (
        <p className="text-xs text-slate-400">Коментарів ще немає</p>
      ) : (
        <ul className="space-y-2">
          {comments.map((c) => (
            <li
              key={c.id}
              className="rounded-lg bg-slate-50 px-3 py-2 text-sm dark:bg-slate-800/60"
            >
              <p className="text-xs text-slate-500">
                {ROLE_LABEL[c.authorRole] || c.authorRole} · {c.authorName} ·{" "}
                {c.dateLabel} {c.timeLabel}
              </p>
              <p className="mt-1 whitespace-pre-wrap text-slate-800 dark:text-slate-100">
                {c.body}
              </p>
            </li>
          ))}
        </ul>
      )}
      <Textarea
        rows={compact ? 2 : 3}
        placeholder="Коментар…"
        value={body}
        disabled={busy}
        onChange={(e) => setBody(e.target.value)}
      />
      <Button size="sm" disabled={busy} onClick={() => void submit()}>
        Надіслати
      </Button>
    </div>
  );
}
