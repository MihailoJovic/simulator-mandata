import type { Rational } from '../types/election';

/**
 * Tačna racionalna aritmetika za D'Hondt količnike.
 *
 * Količnik a/b se NIKADA ne poredi preko floating-point deljenja. Poređenje se radi
 * unakrsnim množenjem celih brojeva: a.num × b.den  vs  b.num × a.den.
 * Dok su proizvodi ≤ Number.MAX_SAFE_INTEGER (2^53 − 1) koristi se brza Number aritmetika
 * (koja je tada TAČNA za cele brojeve); inače se automatski prelazi na BigInt.
 */

const MAX_SAFE = Number.MAX_SAFE_INTEGER;

export function gcd(a: number, b: number): number {
  a = Math.abs(a);
  b = Math.abs(b);
  while (b) {
    const t = b;
    b = a % b;
    a = t;
  }
  return a || 1;
}

export function reduce(r: Rational): Rational {
  const g = gcd(r.num, r.den);
  return { num: r.num / g, den: r.den / g };
}

/** −1 ako a < b, 0 ako a = b, 1 ako a > b (tačno). */
export function compareRational(a: Rational, b: Rational): number {
  return compareProducts(a.num, b.den, b.num, a.den);
}

/** Tačno poređenje x1·y1 i x2·y2 za nenegativne cele brojeve. */
export function compareProducts(x1: number, y1: number, x2: number, y2: number): number {
  const l = x1 * y1;
  const r = x2 * y2;
  if (l <= MAX_SAFE && r <= MAX_SAFE) return l < r ? -1 : l > r ? 1 : 0;
  const L = BigInt(x1) * BigInt(y1);
  const R = BigInt(x2) * BigInt(y2);
  return L < R ? -1 : L > R ? 1 : 0;
}

/**
 * Konvertuje decimalni broj (npr. procenat 3.25) u tačan razlomak sa najviše
 * `maxDecimals` decimala. Vraća null za nevalidne vrednosti.
 */
export function decimalToRational(value: number, maxDecimals = 6): Rational | null {
  if (!Number.isFinite(value) || value < 0) return null;
  const scale = 10 ** maxDecimals;
  const num = Math.round(value * scale);
  if (!Number.isSafeInteger(num)) return null;
  return reduce({ num, den: scale });
}

/** Množilac količnika: 1 + bonus/100, kao razlomak (npr. 35% → 27/20). */
export function bonusMultiplier(bonusPercent: number): Rational {
  const r = decimalToRational(bonusPercent, 4) ?? { num: 0, den: 1 };
  // 1 + num/(den·100) = (den·100 + num) / (den·100)
  return reduce({ num: r.den * 100 + r.num, den: r.den * 100 });
}

export function rationalToNumber(r: Rational): number {
  return r.den === 0 ? 0 : r.num / r.den;
}
