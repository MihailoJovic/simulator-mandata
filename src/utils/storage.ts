/** localStorage sa zaštitom (privatni režim, blokiran storage…). Podaci ostaju lokalno. */
export function loadJSON<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function saveJSON(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage nedostupan — aplikacija radi i bez njega */
  }
}

export const STORAGE_KEYS = {
  state: 'sim-mandata:state:v1',
  scenarios: 'sim-mandata:scenarios:v1',
  uiMode: 'sim-mandata:ui-mode:v1',
} as const;
