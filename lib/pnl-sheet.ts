import "server-only";

import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { randomBytes } from "crypto";
import { put } from "@vercel/blob";

import { PNL_SHEET_LABELS, type PnlSheetKind } from "@/lib/pnl-constants";

const MAX_BYTES = 8 * 1024 * 1024;

const ALLOWED_EXT = new Set(["xlsx", "xls", "csv", "ods"]);

function extOf(file: File) {
  const fromName = file.name.split(".").pop()?.toLowerCase() || "";
  if (ALLOWED_EXT.has(fromName)) return fromName;
  if (file.type.includes("csv")) return "csv";
  if (file.type.includes("spreadsheet")) return "xlsx";
  if (file.type.includes("excel")) return "xls";
  return "";
}

function blobToken() {
  return process.env.BLOB_READ_WRITE_TOKEN?.trim() || undefined;
}

async function saveSpreadsheetFile(periodKey: string, kind: PnlSheetKind, file: File) {
  const ext = extOf(file);
  if (!ext) {
    return { error: "Дозволені формати: XLSX, XLS, CSV, ODS" as const };
  }
  if (file.size > MAX_BYTES) {
    return { error: "Файл до 8 МБ" as const };
  }

  const buf = Buffer.from(await file.arrayBuffer());
  const name = `${Date.now()}-${randomBytes(4).toString("hex")}.${ext}`;
  const folder = `pnl/${periodKey}/${kind}`;
  const token = blobToken();

  if (process.env.VERCEL || token) {
    if (!token) {
      return {
        error:
          "Сховище файлів не налаштоване (BLOB_READ_WRITE_TOKEN)." as const,
      };
    }
    const blob = await put(`${folder}/${name}`, buf, {
      access: "public",
      contentType: file.type || "application/octet-stream",
      addRandomSuffix: false,
      token,
    });
    return { url: blob.url, buf, fileName: file.name || name };
  }

  const dir = path.join(process.cwd(), "public", "uploads", ...folder.split("/"));
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, name), buf);
  return {
    url: `/uploads/${folder}/${name}`.replace(/\/+/g, "/"),
    buf,
    fileName: file.name || name,
  };
}

function parseUaNumber(raw: string): number | null {
  let t = String(raw).trim().replace(/\u00a0/g, " ");
  t = t.replace(/грн\.?|UAH|₴/gi, "").trim();
  if (!t || !/\d/.test(t)) return null;
  const compact = t.replace(/\s/g, "");
  if (/^-?\d{1,3}(\.\d{3})+(,\d+)?$/.test(compact)) {
    t = compact.replace(/\./g, "").replace(",", ".");
  } else if (/^-?\d{1,3}(,\d{3})+(\.\d+)?$/.test(compact)) {
    t = compact.replace(/,/g, "");
  } else if (/^-?\d+,\d+$/.test(compact)) {
    t = compact.replace(",", ".");
  } else {
    t = compact.replace(",", ".");
  }
  const n = parseFloat(t);
  if (!Number.isFinite(n)) return null;
  return Math.round(n * 100) / 100;
}

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  const src = text.replace(/^\uFEFF/, "");
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (quoted) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          cell += '"';
          i += 1;
        } else {
          quoted = false;
        }
      } else {
        cell += ch;
      }
      continue;
    }
    if (ch === '"') {
      quoted = true;
      continue;
    }
    if (ch === "," || ch === ";" || ch === "\t") {
      row.push(cell.trim());
      cell = "";
      continue;
    }
    if (ch === "\n") {
      row.push(cell.trim());
      rows.push(row);
      row = [];
      cell = "";
      continue;
    }
    if (ch !== "\r") cell += ch;
  }
  if (cell.length || row.length) {
    row.push(cell.trim());
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => c.length > 0));
}

async function matrixFromWorkbook(buf: Buffer, ext: string): Promise<string[][]> {
  if (ext === "csv") {
    return parseCsv(buf.toString("utf8"));
  }
  let XLSX: typeof import("xlsx");
  try {
    const mod = await import(/* webpackIgnore: true */ "xlsx");
    XLSX = (mod as { default?: typeof import("xlsx") }).default ?? mod;
  } catch {
    throw new Error("XLSX_MISSING");
  }
  const wb = XLSX.read(buf, { type: "buffer" });
  const name = wb.SheetNames[0];
  if (!name) return [];
  const rows = XLSX.utils.sheet_to_json<(string | number | null)[]>(
    wb.Sheets[name],
    {
      header: 1,
      raw: false,
      defval: "",
    }
  );
  return rows.map((row) =>
    (Array.isArray(row) ? row : []).map((c) => String(c ?? "").trim())
  );
}

function heuristicAmount(matrix: string[][]): { amount: number; note: string } {
  const keywords =
    /разом|всього|итого|підсум|підсумок|total|summa|сума(?!\s*ряд)/i;
  let best: { amount: number; note: string } | null = null;

  for (let i = 0; i < matrix.length; i++) {
    const row = matrix[i];
    const joined = row.join(" ");
    if (!keywords.test(joined)) continue;
    const nums = row
      .map(parseUaNumber)
      .filter((n): n is number => n != null && Math.abs(n) >= 1);
    if (nums.length === 0) continue;
    const amount = nums.reduce((a, b) => (Math.abs(b) > Math.abs(a) ? b : a));
    best = { amount, note: `Рядок ${i + 1}: ${joined.slice(0, 80)}` };
  }

  if (best) return best;

  const all: number[] = [];
  for (const row of matrix.slice(-30)) {
    for (const cell of row) {
      const n = parseUaNumber(cell);
      if (n != null && Math.abs(n) >= 10) all.push(n);
    }
  }
  if (all.length === 0) {
    return { amount: 0, note: "Не вдалося знайти суму в таблиці — вкажіть вручну" };
  }
  const amount = all.reduce((a, b) => (Math.abs(b) > Math.abs(a) ? b : a));
  return { amount, note: "Взято найбільше число з кінця таблиці — перевірте" };
}

function matrixTsv(matrix: string[][]) {
  return matrix
    .slice(0, 80)
    .map((row) => row.slice(0, 16).join("\t"))
    .join("\n")
    .slice(0, 12000);
}

async function aiAmount(
  kind: PnlSheetKind,
  matrix: string[][]
): Promise<{ amount: number; note: string } | null> {
  const key = process.env.OPENAI_API_KEY?.trim();
  if (!key) return null;
  const label = PNL_SHEET_LABELS[kind];
  const body = {
    model: "gpt-4o-mini",
    temperature: 0,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content:
          "Ти фінансовий аналітик. З електронної таблиці витягни ОДНУ підсумкову суму в гривнях. Відповідь лише JSON {\"amount\": number, \"note\": string}.",
      },
      {
        role: "user",
        content: `Категорія: ${label}\nТаблиця (TSV):\n${matrixTsv(matrix)}`,
      },
    ],
  };
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    console.error("[PNL_SHEET_AI]", res.status, await res.text());
    return null;
  }
  const json = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const text = json.choices?.[0]?.message?.content || "";
  try {
    const parsed = JSON.parse(text) as { amount?: unknown; note?: unknown };
    const amount = parseUaNumber(String(parsed.amount ?? ""));
    if (amount == null) return null;
    return {
      amount,
      note:
        typeof parsed.note === "string" && parsed.note.trim()
          ? parsed.note.trim()
          : "ШІ аналіз таблиці",
    };
  } catch {
    return null;
  }
}

export async function ingestPnlSpreadsheet(input: {
  periodKey: string;
  kind: PnlSheetKind;
  file: File;
}): Promise<
  | { error: string }
  | { amount: number; note: string; fileUrl: string; fileName: string }
> {
  const saved = await saveSpreadsheetFile(
    input.periodKey,
    input.kind,
    input.file
  );
  if ("error" in saved) return saved;

  let matrix: string[][] = [];
  try {
    matrix = await matrixFromWorkbook(saved.buf, extOf(input.file) || "csv");
  } catch (error) {
    if (error instanceof Error && error.message === "XLSX_MISSING") {
      return {
        error:
          "Для Excel збережіть файл як CSV або встановіть пакет xlsx (npm install xlsx)",
      };
    }
    console.error("[PNL_SHEET_PARSE]", error);
    return { error: "Не вдалося прочитати таблицю" };
  }

  const ai = await aiAmount(input.kind, matrix).catch((error) => {
    console.error("[PNL_SHEET_AI]", error);
    return null;
  });
  const extracted = ai ?? heuristicAmount(matrix);

  return {
    amount: extracted.amount,
    note: extracted.note,
    fileUrl: saved.url,
    fileName: saved.fileName,
  };
}
