import { decimalToNumber } from "@/lib/collection-fields";
import { roundMoney } from "@/lib/collection-sql";

export const COLLECTION_STATUSES = [
  "on_hand",
  "handed",
  "accepted",
  "closed_auto",
  "review",
  "closed_manual",
] as const;

export type CollectionStatus = (typeof COLLECTION_STATUSES)[number];

export const COLLECTION_STATUS_LABEL: Record<CollectionStatus, string> = {
  on_hand: "На руках",
  handed: "Передана касиру",
  accepted: "Прийнята касиром",
  closed_auto: "Закрита (авто)",
  review: "На розгляді",
  closed_manual: "Закрита (ручно)",
};

export type CollectionActorRole =
  | "system"
  | "technician"
  | "cashier"
  | "reconciler"
  | "manager";

export type CollectionActor = {
  role: CollectionActorRole;
  id?: string | number | null;
  name: string;
};

export type CollectionIssueType =
  | "phantom"
  | "manual"
  | "missing"
  | "no_device"
  | "zero_base"
  | "delta";

export const COLLECTION_ISSUE_LABEL: Record<CollectionIssueType, string> = {
  phantom: "Фантом",
  manual: "Ручне введення",
  missing: "Відсутній пакет",
  no_device: "Немає даних апарата",
  zero_base: "Нульова база",
  delta: "Розліт суми",
};

export function isCollectionStatus(value: unknown): value is CollectionStatus {
  return (
    typeof value === "string" &&
    (COLLECTION_STATUSES as readonly string[]).includes(value)
  );
}

export function collectionStatusLabel(status: string | null | undefined) {
  if (isCollectionStatus(status)) return COLLECTION_STATUS_LABEL[status];
  return status?.trim() || "—";
}

export function actorIdString(actor: CollectionActor) {
  if (actor.id == null) return null;
  return String(actor.id);
}

/** Поріг відносної Δ, %. Env COLLECTION_DELTA_PERCENT, default 2. */
export function collectionDeltaThresholdPct() {
  const raw = Number(process.env.COLLECTION_DELTA_PERCENT);
  if (Number.isFinite(raw) && raw >= 0) return raw;
  return 2;
}

export function expectedCollectionSum(row: {
  total_sum?: unknown;
  sum_coins?: unknown;
  sum_banknotes?: unknown;
}) {
  const total = decimalToNumber(row.total_sum);
  if (total > 0) return roundMoney(total);
  return roundMoney(
    decimalToNumber(row.sum_coins) + decimalToNumber(row.sum_banknotes)
  );
}

export type DeltaDecision = {
  deltaUah: number;
  deltaPct: number | null;
  nextStatus: Extract<CollectionStatus, "closed_auto" | "review">;
  issueType: CollectionIssueType | null;
};

export function decideAfterFact(input: {
  expected: number;
  actual: number;
  isPhantom?: boolean;
  isManual?: boolean;
  noDeviceData?: boolean;
  missing?: boolean;
  thresholdPct?: number;
}): DeltaDecision {
  const expected = roundMoney(input.expected);
  const actual = roundMoney(input.actual);
  const deltaUah = roundMoney(actual - expected);
  const absUah = Math.abs(deltaUah);
  const threshold = input.thresholdPct ?? collectionDeltaThresholdPct();

  if (input.missing) {
    return {
      deltaUah: roundMoney(-expected),
      deltaPct: expected > 0 ? 100 : null,
      nextStatus: "review",
      issueType: "missing",
    };
  }
  if (input.isPhantom) {
    return {
      deltaUah,
      deltaPct: expected > 0 ? roundMoney((absUah / expected) * 100) : null,
      nextStatus: "review",
      issueType: "phantom",
    };
  }
  if (input.isManual || input.noDeviceData) {
    return {
      deltaUah,
      deltaPct: expected > 0 ? roundMoney((absUah / expected) * 100) : null,
      nextStatus: "review",
      issueType: input.noDeviceData ? "no_device" : "manual",
    };
  }
  if (expected <= 0) {
    return {
      deltaUah,
      deltaPct: null,
      nextStatus: "review",
      issueType: "zero_base",
    };
  }

  const deltaPct = roundMoney((absUah / expected) * 100);
  if (deltaPct <= threshold) {
    return {
      deltaUah,
      deltaPct,
      nextStatus: "closed_auto",
      issueType: null,
    };
  }
  return {
    deltaUah,
    deltaPct,
    nextStatus: "review",
    issueType: "delta",
  };
}

export function collectionIssueType(row: {
  isPhantom?: boolean;
  isManual?: boolean;
  noDeviceData?: boolean;
  recountStatus?: string | null;
  expected?: number;
  actual?: number | null;
}): CollectionIssueType | null {
  if (row.recountStatus === "missing") return "missing";
  if (row.isPhantom) return "phantom";
  if (row.noDeviceData) return "no_device";
  if (row.isManual) return "manual";
  if (row.actual == null) return null;
  const decision = decideAfterFact({
    expected: row.expected ?? 0,
    actual: row.actual,
    isPhantom: row.isPhantom,
    isManual: row.isManual,
    noDeviceData: row.noDeviceData,
    missing: row.recountStatus === "missing",
  });
  return decision.issueType;
}

export function collectionAgingDays(collectionDate: Date, now = new Date()) {
  const kyivDay = (d: Date) =>
    d.toLocaleDateString("en-CA", { timeZone: "Europe/Kyiv" });
  const from = kyivDay(collectionDate);
  const to = kyivDay(now);
  const fromUtc = Date.parse(`${from}T00:00:00Z`);
  const toUtc = Date.parse(`${to}T00:00:00Z`);
  if (!Number.isFinite(fromUtc) || !Number.isFinite(toUtc)) return 0;
  return Math.max(0, Math.round((toUtc - fromUtc) / 86_400_000));
}

export function collectionStatusOrDefault(
  status: string | null | undefined,
  handoverId: number | null
): CollectionStatus {
  if (isCollectionStatus(status)) return status;
  return handoverId == null ? "on_hand" : "handed";
}

export const ANTIFRAUD_DAYS = 7;
