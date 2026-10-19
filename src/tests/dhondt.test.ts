import { describe, expect, it } from 'vitest';
import { calculateMandates, calculateDHondt, calculateDHondtNaive, quickSeats } from '../calculations';
import type { DHondtEntry } from '../calculations';
import { mulberry32 } from '../utils/prng';
import { L, S, sumSeats } from './helpers';

const entry = (id: string, votes: number, index = 0, mult: [number, number] = [1, 1]): DHondtEntry => ({
  id,
  index,
  votes,
  multNum: mult[0],
  multDen: mult[1],
  cap: null,
});

describe("D'Hondt — osnovni slučajevi", () => {
  it('1. jedna lista dobija svih 250 mandata', () => {
    const r = calculateMandates([L('A', 1000)], S());
    expect(r.ok).toBe(true);
    expect(r.seatsByList.a).toBe(250);
    expect(r.totalSeatsAllocated).toBe(250);
  });

  it('2. dve liste 3:2 → 150 : 100', () => {
    const r = calculateMandates([L('A', 600_000), L('B', 400_000)], S());
    expect(r.seatsByList).toEqual({ a: 150, b: 100 });
  });

  it('3. više lista — klasičan udžbenički primer (8 mandata)', () => {
    const r = calculateMandates(
      [L('A', 100_000), L('B', 80_000), L('C', 30_000), L('D', 20_000)],
      S({ seats: 8, thresholdPercent: 0 }),
    );
    expect(r.seatsByList).toEqual({ a: 4, b: 3, c: 1, d: 0 });
  });

  it('8. ekstremno neravnomerna raspodela', () => {
    const r = calculateMandates([L('A', 9_999_000), L('B', 1_000)], S({ thresholdPercent: 0 }));
    expect(r.seatsByList).toEqual({ a: 250, b: 0 });
    const r2 = calculateMandates([L('A', 9_960_000), L('B', 40_000)], S({ thresholdPercent: 0 }));
    // 40.000 / 1 = 40.000 = 9.960.000 / 249 → jednaki količnici, A ima više glasova → A
    expect(sumSeats(r2.seatsByList)).toBe(250);
  });

  it('10/11. ukupno tačno 250 mandata i zbir po listama = 250 (nasumični scenariji)', () => {
    const rnd = mulberry32(42);
    for (let t = 0; t < 300; t++) {
      const n = 2 + Math.floor(rnd() * 15);
      const lists = Array.from({ length: n }, (_, i) => L(`L${i}`, Math.floor(rnd() * 2_000_000)));
      const r = calculateMandates(lists, S());
      if (!r.ok) continue;
      if (r.qualifiedCount > 0) {
        expect(r.totalSeatsAllocated).toBe(250);
        expect(sumSeats(r.seatsByList)).toBe(250);
      }
    }
  });

  it('heap implementacija daje isti rezultat kao naivno "generiši sve i sortiraj"', () => {
    const rnd = mulberry32(7);
    for (let t = 0; t < 200; t++) {
      const n = 1 + Math.floor(rnd() * 12);
      const entries = Array.from({ length: n }, (_, i) => entry(`x${i}`, Math.floor(rnd() * 500_000), i));
      // ponekad namerno ista vrednost glasova
      if (n > 2 && rnd() < 0.3) entries[1].votes = entries[0].votes;
      const seats = 1 + Math.floor(rnd() * 250);
      expect(calculateDHondt(entries, seats).seatsByList).toEqual(calculateDHondtNaive(entries, seats));
    }
  });

  it('prikazuje 250. i 251. količnik', () => {
    const r = calculateMandates([L('A', 600_000), L('B', 400_000)], S());
    const d = r.dhondt!;
    expect(d.lastAwarded!.rank).toBe(250);
    expect(d.firstNotAwarded!.rank).toBe(251);
    // A/150 = 4000 i B/100 = 4000 su jednaki; A ima više glasova pa je ispred → 250. je B/100
    expect(d.lastAwarded!.listId).toBe('b');
    expect(d.lastAwarded!.divisor).toBe(100);
    expect(d.firstNotAwarded!.listId).toBe('a');
    expect(d.firstNotAwarded!.divisor).toBe(151);
    expect(d.ranked.filter((q) => q.awarded)).toHaveLength(250);
  });

  it('svaki mandat se može reprodukovati: rang je strogo nerastući po količniku', () => {
    const r = calculateMandates([L('A', 1_700_000), L('B', 1_100_000), L('C', 180_000)], S(), { extraQuotients: 50 });
    const q = r.dhondt!.ranked;
    for (let k = 1; k < q.length; k++) {
      expect(q[k - 1].value.num * q[k].value.den).toBeGreaterThanOrEqual(q[k].value.num * q[k - 1].value.den);
    }
  });

  it('delioci idu najviše do 250 (čl. 129)', () => {
    const r = calculateMandates([L('A', 1000)], S(), { extraQuotients: 10 });
    expect(Math.max(...r.dhondt!.ranked.map((q) => q.divisor))).toBe(250);
    expect(r.dhondt!.firstNotAwarded).toBeNull();
  });

  it('performanse: 100 lista se računa brzo', () => {
    const rnd = mulberry32(3);
    const lists = Array.from({ length: 100 }, (_, i) => L(`L${i}`, 10_000 + Math.floor(rnd() * 200_000)));
    const t0 = performance.now();
    for (let k = 0; k < 50; k++) quickSeats(lists, S({ thresholdPercent: 0 }));
    expect((performance.now() - t0) / 50).toBeLessThan(20);
  });
});

describe('9/20. Jednaki količnici (tie-breaking, čl. 129 st. 3)', () => {
  it('jednaki količnici na granici → prednost lista sa VIŠE glasova', () => {
    // A/2 = 3 = B/1 → poslednji (2.) mandat ide A jer ima više glasova
    const r = calculateMandates([L('B', 3), L('A', 6)], S({ seats: 2, thresholdPercent: 0 }));
    expect(r.seatsByList).toEqual({ a: 2, b: 0 });
    const tie = r.dhondt!.ties[0];
    expect(tie.atBoundary).toBe(true);
    expect(tie.resolvedByVotes).toBe(true);
    expect(tie.unresolvedByLaw).toBe(false);
  });

  it('jednaki količnici I jednaki glasovi → označeno kao NEREŠENO PO ZAKONU', () => {
    const r = calculateMandates([L('A', 100), L('B', 100)], S({ seats: 1, thresholdPercent: 0 }));
    expect(sumSeats(r.seatsByList)).toBe(1);
    expect(r.seatsByList.a).toBe(1); // pomoćno pravilo: redosled unosa
    expect(r.dhondt!.ties[0].unresolvedByLaw).toBe(true);
    expect(r.issues.some((i) => i.code === 'tie-unresolved')).toBe(true);
  });

  it('pomoćno pravilo "žreb" je determinističko za isti seed', () => {
    const lists = [L('A', 100), L('B', 100), L('C', 100)];
    const a = calculateMandates(lists, S({ seats: 1, thresholdPercent: 0, residualTieBreak: 'lot', lotSeed: 5 }));
    const b = calculateMandates(lists, S({ seats: 1, thresholdPercent: 0, residualTieBreak: 'lot', lotSeed: 5 }));
    expect(a.seatsByList).toEqual(b.seatsByList);
    expect(sumSeats(a.seatsByList)).toBe(1);
  });

  it('izjednačenje koje NE utiče na granicu se ne prijavljuje', () => {
    const r = calculateMandates([L('A', 6), L('B', 3)], S({ seats: 3, thresholdPercent: 0 }));
    expect(r.seatsByList).toEqual({ a: 2, b: 1 });
    expect(r.dhondt!.ties).toHaveLength(0);
  });
});

describe('Kandidati (čl. 129 st. 4)', () => {
  it('lista sa manje kandidata od mandata — višak ide sledećem količniku', () => {
    const r = calculateMandates([L('A', 900_000, { candidates: 100 }), L('B', 100_000)], S());
    expect(r.seatsByList).toEqual({ a: 100, b: 150 });
  });

  it('ako nema dovoljno kandidata ukupno, deo mandata ostaje nedodeljen', () => {
    const r = calculateMandates([L('A', 900_000, { candidates: 10 })], S());
    expect(r.seatsByList.a).toBe(10);
    expect(r.dhondt!.unallocated).toBe(240);
  });
});

describe('Precizna aritmetika', () => {
  it('veliki brojevi (BigInt rezerva) daju tačan rezultat', () => {
    const entries = [entry('a', 999_999_999, 0, [27, 20]), entry('b', 999_999_998, 1, [27, 20]), entry('c', 1_349_999_997, 2)];
    expect(calculateDHondt(entries, 250).seatsByList).toEqual(calculateDHondtNaive(entries, 250));
    expect(sumSeats(calculateDHondt(entries, 250).seatsByList)).toBe(250);
  });
});
