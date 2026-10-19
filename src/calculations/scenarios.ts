import type { ElectionSettings, ElectoralList } from '../types/election';
import { calculateMandates } from './mandates';

export interface ScenarioInput {
  name: string;
  lists: ElectoralList[];
  settings: ElectionSettings;
}

export interface ComparisonRow {
  /** Normalizovan naziv (ključ za uparivanje lista između scenarija). */
  key: string;
  name: string;
  /** Mandati po scenariju; null = lista ne postoji u tom scenariju. */
  seats: Array<number | null>;
  votes: Array<number | null>;
  /** Razlika u odnosu na PRVI scenario (null ako lista ne postoji u nekom od njih → računa se kao 0). */
  diffs: number[];
}

export interface ComparisonResult {
  names: string[];
  rows: ComparisonRow[];
  totals: number[];
  totalDiffs: number[];
  /** Scenariji sa nevalidnim ulazom (indeksi). */
  invalid: number[];
}

export const normalizeName = (s: string) => s.trim().replace(/\s+/g, ' ').toLocaleLowerCase('sr');

/**
 * Poredi mandate više scenarija. Liste se uparuju po NAZIVU (bez obzira na
 * velika/mala slova i višestruke razmake), jer ID-jevi mogu da se razlikuju
 * između uvezenih scenarija. Razlike se računaju u odnosu na prvi scenario.
 */
export function compareScenarios(scenarios: ScenarioInput[]): ComparisonResult {
  const results = scenarios.map((s) => calculateMandates(s.lists, s.settings, { record: false }));
  const order: string[] = [];
  const display = new Map<string, string>();
  scenarios.forEach((s) =>
    s.lists.forEach((l) => {
      const k = normalizeName(l.name);
      if (!display.has(k)) {
        display.set(k, l.name.trim());
        order.push(k);
      }
    }),
  );

  const rows: ComparisonRow[] = order.map((key) => {
    const seats = scenarios.map((s, i) => {
      if (!results[i].ok) return null;
      const matching = s.lists.filter((l) => normalizeName(l.name) === key);
      if (!matching.length) return null;
      return matching.reduce((a, l) => a + (results[i].seatsByList[l.id] ?? 0), 0);
    });
    const votes = scenarios.map((s) => {
      const matching = s.lists.filter((l) => normalizeName(l.name) === key);
      return matching.length ? matching.reduce((a, l) => a + l.votes, 0) : null;
    });
    const base = seats[0] ?? 0;
    return { key, name: display.get(key)!, seats, votes, diffs: seats.map((x) => (x ?? 0) - base) };
  });

  const totals = results.map((r) => (r.ok ? r.totalSeatsAllocated : 0));
  return {
    names: scenarios.map((s) => s.name),
    rows,
    totals,
    totalDiffs: totals.map((t) => t - totals[0]),
    invalid: results.map((r, i) => (r.ok ? -1 : i)).filter((i) => i >= 0),
  };
}
