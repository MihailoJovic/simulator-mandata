/**
 * Parsiranje korisničkog unosa. Prihvata srpski format ("1.700.000", "2,9")
 * kao i međunarodni ("1700000", "2.9").
 */

export type ParseResult = { ok: true; value: number } | { ok: false; error: string };

/** Ceo nenegativan broj glasova. Tačke, razmaci i donje crte su separatori hiljada. */
export function parseVotes(raw: string): ParseResult {
  const s = raw.trim();
  if (!s) return { ok: false, error: 'Unesite broj glasova.' };
  if (/^-/.test(s)) return { ok: false, error: 'Broj glasova ne može biti negativan.' };
  if (/,/.test(s)) return { ok: false, error: 'Broj glasova mora biti ceo broj.' };
  const clean = s.replace(/[.\s_ ']/g, '');
  if (!/^\d+$/.test(clean)) return { ok: false, error: 'Dozvoljene su samo cifre.' };
  const v = Number(clean);
  if (!Number.isSafeInteger(v)) return { ok: false, error: 'Broj je prevelik.' };
  return { ok: true, value: v };
}

/** Decimalni nenegativan broj (procenat). Zarez ili tačka kao decimalni separator. */
export function parseDecimal(raw: string, { max = Infinity }: { max?: number } = {}): ParseResult {
  const s = raw.trim().replace('%', '').trim();
  if (!s) return { ok: false, error: 'Unesite vrednost.' };
  if (/^-/.test(s)) return { ok: false, error: 'Vrednost ne može biti negativna.' };
  const norm = s.replace(',', '.');
  if (!/^\d*\.?\d+$|^\d+\.$/.test(norm)) return { ok: false, error: 'Neispravan broj.' };
  const v = Number(norm);
  if (!Number.isFinite(v)) return { ok: false, error: 'Neispravan broj.' };
  if (v > max) return { ok: false, error: `Najviše ${max}.` };
  return { ok: true, value: v };
}
