/**
 * Formatiranje za prikaz. Nijedna funkcija nikada ne vraća "NaN", "Infinity"
 * ili "undefined" — za nevalidne vrednosti vraća se "—".
 */
const DASH = '—';
const intFmt = new Intl.NumberFormat('sr-Latn-RS', { maximumFractionDigits: 0 });

export function fmtInt(v: unknown): string {
  return typeof v === 'number' && Number.isFinite(v) ? intFmt.format(Math.round(v)) : DASH;
}

export function fmtPct(v: unknown, digits = 2): string {
  if (typeof v !== 'number' || !Number.isFinite(v)) return DASH;
  return `${v.toLocaleString('sr-Latn-RS', { minimumFractionDigits: digits, maximumFractionDigits: digits })}%`;
}

export function fmtNum(v: unknown, digits = 2): string {
  if (typeof v !== 'number' || !Number.isFinite(v)) return DASH;
  return v.toLocaleString('sr-Latn-RS', { minimumFractionDigits: 0, maximumFractionDigits: digits });
}

/** Količnik sa tačno 3 decimale (prikaz); tačna vrednost je razlomak. */
export function fmtQuotient(num: number, den: number): string {
  if (!Number.isFinite(num) || !Number.isFinite(den) || den === 0) return DASH;
  return (num / den).toLocaleString('sr-Latn-RS', { minimumFractionDigits: 0, maximumFractionDigits: 3 });
}

export function fmtSigned(v: number): string {
  if (!Number.isFinite(v)) return DASH;
  return v > 0 ? `+${v}` : v < 0 ? `−${Math.abs(v)}` : '0';
}

export function fmtMs(ms: number): string {
  return Number.isFinite(ms) ? `${ms.toFixed(ms < 10 ? 2 : 0)} ms` : DASH;
}

export function fmtDate(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? DASH : d.toLocaleString('sr-Latn-RS');
}
