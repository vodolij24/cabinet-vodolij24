"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import axios from "axios";
import { toast } from "react-hot-toast";

import { Button } from "@/components/ui/button";

export function SolitonRefreshButton({
  lastSyncAt,
}: {
  lastSyncAt?: string | null;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  const onSync = async () => {
    try {
      setBusy(true);
      const { data } = await axios.post("/api/machines/sync");
      toast.success(
        `Soliton: ${data.total} · нових ${data.created} · оновлено ${data.updated}` +
          (data.metrics
            ? ` · метрики ${data.metrics.updated}/${data.metrics.total}`
            : "")
      );
      router.refresh();
    } catch {
      toast.error("Не вдалося оновити Soliton");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex shrink-0 flex-col items-end gap-1">
      <Button
        size="sm"
        variant="outline"
        disabled={busy}
        onClick={() => void onSync()}
      >
        {busy ? "Оновлення…" : "Оновити Soliton"}
      </Button>
      {lastSyncAt ? (
        <span className="text-[11px] text-muted-foreground">
          кеш {lastSyncAt}
        </span>
      ) : (
        <span className="text-[11px] text-muted-foreground">кеш порожній</span>
      )}
    </div>
  );
}
