import { describe, expect, it } from 'vitest';
import { applyThreshold, calculateMandates, calculatePercentages, minVotesForThreshold, passesThreshold } from '../calculations';
import { L, S, sumSeats } from './helpers';

describe('Cenzus (čl. 128)', () => {
  const big = L('Velika', 970_000);

  it('4. lista ispod 3% ne učestvuje', () => {
    const r = calculateMandates([big, L('Mala', 29_999), L('Treća', 1)], S());
    expect(r.statuses.find((s) => s.id === 'mala')!.qualifies).toBe(false);
    expect(r.seatsByList.mala).toBe(0);
  });

  it('5. lista TAČNO na 3% prelazi cenzus (bez floating-point greške)', () => {
    const r = calculateMandates([big, L('Mala', 30_000)], S());
    expect(r.statuses.find((s) => s.id === 'mala')!.passesThreshold).toBe(true);
    expect(r.seatsByList.mala).toBeGreaterThan(0);
    // 0.1 + 0.2 ≠ 0.3 u float-u — tačna provera mora ipak raditi
    expect(passesThreshold(3, 100, 3)).toBe(true);
    expect(passesThreshold(30, 1000, 3)).toBe(true);
    expect(passesThreshold(29, 1000, 3)).toBe(false);
    expect(passesThreshold(1, 3, 33.333333)).toBe(true);
  });

  it('6. lista iznad 3% učestvuje', () => {
    const r = calculateMandates([big, L('Mala', 40_000)], S());
    expect(r.statuses.find((s) => s.id === 'mala')!.reason).toBe('passed');
  });

  it('7. više lista ispod cenzusa — glasovi van raspodele', () => {
    const r = calculateMandates([L('A', 900_000), L('B', 20_000), L('C', 25_000), L('D', 55_000)], S());
    expect(r.outsideLists.map((s) => s.id).sort()).toEqual(['b', 'c']);
    expect(r.votesOutside).toBe(45_000);
    expect(r.percentOutside).toBeCloseTo(4.5, 10);
    expect(sumSeats(r.seatsByList)).toBe(250);
  });

  it('osnova je broj birača koji su glasali (uključuje nevažeće listiće)', () => {
    const lists = [L('A', 970_000), L('B', 30_000)];
    expect(calculateMandates(lists, S({ invalidBallots: 0 })).statuses[1].passesThreshold).toBe(true);
    // 30.000 / 1.001.000 = 2,997% < 3%
    expect(calculateMandates(lists, S({ invalidBallots: 1_000 })).statuses[1].passesThreshold).toBe(false);
    // hipotetička osnova: samo važeći glasovi
    expect(calculateMandates(lists, S({ invalidBallots: 1_000, thresholdBase: 'valid' })).statuses[1].passesThreshold).toBe(true);
  });

  it('minimalan broj glasova za cenzus = ⌈3% × osnova⌉', () => {
    expect(minVotesForThreshold(1_000_000, 3)).toBe(30_000);
    expect(minVotesForThreshold(1_000_001, 3)).toBe(30_001);
    expect(minVotesForThreshold(3_760_000, 3)).toBe(112_800);
    expect(minVotesForThreshold(1000, 0)).toBe(0);
  });

  it('podesiv cenzus (0%, 5%, decimalni)', () => {
    const lists = [L('A', 900_000), L('B', 45_000), L('C', 55_000)];
    expect(calculateMandates(lists, S({ thresholdPercent: 5 })).statuses.map((s) => s.qualifies)).toEqual([true, false, true]);
    expect(calculateMandates(lists, S({ thresholdPercent: 0 })).statuses.map((s) => s.qualifies)).toEqual([true, true, true]);
    expect(calculateMandates(lists, S({ thresholdPercent: 4.5 })).statuses.map((s) => s.qualifies)).toEqual([true, true, true]);
    expect(calculateMandates(lists, S({ thresholdPercent: 4.51 })).statuses.map((s) => s.qualifies)).toEqual([true, false, true]);
  });

  it('čl. 128 st. 2: ako nijedna lista ne pređe prag, sve liste sa glasovima učestvuju', () => {
    const lists = Array.from({ length: 40 }, (_, i) => L(`L${i}`, 1000 + i));
    const r = calculateMandates(lists, S());
    expect(r.noListPassedApplied).toBe(true);
    expect(r.qualifiedCount).toBe(40);
    expect(r.totalSeatsAllocated).toBe(250);
    const off = calculateMandates(lists, S({ noListPassesFallback: false }));
    expect(off.qualifiedCount).toBe(0);
    expect(off.totalSeatsAllocated).toBe(0);
  });

  it('zbirna stavka ("Ostali") nikada ne učestvuje, ali ulazi u ukupan broj glasova', () => {
    const r = calculateMandates([L('A', 500_000), L('Ostali', 500_000, { isAggregate: true })], S());
    expect(r.seatsByList.ostali).toBe(0);
    expect(r.statuses[0].percentValid).toBe(50);
    expect(r.votesOutside).toBe(500_000);
  });

  it('procenti se računaju kao glasovi / ukupno × 100', () => {
    const p = calculatePercentages([L('A', 1), L('B', 3)], S());
    expect(p[0].percentValid).toBe(25);
    expect(p[1].percentValid).toBe(75);
  });
});

describe('Manjinske liste (čl. 140)', () => {
  it('manjinska lista ispod 3% učestvuje u raspodeli', () => {
    const r = calculateMandates([L('Velika', 980_000), L('Manjina', 20_000, { isMinority: true })], S());
    const st = r.statuses.find((s) => s.id === 'manjina')!;
    expect(st.passesThreshold).toBe(false);
    expect(st.qualifies).toBe(true);
    expect(st.reason).toBe('minority-exempt');
    expect(st.bonusApplied).toBe(true);
  });

  it('količnici manjinske liste ispod 3% se uvećavaju za 35% (20.000 × 1,35 = 27.000)', () => {
    const withBonus = calculateMandates([L('Velika', 980_000), L('Manjina', 20_000, { isMinority: true })], S());
    const equivalent = calculateMandates([L('Velika', 980_000), L('Manjina', 27_000)], S({ thresholdPercent: 0 }));
    expect(withBonus.seatsByList).toEqual(equivalent.seatsByList);
    const q = withBonus.dhondt!.ranked.find((x) => x.listId === 'manjina' && x.divisor === 1)!;
    expect(q.value.num / q.value.den).toBe(27_000);
  });

  it('manjinska lista sa ≥ 3% NE dobija uvećanje', () => {
    const r = calculateMandates([L('Velika', 950_000), L('Manjina', 50_000, { isMinority: true })], S());
    expect(r.statuses[1].reason).toBe('passed');
    expect(r.statuses[1].bonusApplied).toBe(false);
  });

  it('isključena manjinska pravila → manjinska lista se tretira kao obična', () => {
    const r = calculateMandates([L('Velika', 980_000), L('Manjina', 20_000, { isMinority: true })], S({ minorityRules: false }));
    expect(r.statuses[1].qualifies).toBe(false);
  });

  it('applyThreshold vraća statuse za sve liste', () => {
    const { statuses } = applyThreshold([L('A', 1), L('B', 0)], S());
    expect(statuses.map((s) => s.reason)).toEqual(['passed', 'no-votes']);
  });
});
