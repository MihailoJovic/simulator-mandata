import type { ElectoralList } from '../types/election';
import { mulberry32, hashString } from '../utils/prng';

/**
 * ILUSTRATIVNA animacija "izborne noći".
 * Ne predstavlja stvarni tok prebrojavanja niti bilo kakvu prognozu: svaka lista
 * dobija nasumičnu (seed) "brzinu" pristizanja glasova, tako da se međurezultati
 * razlikuju od konačnog, a na 100% prebrojanih glasova se TAČNO poklapaju sa
 * konačnim unosom korisnika.
 *
 * counted_i(p) = round(final_i · p^e_i), e_i ∈ [0.6, 1.6]; za p = 1 → final_i.
 */
export function partialCount(lists: ElectoralList[], progress: number, seed: number): ElectoralList[] {
  const p = Math.min(1, Math.max(0, Number.isFinite(progress) ? progress : 0));
  if (p >= 1) return lists;
  return lists.map((l) => {
    const rnd = mulberry32(hashString(`${seed}:${l.id}`));
    const e = 0.6 + rnd() * 1.0;
    return { ...l, votes: Math.round(l.votes * Math.pow(p, e)) };
  });
}
