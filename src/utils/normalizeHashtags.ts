/**
 * Normalizes a hashtag list for publish payloads.
 * - Accepts string or string[]
 * - Trims whitespace, removes empty values
 * - Ensures each tag starts with '#'
 * - Deduplicates case-insensitively (preserves first occurrence casing)
 * - Caps at 5 tags
 */
export function normalizeHashtags(input: string | string[] | null | undefined): string[] {
  const raw = Array.isArray(input)
    ? input
    : typeof input === 'string'
    ? input.split(/[\s,]+/)
    : [];

  const seen = new Set<string>();
  const result: string[] = [];

  for (const tag of raw) {
    const trimmed = tag.trim();
    if (!trimmed) continue;

    const normalized = trimmed.startsWith('#') ? trimmed : `#${trimmed}`;
    const key = normalized.toLowerCase();

    if (!seen.has(key)) {
      seen.add(key);
      result.push(normalized);
    }

    if (result.length === 5) break;
  }

  return result;
}
