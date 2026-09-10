export function asInt(n: number, min = 0) {
  const v = Number(n);
  if (!Number.isInteger(v) || v < min) {
    throw new Error("Invalid int");
  }
  return v;
}

export function sqlLit(value: string | null | undefined): string {
  if (value == null) return "NULL";
  return `'${String(value).replace(/'/g, "''")}'`;
}

export function sqlNum(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "NULL";
  return (Math.round(value * 100) / 100).toFixed(2);
}

export function intList(ids: number[], min = 1) {
  if (ids.length === 0) throw new Error("EMPTY_IDS");
  return ids.map((id) => asInt(id, min)).join(",");
}

export function roundMoney(n: number) {
  return Math.round(n * 100) / 100;
}
