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
