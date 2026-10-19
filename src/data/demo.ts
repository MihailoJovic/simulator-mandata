import type { ElectoralList } from '../types/election';
import { NEUTRAL_PALETTE } from '../utils/colors';

/**
 * DEMO PODACI — izmišljeni brojevi za isprobavanje simulatora.
 * NISU prognoza, istraživanje javnog mnjenja niti stvarni rezultat.
 */
export function demoLists(): ElectoralList[] {
  const rows: Array<[string, number, Partial<ElectoralList>?]> = [
    ['Studentska lista', 1_700_000],
    ['SNS/blok', 1_100_000],
    ['Evropska Srbija', 110_000],
    ['Desnica', 180_000],
    ['Manjinska lista (primer)', 45_000, { isMinority: true }],
    ['Ostali (zbirno)', 625_000, { isAggregate: true }],
  ];
  return rows.map(([name, votes, extra], i) => ({
    id: `demo_${i + 1}`,
    name,
    votes,
    isMinority: false,
    isAggregate: false,
    color: extra?.isAggregate ? NEUTRAL_PALETTE.aggregate : NEUTRAL_PALETTE.series[i % NEUTRAL_PALETTE.series.length],
    candidates: null,
    ...extra,
  }));
}

export const DEMO_TOTAL_VOTES = 3_760_000;
