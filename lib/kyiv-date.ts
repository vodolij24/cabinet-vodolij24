/** YYYY-MM-DD календарного дня у Europe/Kyiv */
export function kyivDayKey(date: Date = new Date()): string {
  return date.toLocaleDateString("en-CA", { timeZone: "Europe/Kyiv" });
}

function kyivParts(date: Date) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Kyiv",
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
    second: "numeric",
    hour12: false,
  }).formatToParts(date);

  const get = (type: string) =>
    Number(parts.find((p) => p.type === type)?.value || 0);

  return {
    year: get("year"),
    month: get("month"),
    day: get("day"),
    hour: get("hour"),
    minute: get("minute"),
    second: get("second"),
  };
}

function utcFromKyivLocal(
  dayKey: string,
  hour: number,
  minute: number,
  second: number,
  ms: number
): Date {
  const [y, m, d] = dayKey.split("-").map(Number);
  for (const offsetHours of [2, 3]) {
    const utc = Date.UTC(y, m - 1, d, hour - offsetHours, minute, second, ms);
    const check = new Date(utc);
    const p = kyivParts(check);
    if (
      p.year === y &&
      p.month === m &&
      p.day === d &&
      p.hour === hour &&
      p.minute === minute &&
      p.second === second
    ) {
      return check;
    }
  }
  return new Date(Date.UTC(y, m - 1, d, hour - 3, minute, second, ms));
}

/** Межі поточного календарного дня (Europe/Kyiv) для фільтра транзакцій */
export function kyivTodayBounds(now = new Date()) {
  const dayKey = kyivDayKey(now);
  return {
    dayKey,
    from: utcFromKyivLocal(dayKey, 0, 0, 0, 0),
    to: utcFromKyivLocal(dayKey, 23, 59, 59, 999),
  };
}

/** YYYY-MM-DD для <input type="date"> у Europe/Kyiv */
export function kyivDateInputValue(date: Date): string {
  return kyivDayKey(date);
}

/** HH:mm для <input type="time"> у Europe/Kyiv */
export function kyivTimeInputValue(date: Date): string {
  const p = kyivParts(date);
  const hour = p.hour === 24 ? 0 : p.hour;
  return `${String(hour).padStart(2, "0")}:${String(p.minute).padStart(2, "0")}`;
}

/** Локальні дата+час Києва → UTC Date */
export function kyivDateTimeToUtc(
  dayKey: string,
  timeHHmm: string
): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dayKey)) return null;
  const match = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(timeHHmm.trim());
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  const second = Number(match[3] || 0);
  if (hour > 23 || minute > 59 || second > 59) return null;
  return utcFromKyivLocal(dayKey, hour, minute, second, 0);
}

export function kyivDateLabel(date: Date): string {
  return date.toLocaleDateString("uk-UA", { timeZone: "Europe/Kyiv" });
}

export function kyivTimeLabel(date: Date): string {
  return date.toLocaleTimeString("uk-UA", {
    timeZone: "Europe/Kyiv",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function addDaysToDayKey(dayKey: string, days: number): string {
  const [y, m, d] = dayKey.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return [
    dt.getUTCFullYear(),
    String(dt.getUTCMonth() + 1).padStart(2, "0"),
    String(dt.getUTCDate()).padStart(2, "0"),
  ].join("-");
}

/** 0 = понеділок … 6 = неділя для календарної дати YYYY-MM-DD */
function mondayIndex(dayKey: string): number {
  const [y, m, d] = dayKey.split("-").map(Number);
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return dow === 0 ? 6 : dow - 1;
}

export type CollectionPeriodPreset = "day" | "week" | "month" | "custom";

export const COLLECTION_PERIOD_PRESETS: {
  value: CollectionPeriodPreset;
  label: string;
}[] = [
  { value: "day", label: "День" },
  { value: "week", label: "Тиждень" },
  { value: "month", label: "Місяць" },
  { value: "custom", label: "Довільний період" },
];

export function kyivPeriodBounds(
  preset: Exclude<CollectionPeriodPreset, "custom">,
  now = new Date()
) {
  const dayKey = kyivDayKey(now);

  if (preset === "day") {
    return {
      from: utcFromKyivLocal(dayKey, 0, 0, 0, 0),
      to: utcFromKyivLocal(dayKey, 23, 59, 59, 999),
      fromKey: dayKey,
      toKey: dayKey,
    };
  }

  if (preset === "week") {
    const fromKey = addDaysToDayKey(dayKey, -mondayIndex(dayKey));
    const toKey = addDaysToDayKey(fromKey, 6);
    return {
      from: utcFromKyivLocal(fromKey, 0, 0, 0, 0),
      to: utcFromKyivLocal(toKey, 23, 59, 59, 999),
      fromKey,
      toKey,
    };
  }

  const [y, month] = dayKey.split("-").map(Number);
  const fromKey = `${y}-${String(month).padStart(2, "0")}-01`;
  const lastDay = new Date(Date.UTC(y, month, 0)).getUTCDate();
  const toKey = `${y}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
  return {
    from: utcFromKyivLocal(fromKey, 0, 0, 0, 0),
    to: utcFromKyivLocal(toKey, 23, 59, 59, 999),
    fromKey,
    toKey,
  };
}

export function kyivCustomPeriodBounds(fromKey: string, toKey: string) {
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(fromKey) ||
    !/^\d{4}-\d{2}-\d{2}$/.test(toKey) ||
    fromKey > toKey
  ) {
    return null;
  }
  return {
    from: utcFromKyivLocal(fromKey, 0, 0, 0, 0),
    to: utcFromKyivLocal(toKey, 23, 59, 59, 999),
    fromKey,
    toKey,
  };
}
