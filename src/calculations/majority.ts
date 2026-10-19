import { majorityOf } from '../data/rules';

export interface MajorityResult {
  totalSeats: number;
  majority: number;
  groupSeats: number;
  hasMajority: boolean;
  /** Koliko mandata nedostaje do većine (0 ako je ima). */
  missing: number;
  /** Koliko mandata je iznad većine (0 ako je nema). */
  surplus: number;
}

/**
 * Zbir mandata izabranih lista i poređenje sa većinom (⌊S/2⌋ + 1 → 126 za 250).
 * Ovo je čisto aritmetički zbir — ne predstavlja političku procenu.
 */
export function calculateMajority(
  seatsByList: Record<string, number>,
  selectedIds: string[],
  totalSeats: number,
): MajorityResult {
  const majority = majorityOf(totalSeats);
  const unique = Array.from(new Set(selectedIds));
  const groupSeats = unique.reduce((a, id) => a + (seatsByList[id] ?? 0), 0);
  const hasMajority = groupSeats >= majority;
  return {
    totalSeats,
    majority,
    groupSeats,
    hasMajority,
    missing: hasMajority ? 0 : majority - groupSeats,
    surplus: hasMajority ? groupSeats - majority : 0,
  };
}
