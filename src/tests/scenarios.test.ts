import { describe, expect, it } from 'vitest';
import {
  calculateMajority,
  calculateMandates,
  compareScenarios,
  findThreshold,
  percentagesToVotes,
  quickSeats,
  runMonteCarloSimulation,
  runSensitivityAnalysis,
  setListShare,
  setListVotes,
  transferVotes,
  validateLists,
  validatePercentages,
} from '../calculations';
import { demoLists } from '../data/demo';
import { L, S, sumSeats } from './helpers';

const total = (ls: { votes: number }[]) => ls.reduce((a, l) => a + l.votes, 0);

describe('Regresija: Evropska Srbija tik ispod vs. tik iznad cenzusa', () => {
  const base = demoLists();
  const T = total(base); // 3.760.000 → 3% = 112.800
  const withES = (v: number) => setListVotes(base, 'demo_3', v, { kind: 'none' });

  it('ukupan broj glasova demo scenarija', () => {
    expect(T).toBe(3_760_000);
  });

  it('ES = 112.799 (ostali isti) — ispod cenzusa, 0 mandata', () => {
    const L1 = withES(112_799);
    const r = calculateMandates(L1, S());
    // osnova se menja: 3.760.000 − 110.000 + 112.799 = 3.762.799 → 3% = 112.883,97
    expect(r.statuses[2].passesThreshold).toBe(false);
    expect(r.seatsByList.demo_3).toBe(0);
  });

  it('ES tačno na granici: minimum za cenzus prelazi, minimum − 1 ne prelazi', () => {
    // nađi tačan minimum kada ostali ostaju isti
    let lo = 100_000;
    let hi = 130_000;
    while (hi - lo > 1) {
      const m = (lo + hi) >> 1;
      if (calculateMandates(withES(m), S()).statuses[2].passesThreshold) hi = m;
      else lo = m;
    }
    const below = calculateMandates(withES(hi - 1), S());
    const above = calculateMandates(withES(hi), S());
    expect(below.seatsByList.demo_3).toBe(0);
    expect(above.seatsByList.demo_3).toBeGreaterThan(0);
    expect(sumSeats(below.seatsByList)).toBe(250);
    expect(sumSeats(above.seatsByList)).toBe(250);
    // Prelazak ES preko cenzusa oduzima mandate drugim listama
    const lost = ['demo_1', 'demo_2', 'demo_4', 'demo_5'].reduce((a, id) => a + below.seatsByList[id] - above.seatsByList[id], 0);
    expect(lost).toBe(above.seatsByList.demo_3);
    // Snimak rezultata (regression snapshot)
    expect({ below: below.seatsByList, above: above.seatsByList }).toMatchSnapshot();
  });

  it('12. promena rezultata oko cenzusa preko udela (2,99% → 3,00%)', () => {
    const at299 = setListShare(base, 'demo_3', 2.99, { kind: 'proportional' });
    const at300 = setListShare(base, 'demo_3', 3.0, { kind: 'proportional' });
    expect(total(at299)).toBe(T);
    expect(total(at300)).toBe(T);
    expect(calculateMandates(at299, S()).seatsByList.demo_3).toBe(0);
    expect(calculateMandates(at300, S()).statuses[2].passesThreshold).toBe(true);
    expect(calculateMandates(at300, S()).seatsByList.demo_3).toBeGreaterThan(0);
  });
});

describe('13. Promena jednog glasa', () => {
  it('postoji tačka u kojoj +1 glas menja raspodelu, a zbir ostaje 250', () => {
    const lists = [L('A', 1_000_000), L('B', 700_000), L('C', 300_000)];
    const res = findThreshold({
      lists,
      settings: S(),
      variableId: 'b',
      adjustment: { kind: 'none' },
      goal: { listIds: ['b'], minSeats: 90 },
    });
    expect(res.found).toBe(true);
    const at = quickSeats(setListVotes(lists, 'b', res.votes, { kind: 'none' }), S());
    const before = quickSeats(setListVotes(lists, 'b', res.votes - 1, { kind: 'none' }), S());
    expect(at.b).toBeGreaterThanOrEqual(90);
    expect(before.b).toBeLessThan(90);
    expect(at.b - before.b).toBe(1);
    expect(sumSeats(at)).toBe(250);
    expect(sumSeats(before)).toBe(250);
  });

  it('dodavanje 1 glasa nikada ne menja raspodelu za više od 1 mandata po listi (bez prelaska cenzusa)', () => {
    let lists = [L('A', 1_234_567), L('B', 765_432), L('C', 234_567)];
    let prev = quickSeats(lists, S());
    for (let k = 0; k < 500; k++) {
      lists = setListVotes(lists, 'c', lists[2].votes + 37, { kind: 'none' });
      const cur = quickSeats(lists, S());
      expect(sumSeats(cur)).toBe(250);
      for (const id of ['a', 'b', 'c']) expect(Math.abs(cur[id] - prev[id])).toBeLessThanOrEqual(1);
      prev = cur;
    }
  });
});

describe('14. Prebacivanje glasova', () => {
  const lists = [L('A', 500_000), L('B', 300_000), L('C', 200_000)];

  it('apsolutno — ukupan broj ostaje isti', () => {
    const r = transferVotes(lists, 'c', 'a', 50_000);
    expect(r.error).toBeNull();
    expect(r.lists.map((l) => l.votes)).toEqual([550_000, 300_000, 150_000]);
    expect(total(r.lists)).toBe(total(lists));
  });

  it('procenat ukupnih glasova i procenat izvorne liste', () => {
    expect(transferVotes(lists, 'a', 'b', 1, 'percentOfTotal').moved).toBe(10_000);
    expect(transferVotes(lists, 'a', 'b', 10, 'percentOfSource').moved).toBe(50_000);
  });

  it('greška ako izvorna lista nema dovoljno glasova / ista lista', () => {
    expect(transferVotes(lists, 'c', 'a', 200_001).error).not.toBeNull();
    expect(transferVotes(lists, 'a', 'a', 1).error).not.toBeNull();
    expect(transferVotes(lists, 'a', 'b', -5).error).not.toBeNull();
    expect(transferVotes(lists, 'a', 'b', NaN).error).not.toBeNull();
  });

  it('posle prebacivanja zbir mandata je i dalje 250', () => {
    const r = transferVotes(lists, 'c', 'b', 190_000);
    expect(sumSeats(quickSeats(r.lists, S()))).toBe(250);
  });
});

describe('Većina', () => {
  it('većina = 126 od 250', () => {
    expect(calculateMajority({ a: 125 }, ['a'], 250)).toMatchObject({ majority: 126, hasMajority: false, missing: 1 });
    expect(calculateMajority({ a: 100, b: 28 }, ['a', 'b'], 250)).toMatchObject({ groupSeats: 128, hasMajority: true, surplus: 2 });
    expect(calculateMajority({ a: 126 }, ['a', 'a'], 250).groupSeats).toBe(126);
  });
});

describe('Poređenje scenarija', () => {
  it('računa razlike i ukupne zbirove', () => {
    const A = [L('Prva', 600_000), L('Druga', 400_000), L('Treća', 25_000)];
    const B = [L('Prva', 600_000), L('Druga', 400_000), L('treća ', 40_000, { id: 'x' })];
    const c = compareScenarios([
      { name: 'A', lists: A, settings: S() },
      { name: 'B', lists: B, settings: S() },
    ]);
    expect(c.totals).toEqual([250, 250]);
    expect(c.totalDiffs).toEqual([0, 0]);
    const tr = c.rows.find((r) => r.key === 'treća')!;
    expect(tr.seats[0]).toBe(0);
    expect(tr.seats[1]).toBeGreaterThan(0);
    expect(c.rows.reduce((a, r) => a + r.diffs[1], 0)).toBe(0);
  });
});

describe('Pronađi granicu', () => {
  it('minimalan broj glasova je tačan (v ispunjava, v − 1 ne)', () => {
    const lists = demoLists();
    const res = findThreshold({
      lists,
      settings: S(),
      variableId: 'demo_1',
      adjustment: { kind: 'proportional' },
      goal: { listIds: ['demo_1'], minSeats: 126 },
    });
    expect(res.found).toBe(true);
    const before = quickSeats(setListVotes(lists, 'demo_1', res.votes - 1, { kind: 'proportional' }), S());
    expect(res.seatsByList.demo_1).toBeGreaterThanOrEqual(126);
    expect(before.demo_1).toBeLessThan(126);
  });

  it('prijavljuje kada uslov nije dostižan', () => {
    const lists = [L('A', 500_000), L('B', 500_000)];
    const res = findThreshold({ lists, settings: S(), variableId: 'b', adjustment: { kind: 'from', sourceId: 'a' }, goal: { listIds: ['b'], minSeats: 251 } });
    expect(res.found).toBe(false);
  });
});

describe('Analiza osetljivosti', () => {
  it('generiše redove i označava prelazak cenzusa tačno jednom', () => {
    const rows = runSensitivityAnalysis({
      lists: demoLists(),
      settings: S(),
      variableId: 'demo_3',
      adjustment: { kind: 'proportional' },
      fromPercent: 2,
      toPercent: 5,
      stepPercent: 0.1,
      groupIds: ['demo_1', 'demo_4'],
    });
    expect(rows).toHaveLength(31);
    expect(rows.filter((r) => r.thresholdChange)).toHaveLength(1);
    const cross = rows.find((r) => r.thresholdChange)!;
    expect(cross.percent).toBe(3);
    rows.forEach((r) => expect(sumSeats(r.seats)).toBe(250));
    expect(rows[0].seats.demo_3).toBe(0);
    expect(rows[rows.length - 1].seats.demo_3).toBeGreaterThan(0);
  });

  it('odbija nevalidne parametre', () => {
    const base = { lists: demoLists(), settings: S(), variableId: 'demo_3', adjustment: { kind: 'none' as const }, groupIds: [] };
    expect(runSensitivityAnalysis({ ...base, fromPercent: 5, toPercent: 2, stepPercent: 0.1 })).toEqual([]);
    expect(runSensitivityAnalysis({ ...base, fromPercent: 0, toPercent: 5, stepPercent: 0 })).toEqual([]);
  });
});

describe('Monte Carlo', () => {
  const params = () => ({
    lists: demoLists(),
    settings: S(),
    ranges: [
      { id: 'demo_1', minPercent: 40, maxPercent: 45 },
      { id: 'demo_2', minPercent: 28, maxPercent: 33 },
      { id: 'demo_3', minPercent: 2, maxPercent: 4 },
      { id: 'demo_4', minPercent: 4, maxPercent: 7 },
    ],
    iterations: 2000,
    seed: 123,
    totalVotes: 3_760_000,
    groups: [{ name: 'S+D', ids: ['demo_1', 'demo_4'] }],
  });

  it('deterministički (isti seed → isti rezultat) i zbir proseka = 250', () => {
    const a = runMonteCarloSimulation(params());
    const b = runMonteCarloSimulation(params());
    expect(a.lists.map((l) => l.mean)).toEqual(b.lists.map((l) => l.mean));
    expect(a.lists.reduce((s, l) => s + l.mean, 0)).toBeCloseTo(250, 9);
    const es = a.lists.find((l) => l.id === 'demo_3')!;
    expect(es.passedCount).toBeGreaterThan(0);
    expect(es.passedCount).toBeLessThan(2000);
    expect(es.histogram.reduce((x, y) => x + y, 0)).toBe(2000);
    expect(a.groups[0].majorityCount).toBeGreaterThanOrEqual(0);
  });

  it('odbija nemoguće opsege', () => {
    const p = params();
    p.ranges[0].minPercent = 90;
    expect(() => runMonteCarloSimulation(p)).toThrow();
  });
});

describe('19. Validacija', () => {
  it('hvata nelogične unose', () => {
    const codes = (ls: Parameters<typeof validateLists>[0]) => validateLists(ls).map((i) => i.code);
    expect(codes([L('A', -1)])).toContain('votes-negative');
    expect(codes([L('A', NaN)])).toContain('votes-nan');
    expect(codes([L('A', Infinity)])).toContain('votes-inf');
    expect(codes([L('A', 1.5)])).toContain('votes-fraction');
    expect(codes([L('', 5)])).toContain('name-empty');
    expect(codes([L('A', 5, { id: 'x' }), L('B', 5, { id: 'x' })])).toContain('id-duplicate');
    expect(codes([L('A', 0)])).toContain('total-zero');
    expect(codes([])).toContain('no-lists');
    expect(codes([L('A', 5), L('a ', 6, { id: 'q' })])).toContain('name-duplicate');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(codes([L('A', undefined as any)])).toContain('votes-empty');
  });

  it('nevalidan unos daje ok:false i nikakve NaN vrednosti', () => {
    const r = calculateMandates([L('A', NaN)], S());
    expect(r.ok).toBe(false);
    expect(Number.isNaN(r.percentOutside)).toBe(false);
    expect(calculateMandates([L('A', 5)], S({ seats: 0 })).ok).toBe(false);
    expect(calculateMandates([L('A', 5)], S({ thresholdPercent: NaN })).ok).toBe(false);
  });

  it('procenti: normalizacija i upozorenje kada zbir nije 100%', () => {
    expect(validatePercentages([50, 30])[0].code).toBe('pct-sum');
    expect(validatePercentages([-1, 30])[0].code).toBe('pct-negative');
    const v = percentagesToVotes([50, 30, 10], 900_000);
    expect(total(v.map((votes) => ({ votes })))).toBe(900_000);
    expect(v).toEqual([500_000, 300_000, 100_000]);
    expect(total(percentagesToVotes([33.3, 33.3, 33.3], 1_000_001).map((votes) => ({ votes })))).toBe(1_000_001);
  });
});
