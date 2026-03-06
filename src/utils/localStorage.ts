/** Safe JSON parse — returns null on any error instead of throwing. */
export function safeParse<T>(value: string | null): T | null {
  if (!value) return null;
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

/** Read a JSON value from localStorage. Returns null on missing key or parse error. */
export function lsGet<T>(key: string): T | null {
  try {
    return safeParse<T>(localStorage.getItem(key));
  } catch {
    return null;
  }
}

/** Write a JSON value to localStorage. Silently swallows QuotaExceededError. */
export function lsSet(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // QuotaExceededError or private browsing — ignore
  }
}

/** Remove a key from localStorage. */
export function lsRemove(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {
    // ignore
  }
}
