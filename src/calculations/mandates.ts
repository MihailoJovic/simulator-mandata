import type { ElectionResult, ElectionSettings, ElectoralList } from '../types/election';
import { applyThreshold, minVotesForThreshold, thresholdBaseVotes, totalValidVotes } from './threshold';
import { calculateDHondt, type DHondtEntry } from './dhondt';
import { bonusMultiplier } from './rational';
import { validateLists, validateSettings } from './validation';

export interface CalculateOptions {
  /** Koliko nedodeljenih količnika zabeležiti za prikaz (podrazumevano 10). */
  extraQuotients?: number;
  /** Brzi režim bez beleženja količnika (Monte Carlo, pretrage). */
  record?: boolean;
  /** Preskoči validaciju (samo za interne petlje gde je ulaz već validiran). */
  skipValidation?: boolean;
}

const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());

/** Pravi ulaz za D'Hondt od lista koje učestvuju u raspodeli. */
export function buildDHondtEntries(
  lists: ElectoralList[],
  qualifies: boolean[],
  bonus: boolean[],
  s: ElectionSettings,
): DHondtEntry[] {
  const mult = bonusMultiplier(s.minorityBonusPercent);
  const entries: DHondtEntry[] = [];
  lists.forEach((l, i) => {
    if (!qualifies[i]) return;
    entries.push({
      id: l.id,
      index: i,
      votes: l.votes,
      multNum: bonus[i] ? mult.num : 1,
      multDen: bonus[i] ? mult.den : 1,
      cap: l.candidates ?? null,
    });
  });
  return entries;
}

/**
 * Kompletan obračun: procenti → cenzus → D'Hondt → mandati po listama.
 * Nikada ne baca izuzetak za nevalidan ulaz — vraća `ok: false` i listu grešaka.
 */
export function calculateMandates(
  lists: ElectoralList[],
  settings: ElectionSettings,
  opts: CalculateOptions = {},
): ElectionResult {
  const t0 = now();
  const issues = opts.skipValidation ? [] : [...validateSettings(settings), ...validateLists(lists)];
  const hasError = issues.some((i) => i.level === 'error');

  const empty: ElectionResult = {
    ok: false,
    issues,
    settings,
    totalValidVotes: 0,
    votersWhoVoted: 0,
    thresholdBaseVotes: 0,
    minVotesToPass: 0,
    statuses: [],
    dhondt: null,
    seatsByList: {},
    totalSeatsAllocated: 0,
    votesOutside: 0,
    percentOutside: 0,
    outsideLists: [],
    qualifiedCount: 0,
    disqualifiedCount: 0,
    noListPassedApplied: false,
    computeMs: 0,
  };
  if (hasError) return { ...empty, computeMs: now() - t0 };

  const valid = totalValidVotes(lists);
  const base = thresholdBaseVotes(lists, settings);
  const { statuses, noListPassedApplied } = applyThreshold(lists, settings);

  const entries = buildDHondtEntries(
    lists,
    statuses.map((s) => s.qualifies),
    statuses.map((s) => s.bonusApplied),
    settings,
  );

  const dhondt = calculateDHondt(entries, settings.seats, {
    residualTieBreak: settings.residualTieBreak,
    lotSeed: settings.lotSeed,
    extraQuotients: opts.extraQuotients ?? 10,
    record: opts.record ?? true,
  });

  const seatsByList: Record<string, number> = {};
  let totalSeatsAllocated = 0;
  for (const l of lists) {
    const s = dhondt.seatsByList[l.id] ?? 0;
    seatsByList[l.id] = s;
    totalSeatsAllocated += s;
  }

  const outsideLists = statuses.filter((s) => !s.qualifies);
  const votesOutside = outsideLists.reduce((a, s) => a + s.votes, 0);

  if (entries.length === 0) {
    issues.push({ level: 'warning', code: 'no-qualified', message: 'Nijedna lista ne učestvuje u raspodeli mandata.' });
  }
  if (dhondt.unallocated > 0) {
    issues.push({
      level: 'warning',
      code: 'unallocated',
      message: `${dhondt.unallocated} mandat(a) nije moguće dodeliti (nema dovoljno lista/kandidata).`,
    });
  }
  if (noListPassedApplied) {
    issues.push({
      level: 'warning',
      code: 'no-list-passed',
      message: 'Nijedna lista nije prešla cenzus — sve liste sa glasovima učestvuju u raspodeli (čl. 128 st. 2).',
    });
  }
  for (const t of dhondt.ties) {
    issues.push({ level: 'warning', code: t.unresolvedByLaw ? 'tie-unresolved' : 'tie-votes', message: t.description });
  }

  return {
    ok: true,
    issues,
    settings,
    totalValidVotes: valid,
    votersWhoVoted: valid + settings.invalidBallots,
    thresholdBaseVotes: base,
    minVotesToPass: minVotesForThreshold(base, settings.thresholdPercent),
    statuses,
    dhondt,
    seatsByList,
    totalSeatsAllocated,
    votesOutside,
    percentOutside: valid > 0 ? (votesOutside / valid) * 100 : 0,
    outsideLists,
    qualifiedCount: entries.length,
    disqualifiedCount: statuses.length - entries.length,
    noListPassedApplied,
    computeMs: now() - t0,
  };
}

/** Brz obračun samo broja mandata (bez beleženja količnika i bez validacije). */
export function quickSeats(lists: ElectoralList[], settings: ElectionSettings): Record<string, number> {
  return calculateMandates(lists, settings, { record: false, skipValidation: true }).seatsByList;
}
