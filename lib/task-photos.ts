import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { randomBytes } from "crypto";

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

/**
 * Зберігає фотозвіт у public/uploads/tasks/{taskId}/
 * Повертає публічні URL шляхи.
 */
export async function saveTaskPhotoReport(
  taskId: number,
  files: File[]
): Promise<{ urls: string[] } | { error: string }> {
  if (files.length > MAX_FILES) {
    return { error: `Максимум ${MAX_FILES} фото` };
  }

  const urls: string[] = [];
  const dir = path.join(
    process.cwd(),
    "public",
    "uploads",
    "tasks",
    String(taskId)
  );
  await mkdir(dir, { recursive: true });

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
    const name = `${Date.now()}-${randomBytes(4).toString("hex")}.${extFor(file.type)}`;
    await writeFile(path.join(dir, name), buf);
    urls.push(`/uploads/tasks/${taskId}/${name}`);
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
