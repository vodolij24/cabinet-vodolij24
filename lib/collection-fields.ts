import { kyivDateTimeToUtc } from "@/lib/kyiv-date";

export function parseMoney(value: unknown): number | null {
  if (value == null || value === "") return null;
  const n =
    typeof value === "number"
      ? value
      : parseFloat(String(value).replace(",", ".").replace(/\s/g, ""));
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n * 100) / 100;
}

export function parseCount(value: unknown): number | null {
  if (value == null || value === "") return null;
  const n =
    typeof value === "number" ? value : parseInt(String(value).trim(), 10);
  if (!Number.isFinite(n) || n < 0 || !Number.isInteger(n)) return null;
  return n;
}

export function decimalToNumber(value: unknown): number {
  if (value == null) return 0;
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (typeof value === "string") {
    const n = parseFloat(value);
    return Number.isFinite(n) ? n : 0;
  }
  if (typeof value === "object" && "toNumber" in value) {
    try {
      return (value as { toNumber: () => number }).toNumber();
    } catch {
      return 0;
    }
  }
  return 0;
}

export function machineLabel(m: {
  id: number;
  name: string | null;
  location?: string | null;
}) {
  const parts = [`№${m.id}`];
  if (m.name?.trim()) parts.push(m.name.trim());
  if (m.location?.trim()) parts.push(m.location.trim());
  return parts.join(" · ");
}

export function parseCollectionDateTime(
  dateValue: unknown,
  timeValue: unknown
): Date | null {
  if (typeof dateValue !== "string" || typeof timeValue !== "string") {
    return null;
  }
  return kyivDateTimeToUtc(dateValue.trim(), timeValue.trim());
}
