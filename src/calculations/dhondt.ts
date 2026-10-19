import type { DHondtResult, Quotient, ResidualTieBreak, TieInfo } from '../types/election';
import { compareProducts } from './rational';
import { hashString } from '../utils/prng';

/**
 * Ulaz za D'Hondt: jedna lista koja učestvuje u raspodeli.
 * Količnik za delilac d je:  votes · multNum / (d · multDen)
 * (multNum/multDen = 1 za obične liste, 27/20 za manjinske liste ispod praga).
 */
export interface DHondtEntry {
  id: string;
  /** Pozicija liste u unosu (koristi se samo za pomoćno pravilo 'input-order'). */
  index: number;
  votes: number;
  multNum: number;
  multDen: number;
  /** Najviše mandata (broj kandidata) ili null. */
  cap: number | null;
}

export interface DHondtOptions {
  residualTieBreak?: ResidualTieBreak;
  lotSeed?: number;
  /** Koliko NEDODELJENIH količnika zabeležiti posle poslednjeg dodeljenog (min. 1). */
  extraQuotients?: number;
  /** Ako je false, ne beleže se količnici (brzi režim za Monte Carlo / pretrage). */
  record?: boolean;
}

/**
 * Poredi trenutne količnike dve liste (a sa deliocem da, b sa deliocem db).
 * Vraća pozitivno ako a IMA PREDNOST.
 *  1) veći količnik (tačno, racionalno poređenje)
 *  2) čl. 129 st. 3 — isti količnik: prednost ima lista sa VIŠE GLASOVA
 *  3) nerešeno po zakonu — pomoćno pravilo (redosled unosa ili simulirani žreb)
 */
function makeComparator(
  entries: DHondtEntry[],
  tieRule: ResidualTieBreak,
  seed: number,
): (a: number, da: number, b: number, db: number) => number {
  const lotKey = entries.map((e) => hashString(`${seed}:${e.id}`));
  return (a, da, b, db) => {
    const A = entries[a];
    const B = entries[b];
    // qa = A.votes·A.multNum / (da·A.multDen); qb analogno. qa ? qb  ⇔  A.votes·A.multNum·db·B.multDen ? B.votes·B.multNum·da·A.multDen
    const c = compareProducts(A.votes * A.multNum, db * B.multDen, B.votes * B.multNum, da * A.multDen);
    if (c !== 0) return c;
    if (A.votes !== B.votes) return A.votes > B.votes ? 1 : -1;
    if (tieRule === 'lot' && lotKey[a] !== lotKey[b]) return lotKey[a] < lotKey[b] ? 1 : -1;
    return A.index < B.index ? 1 : A.index > B.index ? -1 : 0;
  };
}

/** Da li su dva količnika numerički jednaka (bez obzira na tie-break). */
function sameQuotient(entries: DHondtEntry[], a: number, da: number, b: number, db: number): boolean {
  const A = entries[a];
  const B = entries[b];
  return compareProducts(A.votes * A.multNum, db * B.multDen, B.votes * B.multNum, da * A.multDen) === 0;
}

/**
 * D'Hondt (sistem najvećeg količnika), čl. 129.
 *
 * Umesto generisanja svih n × 250 količnika i sortiranja, koristi se max-heap:
 * u svakom trenutku heap sadrži SLEDEĆI količnik svake liste. Pošto je niz
 * votes/1, votes/2, … strogo opadajući, k-ti izvađeni element je tačno k-ti
 * najveći količnik od svih — rezultat je IDENTIČAN klasičnom "generiši i sortiraj"
 * postupku, uz složenost O((S + extra) · log n).
 */
export function calculateDHondt(entries: DHondtEntry[], seats: number, opts: DHondtOptions = {}): DHondtResult {
  const tieRule = opts.residualTieBreak ?? 'input-order';
  const record = opts.record ?? true;
  const extra = Math.max(1, opts.extraQuotients ?? 1);
  const cmp = makeComparator(entries, tieRule, opts.lotSeed ?? 0);

  const n = entries.length;
  const seatsArr = new Array<number>(n).fill(0);
  const divisor = new Array<number>(n).fill(1);

  // Max-heap indeksa lista.
  const heap: number[] = [];
  const better = (i: number, j: number) => cmp(heap[i], divisor[heap[i]], heap[j], divisor[heap[j]]) > 0;
  const swap = (i: number, j: number) => {
    const t = heap[i];
    heap[i] = heap[j];
    heap[j] = t;
  };
  const up = (i: number) => {
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (!better(i, p)) break;
      swap(i, p);
      i = p;
    }
  };
  const down = (i: number) => {
    for (;;) {
      const l = 2 * i + 1;
      const r = l + 1;
      let m = i;
      if (l < heap.length && better(l, m)) m = l;
      if (r < heap.length && better(r, m)) m = r;
      if (m === i) break;
      swap(i, m);
      i = m;
    }
  };
  const pop = (): number => {
    const top = heap[0];
    const last = heap.pop()!;
    if (heap.length) {
      heap[0] = last;
      down(0);
    }
    return top;
  };
  const push = (x: number) => {
    heap.push(x);
    up(heap.length - 1);
  };

  for (let i = 0; i < n; i++) {
    if (entries[i].votes > 0 && (entries[i].cap === null || entries[i].cap! > 0)) push(i);
  }

  const ranked: Quotient[] = [];
  const makeQ = (i: number, d: number, awarded: boolean): Quotient => {
    const e = entries[i];
    const num = e.votes * e.multNum;
    const den = d * e.multDen;
    return {
      rank: ranked.length + 1,
      listId: e.id,
      listIndex: e.index,
      votes: e.votes,
      divisor: d,
      value: { num, den },
      approx: num / den,
      awarded,
      skippedNoCandidates: false,
      tiedWithNeighbor: false,
    };
  };

  let lastIdx = -1;
  let lastDiv = 0;
  let allocated = 0;

  while (allocated < seats && heap.length) {
    const i = pop();
    const d = divisor[i];
    seatsArr[i]++;
    allocated++;
    if (record) ranked.push(makeQ(i, d, true));
    lastIdx = i;
    lastDiv = d;
    divisor[i] = d + 1;
    // Zakon: delioci od 1 do 250 (= broj mandata). Lista sa dostignutim brojem kandidata
    // izlazi iz raspodele (čl. 129 st. 4) — mandat ide sledećem najvećem količniku.
    const capped = entries[i].cap !== null && seatsArr[i] >= entries[i].cap!;
    if (divisor[i] <= seats && !capped) push(i);
  }

  // Prvi neizabrani količnik(i) + otkrivanje izjednačenja na granici.
  let firstNotIdx = -1;
  let firstNotDiv = 0;
  const notAwarded: Array<[number, number]> = [];
  if (heap.length) {
    // Beležimo najmanje `extra` količnika, plus sve koji su jednaki poslednjem dodeljenom.
    while (heap.length) {
      const i = heap[0];
      const d = divisor[i];
      const equalToLast = lastIdx >= 0 && sameQuotient(entries, i, d, lastIdx, lastDiv);
      if (notAwarded.length >= extra && !equalToLast) break;
      pop();
      notAwarded.push([i, d]);
      if (record) ranked.push(makeQ(i, d, false));
      divisor[i] = d + 1;
      if (divisor[i] <= seats) push(i);
    }
    if (notAwarded.length) [firstNotIdx, firstNotDiv] = notAwarded[0];
  }

  const ties: TieInfo[] = [];
  if (lastIdx >= 0 && firstNotIdx >= 0 && sameQuotient(entries, lastIdx, lastDiv, firstNotIdx, firstNotDiv)) {
    const winner = entries[lastIdx];
    const loser = entries[firstNotIdx];
    const resolvedByVotes = winner.votes !== loser.votes;
    // Sve liste u grupi izjednačenja oko granice.
    const group = new Set<string>([winner.id]);
    for (const [i, d] of notAwarded) if (sameQuotient(entries, i, d, lastIdx, lastDiv)) group.add(entries[i].id);
    if (record) {
      for (const q of ranked) {
        if (compareProducts(q.value.num, lastDiv * winner.multDen, winner.votes * winner.multNum, q.value.den) === 0) {
          group.add(q.listId);
        }
      }
    }
    ties.push({
      atBoundary: true,
      resolvedByVotes,
      unresolvedByLaw: !resolvedByVotes,
      listIds: [...group],
      description: resolvedByVotes
        ? 'Poslednji mandat: količnici su jednaki — prednost ima lista sa većim brojem glasova (čl. 129 st. 3).'
        : `Poslednji mandat: jednaki su i količnici i broj glasova. Zakon ovaj slučaj NE propisuje — simulator je primenio pomoćno pravilo "${
            tieRule === 'lot' ? 'simulirani žreb' : 'redosled unosa'
          }". Rezultat za ovaj mandat nije jednoznačno određen zakonom.`,
    });
  }

  // Oznaka izjednačenja među susedima (samo za prikaz).
  if (record) {
    for (let k = 0; k + 1 < ranked.length; k++) {
      const a = ranked[k];
      const b = ranked[k + 1];
      if (a.listId !== b.listId && compareProducts(a.value.num, b.value.den, b.value.num, a.value.den) === 0) {
        a.tiedWithNeighbor = true;
        b.tiedWithNeighbor = true;
      }
    }
  }

  const seatsByList: Record<string, number> = {};
  entries.forEach((e, i) => (seatsByList[e.id] = seatsArr[i]));

  const awardedQs = record ? ranked.filter((q) => q.awarded) : [];
  const lastAwarded = awardedQs.length ? awardedQs[awardedQs.length - 1] : null;
  const firstNotAwarded = record ? ranked.find((q) => !q.awarded) ?? null : null;

  return {
    seatsByList,
    ranked,
    lastAwarded,
    firstNotAwarded,
    ties,
    unallocated: seats - allocated,
  };
}

/**
 * Referentna (naivna) implementacija: generiše SVE količnike votes/d za d = 1..seats,
 * sortira ih i uzima prvih `seats`. Koristi se u testovima za proveru heap verzije.
 */
export function calculateDHondtNaive(entries: DHondtEntry[], seats: number): Record<string, number> {
  const all: Array<{ i: number; d: number }> = [];
  entries.forEach((e, i) => {
    if (e.votes <= 0) return;
    for (let d = 1; d <= seats; d++) all.push({ i, d });
  });
  const cmp = makeComparator(entries, 'input-order', 0);
  all.sort((x, y) => -cmp(x.i, x.d, y.i, y.d));
  const res: Record<string, number> = {};
  entries.forEach((e) => (res[e.id] = 0));
  for (let k = 0; k < Math.min(seats, all.length); k++) res[entries[all[k].i].id]++;
  return res;
}
