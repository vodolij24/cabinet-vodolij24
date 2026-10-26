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

/** Підпис у меню вибору: вулиця і номер будинку, потім № автомата. */
export function machineStreetLabel(m: {
  id: number;
  name?: string | null;
  location?: string | null;
}) {
  const place = m.location?.trim();
  const name = m.name?.trim();
  const id = `№${m.id}`;
  if (place) return [place, name, id].filter(Boolean).join(" · ");
  return [name, id].filter(Boolean).join(" · ");
}

function stripMachinePrice(location: string) {
  return location
    .replace(/\s*Близенько\s*[\d.,]+\s*грн\.?\s*[Кк]?\s*$/i, "")
    .replace(/\s+[\d]+[.,][\d]+\s*грн\.?\s*$/i, "")
    .replace(/,\s*$/, "")
    .trim();
}

/** Вулиця, потім номер будинку. Решта адреси в сортування не входить. */
export function machineAddressKey(location: string | null | undefined) {
  const cleaned = stripMachinePrice((location || "").replace(/\s+/g, " ").trim());
  const empty = {
    street: cleaned,
    number: Number.MAX_SAFE_INTEGER,
    fraction: 0,
    suffix: "",
  };
  if (!cleaned) return empty;

  const house = "(\\d+)(?:/(\\d+))?([а-яіїєґa-z])?(?=\\s|$|,)";
  const comma = new RegExp(`^(.*?),\\s*${house}`, "i").exec(cleaned);
  const inline = comma
    ? null
    : new RegExp(`^(.*?)\\s+${house}\\s*$`, "i").exec(cleaned);
  const match = comma || inline;
  if (!match || !match[1].trim()) return empty;

  return {
    street: match[1].trim(),
    number: Number(match[2]),
    fraction: match[3] ? Number(match[3]) : 0,
    suffix: (match[4] || "").toLowerCase(),
  };
}

export function compareMachinesByAddress(
  a: { id: number; location?: string | null; address?: string | null },
  b: { id: number; location?: string | null; address?: string | null }
) {
  const ka = machineAddressKey(a.location || a.address);
  const kb = machineAddressKey(b.location || b.address);
  const street = ka.street.localeCompare(kb.street, "uk", { sensitivity: "base" });
  if (street !== 0) return street;
  if (ka.number !== kb.number) return ka.number - kb.number;
  if (ka.fraction !== kb.fraction) return ka.fraction - kb.fraction;
  const suffix = ka.suffix.localeCompare(kb.suffix, "uk");
  if (suffix !== 0) return suffix;
  return a.id - b.id;
}

/** Підпис для касира: номер апарату + адреса (без назви з Soliton-знімка). */
export function cashierMachineLabel(
  deviceId: number | null | undefined,
  location?: string | null,
  fallbackMachine?: string | null
) {
  const address =
    (typeof location === "string" && location.trim()) ||
    addressFromMachineSnapshot(fallbackMachine) ||
    "";
  if (deviceId != null && Number.isFinite(Number(deviceId))) {
    const id = Number(deviceId);
    return address ? `Апарат #${id} · ${address}` : `Апарат #${id}`;
  }
  return (fallbackMachine && fallbackMachine.trim()) || "—";
}

/** Зі знімка `№123 · назва · адреса` беремо останній сегмент як адресу. */
function addressFromMachineSnapshot(machine?: string | null): string | null {
  if (!machine?.trim()) return null;
  const parts = machine
    .split("·")
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length < 2) return null;
  const last = parts[parts.length - 1];
  if (/^№?\d+$/.test(last) || /^Апарат\s*#?\d+$/i.test(last)) return null;
  return last;
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
