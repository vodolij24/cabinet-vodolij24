import "server-only";

import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { randomBytes } from "crypto";
import { put } from "@vercel/blob";

import { parsePhotoUrls } from "@/lib/photo-urls";

export { parsePhotoUrls };

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

function isVercelRuntime(): boolean {
  return Boolean(process.env.VERCEL);
}

function blobToken(): string | undefined {
  const token = process.env.BLOB_READ_WRITE_TOKEN?.trim();
  return token || undefined;
}

function shouldUseBlob(): boolean {
  return isVercelRuntime() || Boolean(blobToken());
}

async function saveOneLocal(
  folder: string,
  file: File,
  buf: Buffer
): Promise<string> {
  const dir = path.join(process.cwd(), "public", "uploads", ...folder.split("/"));
  await mkdir(dir, { recursive: true });
  const name = `${Date.now()}-${randomBytes(4).toString("hex")}.${extFor(file.type)}`;
  await writeFile(path.join(dir, name), buf);
  return `/uploads/${folder}/${name}`.replace(/\/+/g, "/");
}

async function saveOneBlob(
  folder: string,
  file: File,
  buf: Buffer,
  token: string
): Promise<string> {
  const name = `${Date.now()}-${randomBytes(4).toString("hex")}.${extFor(file.type)}`;
  const pathname = `${folder}/${name}`;
  const blob = await put(pathname, buf, {
    access: "public",
    contentType: file.type || "image/jpeg",
    addRandomSuffix: false,
    token,
  });
  return blob.url;
}

/**
 * Зберігає фото у uploads/{folder}/ або Vercel Blob.
 * folder: напр. "tasks/12" або "finance/4/2026-08"
 */
export async function savePhotoReport(
  folder: string,
  files: File[]
): Promise<{ urls: string[] } | { error: string }> {
  const cleanFolder = folder.replace(/^\/+|\/+$/g, "").replace(/\.\./g, "");
  if (!cleanFolder) {
    return { error: "Некоректний шлях збереження" };
  }

  if (files.length > MAX_FILES) {
    return { error: `Максимум ${MAX_FILES} фото` };
  }

  const useBlob = shouldUseBlob();
  const token = blobToken();

  if (useBlob && !token) {
    console.error(
      "[PHOTO_SAVE] BLOB_READ_WRITE_TOKEN missing on Vercel runtime"
    );
    return {
      error:
        "Сховище фото не налаштоване (BLOB_READ_WRITE_TOKEN). Підключіть Blob store до проєкту й зробіть Redeploy.",
    };
  }

  const urls: string[] = [];

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
      const url =
        useBlob && token
          ? await saveOneBlob(cleanFolder, file, buf, token)
          : await saveOneLocal(cleanFolder, file, buf);
      urls.push(url);
    } catch (error) {
      console.error("[PHOTO_SAVE]", error);
      return { error: "Не вдалося зберегти фото" };
    }
  }

  return { urls };
}

export async function saveTaskPhotoReport(
  taskId: number,
  files: File[]
): Promise<{ urls: string[] } | { error: string }> {
  return savePhotoReport(`tasks/${taskId}`, files);
}
