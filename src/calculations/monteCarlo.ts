import type { ElectionSettings, ElectoralList } from '../types/election';
import { quickSeats } from './mandates';
import { apportionLargestRemainder } from './voteOps';
import { passesThreshold } from './threshold';
import { mulberry32 } from '../utils/prng';
import { majorityOf } from '../data/rules';

/**
 * Monte Carlo analiza PROSTORA SCENARIJA koji je definisao korisnik.
 * Ovo NIJE izborna prognoza: svaka kombinacija je jednako verovatna (uniformno
 * unutar zadatih opsega), bez ikakve pretpostavke o stvarnom ponašanju birača.
 */

export interface MCRange {
  id: string;
  minPercent: number;
  maxPercent: number;
}

export interface MCGroup {
  name: string;
  ids: string[];
}

export interface MCParams {
  lists: ElectoralList[];
  settings: ElectionSettings;
  /** Opsezi za liste sa slučajnim rezultatom. Liste bez opsega dele ostatak do 100%. */
  ranges: MCRange[];
  iterations: number;
  seed: number;
  /** Ukupan broj važećih glasova u svakoj simulaciji. */
  totalVotes: number;
  groups: MCGroup[];
}

export interface MCListStats {
  id: string;
  name: string;
  mean: number;
  min: number;
  max: number;
  std: number;
  meanPercent: number;
  /** Broj simulacija u kojima je lista prešla cenzus. */
  passedCount: number;
  /** Broj simulacija sa ≥ 1 mandatom. */
  seatsPositiveCount: number;
  /** Broj simulacija u kojima lista sama ima većinu. */
  majorityCount: number;
  /** Histogram: histogram[k] = broj simulacija sa k mandata. */
  histogram: number[];
}

export interface MCGroupStats {
  name: string;
  ids: string[];
  majorityCount: number;
  mean: number;
  min: number;
  max: number;
}

export interface MCResult {
  iterations: number;
  /** Odbačeni uzorci (zbir zadatih opsega > 100%). */
  rejected: number;
  majority: number;
  lists: MCListStats[];
  groups: MCGroupStats[];
  warnings: string[];
  ms: number;
}

export function validateMCParams(p: MCParams): string[] {
  const errs: string[] = [];
  const ids = new Set(p.lists.map((l) => l.id));
  if (!Number.isInteger(p.iterations) || p.iterations < 1 || p.iterations > 1_000_000) errs.push('Broj simulacija mora biti između 1 i 1.000.000.');
  if (!Number.isInteger(p.totalVotes) || p.totalVotes < 1) errs.push('Ukupan broj glasova mora biti pozitivan ceo broj.');
  let minSum = 0;
  for (const r of p.ranges) {
    if (!ids.has(r.id)) errs.push('Opseg se odnosi na nepostojeću listu.');
    if (!Number.isFinite(r.minPercent) || !Number.isFinite(r.maxPercent) || r.minPercent < 0 || r.maxPercent > 100 || r.minPercent > r.maxPercent) {
      errs.push(`Neispravan opseg za listu "${p.lists.find((l) => l.id === r.id)?.name ?? r.id}".`);
    }
    minSum += Math.max(0, r.minPercent);
  }
  if (minSum > 100 + 1e-9) errs.push('Zbir minimalnih vrednosti opsega je veći od 100% — nijedan scenario nije moguć.');
  return errs;
}

export function runMonteCarloSimulation(p: MCParams, onProgress?: (done: number) => void): MCResult {
  const t0 = typeof performance !== 'undefined' ? performance.now() : Date.now();
  const errs = validateMCParams(p);
  if (errs.length) throw new Error(errs.join(' '));

  const { lists, settings } = p;
  const n = lists.length;
  const rand = mulberry32(p.seed);
  const rangeByIdx = lists.map((l) => p.ranges.find((r) => r.id === l.id) ?? null);
  const freeIdx = lists.map((_, i) => i).filter((i) => !rangeByIdx[i]);
  const freeWeights = freeIdx.map((i) => lists[i].votes);
  const freeWeightSum = freeWeights.reduce((a, b) => a + b, 0);
  const warnings: string[] = [];
  if (freeIdx.length === 0) warnings.push('Sve liste imaju opseg — rezultati se normalizuju na 100% u svakoj simulaciji.');
  else if (freeWeightSum === 0) warnings.push('Liste bez opsega imaju 0 glasova — ostatak se deli na jednake delove.');

  const majority = majorityOf(settings.seats);
  const sum = new Float64Array(n);
  const sumSq = new Float64Array(n);
  const sumPct = new Float64Array(n);
  const mins = new Array<number>(n).fill(Infinity);
  const maxs = new Array<number>(n).fill(-Infinity);
  const passed = new Array<number>(n).fill(0);
  const positive = new Array<number>(n).fill(0);
  const major = new Array<number>(n).fill(0);
  const hist = lists.map(() => new Array<number>(settings.seats + 1).fill(0));
  const groupIdx = p.groups.map((g) => g.ids.map((id) => lists.findIndex((l) => l.id === id)).filter((i) => i >= 0));
  const gMaj = new Array<number>(p.groups.length).fill(0);
  const gSum = new Float64Array(p.groups.length);
  const gMin = new Array<number>(p.groups.length).fill(Infinity);
  const gMax = new Array<number>(p.groups.length).fill(-Infinity);

  const pct = new Array<number>(n).fill(0);
  let rejected = 0;
  const maxRejected = p.iterations * 50;
  const base = p.totalVotes + (settings.thresholdBase === 'voters' ? settings.invalidBallots : 0);

  let done = 0;
  while (done < p.iterations) {
    let s = 0;
    for (let i = 0; i < n; i++) {
      const r = rangeByIdx[i];
      if (r) {
        pct[i] = r.minPercent + rand() * (r.maxPercent - r.minPercent);
        s += pct[i];
      } else pct[i] = 0;
    }
    if (freeIdx.length > 0 && s > 100) {
      rejected++;
      if (rejected > maxRejected) throw new Error('Previše odbačenih uzoraka — opsezi su takvi da je zbir gotovo uvek veći od 100%.');
      continue;
    }
    if (freeIdx.length > 0) {
      const rest = 100 - s;
      freeIdx.forEach((i, k) => (pct[i] = freeWeightSum > 0 ? (rest * freeWeights[k]) / freeWeightSum : rest / freeIdx.length));
    }
    const votes = apportionLargestRemainder(pct, p.totalVotes);
    const sim = lists.map((l, i) => ({ ...l, votes: votes[i] }));
    const seats = quickSeats(sim, settings);
    for (let i = 0; i < n; i++) {
      const k = seats[lists[i].id] ?? 0;
      sum[i] += k;
      sumSq[i] += k * k;
      sumPct[i] += (votes[i] / p.totalVotes) * 100;
      if (k < mins[i]) mins[i] = k;
      if (k > maxs[i]) maxs[i] = k;
      if (k > 0) positive[i]++;
      if (k >= majority) major[i]++;
      hist[i][k]++;
      if (!lists[i].isAggregate && passesThreshold(votes[i], base, settings.thresholdPercent)) passed[i]++;
    }
    groupIdx.forEach((idxs, g) => {
      const t = idxs.reduce((a, i) => a + (seats[lists[i].id] ?? 0), 0);
      gSum[g] += t;
      if (t < gMin[g]) gMin[g] = t;
      if (t > gMax[g]) gMax[g] = t;
      if (t >= majority) gMaj[g]++;
    });
    done++;
    if (onProgress && done % 2000 === 0) onProgress(done);
  }

  const N = p.iterations;
  return {
    iterations: N,
    rejected,
    majority,
    lists: lists.map((l, i) => {
      const mean = sum[i] / N;
      return {
        id: l.id,
        name: l.name,
        mean,
        min: mins[i],
        max: maxs[i],
        std: Math.sqrt(Math.max(0, sumSq[i] / N - mean * mean)),
        meanPercent: sumPct[i] / N,
        passedCount: passed[i],
        seatsPositiveCount: positive[i],
        majorityCount: major[i],
        histogram: hist[i],
      };
    }),
    groups: p.groups.map((g, k) => ({ name: g.name, ids: g.ids, majorityCount: gMaj[k], mean: gSum[k] / N, min: gMin[k], max: gMax[k] })),
    warnings,
    ms: (typeof performance !== 'undefined' ? performance.now() : Date.now()) - t0,
  };
}
