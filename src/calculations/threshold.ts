import type { ElectionSettings, ElectoralList, ListStatus, QualificationReason } from '../types/election';
import { decimalToRational } from './rational';

export interface PercentageRow {
  id: string;
  votes: number;
  /** Procenat od važećih glasova. */
  percentValid: number;
  /** Procenat od osnove za cenzus. */
  percentOfBase: number;
}

export function totalValidVotes(lists: ElectoralList[]): number {
  let t = 0;
  for (const l of lists) t += l.votes;
  return t;
}

/** Osnova za cenzus: birači koji su glasali (zakon) ili samo važeći glasovi. */
export function thresholdBaseVotes(lists: ElectoralList[], s: ElectionSettings): number {
  const valid = totalValidVotes(lists);
  return s.thresholdBase === 'voters' ? valid + s.invalidBallots : valid;
}

/**
 * Procenat svake liste. Vrednosti su SAMO za prikaz — odluke o cenzusu se
 * donose tačnom celobrojnom proverom (vidi passesThreshold).
 */
export function calculatePercentages(lists: ElectoralList[], s: ElectionSettings): PercentageRow[] {
  const valid = totalValidVotes(lists);
  const base = thresholdBaseVotes(lists, s);
  return lists.map((l) => ({
    id: l.id,
    votes: l.votes,
    percentValid: valid > 0 ? (l.votes / valid) * 100 : 0,
    percentOfBase: base > 0 ? (l.votes / base) * 100 : 0,
  }));
}

/**
 * TAČNA provera: votes / base ≥ t%  ⇔  votes · 100 · t.den ≥ t.num · base.
 * Koristi BigInt — bez floating-point grešaka (npr. tačno 3,000% prelazi).
 */
export function passesThreshold(votes: number, base: number, thresholdPercent: number): boolean {
  const t = decimalToRational(thresholdPercent);
  if (!t || base <= 0) return false;
  return BigInt(votes) * 100n * BigInt(t.den) >= BigInt(t.num) * BigInt(base);
}

/** Najmanji ceo broj glasova potreban za prelazak cenzusa: ⌈t · base / 100⌉. */
export function minVotesForThreshold(base: number, thresholdPercent: number): number {
  const t = decimalToRational(thresholdPercent);
  if (!t || base <= 0) return 0;
  const n = BigInt(t.num) * BigInt(base);
  const d = 100n * BigInt(t.den);
  return Number((n + d - 1n) / d);
}

/**
 * Primenjuje izborni prag (čl. 128) i pravila za manjinske liste (čl. 140).
 */
export function applyThreshold(
  lists: ElectoralList[],
  s: ElectionSettings,
): { statuses: ListStatus[]; noListPassedApplied: boolean } {
  const pct = calculatePercentages(lists, s);
  const base = thresholdBaseVotes(lists, s);

  const passes = lists.map((l) => !l.isAggregate && l.votes > 0 && passesThreshold(l.votes, base, s.thresholdPercent));
  const anyPassed = passes.some(Boolean);
  const noListPassedApplied = s.noListPassesFallback && !anyPassed;

  const statuses: ListStatus[] = lists.map((l, i) => {
    let reason: QualificationReason;
    let qualifies = false;
    let bonusApplied = false;
    const isMinority = s.minorityRules && l.isMinority;

    if (l.isAggregate) {
      reason = 'aggregate';
    } else if (l.votes <= 0) {
      reason = 'no-votes';
    } else if (passes[i]) {
      reason = 'passed';
      qualifies = true;
    } else if (isMinority) {
      // čl. 140 st. 1 i 2: manjinska lista ispod praga učestvuje, uz uvećanje količnika.
      reason = 'minority-exempt';
      qualifies = true;
      bonusApplied = s.minorityBonusPercent > 0;
    } else if (noListPassedApplied) {
      reason = 'no-list-passed';
      qualifies = true;
    } else {
      reason = 'below-threshold';
    }

    return {
      id: l.id,
      name: l.name,
      votes: l.votes,
      percentValid: pct[i].percentValid,
      percentOfBase: pct[i].percentOfBase,
      passesThreshold: passes[i],
      qualifies,
      reason,
      bonusApplied,
      isMinority: l.isMinority,
      isAggregate: l.isAggregate,
    };
  });

  return { statuses, noListPassedApplied };
}
