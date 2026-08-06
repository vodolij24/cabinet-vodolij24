import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { randomBytes } from "crypto";
import { put } from "@vercel/blob";

const ALLOWED = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
]);

const MAX_FILES = 5;
const MAX_BYTES = 5 * 1024 * 1024; // 5MB

function extFor(mime: string): string {
  if (mime === "image/png") return "png";
  if (mime === "image/webp") return "webp";
  if (mime === "image/heic" || mime === "image/heif") return "heic";
  return "jpg";
}

function useVercelBlob(): boolean {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN);
}

async function saveOneLocal(
  taskId: number,
  file: File,
  buf: Buffer
): Promise<string> {
  const dir = path.join(
    process.cwd(),
    "public",
    "uploads",
    "tasks",
    String(taskId)
  );
  await mkdir(dir, { recursive: true });
  const name = `${Date.now()}-${randomBytes(4).toString("hex")}.${extFor(file.type)}`;
  await writeFile(path.join(dir, name), buf);
  return `/uploads/tasks/${taskId}/${name}`;
}

async function saveOneBlob(
  taskId: number,
  file: File,
  buf: Buffer
): Promise<string> {
  const name = `${Date.now()}-${randomBytes(4).toString("hex")}.${extFor(file.type)}`;
  const pathname = `tasks/${taskId}/${name}`;
  const blob = await put(pathname, buf, {
    access: "public",
    contentType: file.type || "image/jpeg",
    addRandomSuffix: false,
  });
  return blob.url;
}

/**
 * Зберігає фотозвіт:
 * - на Vercel (є BLOB_READ_WRITE_TOKEN) → Vercel Blob
 * - локально без токена → public/uploads/tasks/{taskId}/
 */
export async function saveTaskPhotoReport(
  taskId: number,
  files: File[]
): Promise<{ urls: string[] } | { error: string }> {
  if (files.length > MAX_FILES) {
    return { error: `Максимум ${MAX_FILES} фото` };
  }

  const urls: string[] = [];
  const blob = useVercelBlob();

  for (const file of files) {
    if (!ALLOWED.has(file.type)) {
      return {
        error: "Дозволені формати: JPEG, PNG, WebP",
      };
    }
    if (file.size > MAX_BYTES) {
      return { error: "Кожне фото до 5 МБ" };
    }

    const buf = Buffer.from(await file.arrayBuffer());
    try {
      const url = blob
        ? await saveOneBlob(taskId, file, buf)
        : await saveOneLocal(taskId, file, buf);
      urls.push(url);
    } catch (error) {
      console.error("[TASK_PHOTO_SAVE]", error);
      return { error: "Не вдалося зберегти фото" };
    }
  }

  return { urls };
}

export function parsePhotoUrls(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.filter((u) => typeof u === "string")
      : [];
  } catch {
    return [];
  }
}
