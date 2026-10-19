/**
 * Neutralna paleta za liste. Redosled je fiksan (boja prati listu, ne rang).
 * Namerno prigušeni tonovi — bez jarkih "stranačkih" boja; korisnik može ručno
 * da izabere boju svake liste.
 */
export const NEUTRAL_PALETTE = {
  series: [
    '#4f6d8a', // čelično plava
    '#a07a4f', // oker
    '#5f8f80', // sivozelena
    '#8a6d8f', // prigušena ljubičasta
    '#7d8a4f', // maslinasta
    '#a0646e', // prigušena ruža
    '#4f8a9a', // sivotirkizna
    '#8f7d63', // peščana
    '#6b6f9a', // sivoindigo
    '#9a8a4f', // senf
  ],
  aggregate: '#9ca3af',
} as const;

export function colorForIndex(i: number): string {
  return NEUTRAL_PALETTE.series[i % NEUTRAL_PALETTE.series.length];
}

/** Prihvata samo #rrggbb; inače vraća rezervnu boju. */
export function safeColor(c: string, fallback = '#64748b'): string {
  return /^#[0-9a-f]{6}$/i.test(c) ? c : fallback;
}
