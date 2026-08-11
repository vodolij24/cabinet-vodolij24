/** Парсинг JSON-масиву URL фото (безпечно для client і server). */
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
