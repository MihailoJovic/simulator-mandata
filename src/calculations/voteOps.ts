import type { ElectoralList } from '../types/election';
import { decimalToRational } from './rational';

/**
 * Operacije nad glasovima. Sve funkcije su ČISTE (vraćaju nove nizove) i rade
 * isključivo sa celim brojevima glasova.
 */

/** Kako se ostale liste prilagođavaju kada se menja rezultat jedne liste. */
export type Adjustment =
  /** Ostale liste zadržavaju svoje glasove (ukupan broj glasova se menja). */
  | { kind: 'none' }
  /** Ukupan broj glasova ostaje isti; razlika se proporcionalno uzima/daje ostalim listama. */
  | { kind: 'proportional' }
  /** Ukupan broj glasova ostaje isti; razlika se uzima/daje jednoj izvornoj listi. */
  | { kind: 'from'; sourceId: string };

/**
 * Raspodela celog broja `total` proporcionalno težinama, metodom najvećeg ostatka
 * (Hamilton). Zbir rezultata je TAČNO `total`. Izjednačeni ostaci → manji indeks.
 */
export function apportionLargestRemainder(weights: number[], total: number): number[] {
  const n = weights.length;
  const out = new Array<number>(n).fill(0);
  const wSum = weights.reduce((a, w) => a + (w > 0 ? w : 0), 0);
  if (total <= 0 || n === 0) return out;
  if (wSum <= 0) return out;
  const rema: Array<[number, number]> = [];
  let assigned = 0;
  for (let i = 0; i < n; i++) {
    const w = weights[i] > 0 ? weights[i] : 0;
    const exact = (w / wSum) * total;
    const fl = Math.floor(exact);
    out[i] = fl;
    assigned += fl;
    rema.push([exact - fl, i]);
  }
  rema.sort((a, b) => b[0] - a[0] || a[1] - b[1]);
  let left = total - assigned;
  for (let k = 0; left > 0 && k < rema.length; k++) {
    if (weights[rema[k][1]] > 0) {
      out[rema[k][1]]++;
      left--;
    }
  }
  return out;
}

/** Unos po procentima → celi glasovi (normalizacija na 100% i na zadati ukupan broj). */
export function percentagesToVotes(percents: number[], totalVotes: number): number[] {
  return apportionLargestRemainder(percents, Math.max(0, Math.round(totalVotes)));
}

function clampInt(v: number, lo: number, hi: number): number {
  if (!Number.isFinite(v)) return lo;
  return Math.min(hi, Math.max(lo, Math.round(v)));
}

/** Postavlja tačan broj glasova jednoj listi, uz izabrano prilagođavanje ostalih. */
export function setListVotes(lists: ElectoralList[], id: string, newVotes: number, adj: Adjustment): ElectoralList[] {
  const idx = lists.findIndex((l) => l.id === id);
  if (idx < 0) return lists;
  const old = lists[idx].votes;
  const total = lists.reduce((a, l) => a + l.votes, 0);

  if (adj.kind === 'none') {
    const v = clampInt(newVotes, 0, Number.MAX_SAFE_INTEGER);
    return lists.map((l, i) => (i === idx ? { ...l, votes: v } : l));
  }

  if (adj.kind === 'from') {
    const sIdx = lists.findIndex((l) => l.id === adj.sourceId);
    if (sIdx < 0 || sIdx === idx) return setListVotes(lists, id, newVotes, { kind: 'none' });
    const maxV = old + lists[sIdx].votes;
    const v = clampInt(newVotes, 0, maxV);
    const delta = v - old;
    return lists.map((l, i) =>
      i === idx ? { ...l, votes: v } : i === sIdx ? { ...l, votes: l.votes - delta } : l,
    );
  }

  // proporcionalno: ukupan broj ostaje isti
  const othersTotal = total - old;
  const v = clampInt(newVotes, 0, othersTotal > 0 ? total : old);
  const newOthers = total - v;
  const weights = lists.map((l, i) => (i === idx ? 0 : l.votes));
  const dist = apportionLargestRemainder(weights, newOthers);
  return lists.map((l, i) => (i === idx ? { ...l, votes: v } : { ...l, votes: dist[i] }));
}

/**
 * Postavlja udeo liste na `percent` % VAŽEĆIH glasova (posle prilagođavanja).
 * Broj glasova se zaokružuje NAVIŠE, tako da lista ima NAJMANJE zadati procenat.
 */
export function setListShare(lists: ElectoralList[], id: string, percent: number, adj: Adjustment): ElectoralList[] {
  const idx = lists.findIndex((l) => l.id === id);
  if (idx < 0) return lists;
  const p = decimalToRational(Math.min(100, Math.max(0, percent)), 6);
  if (!p) return lists;
  const total = lists.reduce((a, l) => a + l.votes, 0);
  const old = lists[idx].votes;
  let v: number;
  if (adj.kind === 'none') {
    const others = total - old;
    // v / (others + v) = p/100  →  v = p·others / (100 − p)
    const denom = BigInt(100 * p.den - p.num);
    if (denom <= 0n) v = Math.max(old, others > 0 ? others * 1000 : old);
    else {
      const n = BigInt(p.num) * BigInt(others);
      v = Number((n + denom - 1n) / denom);
    }
  } else {
    const n = BigInt(p.num) * BigInt(total);
    const d = BigInt(100 * p.den);
    v = Number((n + d - 1n) / d);
  }
  return setListVotes(lists, id, v, adj);
}

export type TransferUnit = 'votes' | 'percentOfTotal' | 'percentOfSource';

export interface TransferResult {
  lists: ElectoralList[];
  moved: number;
  error: string | null;
}

/**
 * Prebacuje glasove sa jedne liste na drugu. Ukupan broj glasova ostaje isti.
 *  - 'votes': apsolutni broj glasova
 *  - 'percentOfTotal': procentni poeni od ukupnog broja važećih glasova
 *  - 'percentOfSource': procenat glasova izvorne liste
 */
export function transferVotes(
  lists: ElectoralList[],
  fromId: string,
  toId: string,
  amount: number,
  unit: TransferUnit = 'votes',
): TransferResult {
  const from = lists.find((l) => l.id === fromId);
  const to = lists.find((l) => l.id === toId);
  if (!from || !to) return { lists, moved: 0, error: 'Izaberite obe liste.' };
  if (fromId === toId) return { lists, moved: 0, error: 'Izvorna i ciljna lista moraju biti različite.' };
  if (typeof amount !== 'number' || !Number.isFinite(amount) || amount < 0) {
    return { lists, moved: 0, error: 'Iznos mora biti nenegativan broj.' };
  }
  const total = lists.reduce((a, l) => a + l.votes, 0);
  let moved: number;
  if (unit === 'votes') moved = Math.round(amount);
  else if (unit === 'percentOfTotal') moved = Math.round((amount / 100) * total);
  else moved = Math.round((amount / 100) * from.votes);

  if (unit === 'percentOfSource' && amount > 100) return { lists, moved: 0, error: 'Procenat izvorne liste ne može biti veći od 100%.' };
  if (moved > from.votes) {
    return { lists, moved: 0, error: `Lista "${from.name}" ima samo ${from.votes.toLocaleString('sr-RS')} glasova.` };
  }
  return {
    lists: lists.map((l) =>
      l.id === fromId ? { ...l, votes: l.votes - moved } : l.id === toId ? { ...l, votes: l.votes + moved } : l,
    ),
    moved,
    error: null,
  };
}
