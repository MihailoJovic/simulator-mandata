import { describe, expect, it } from 'vitest';
import { calculateMandates } from '../calculations';
import { demoLists } from '../data/demo';
import { decodeShare, encodeShare, parseScenarioFile, resultsToCsv, scenarioToFile } from '../utils/serialization';
import { initialDemoState, reducer } from '../hooks/useSimulator';
import { parseDecimal, parseVotes } from '../utils/parse';
import { fmtInt, fmtPct, fmtQuotient } from '../utils/format';
import { S } from './helpers';

describe('Import / Export', () => {
  it('JSON export → import vraća iste liste i podešavanja', () => {
    const lists = demoLists();
    const r = calculateMandates(lists, S({ thresholdPercent: 4 }));
    const file = scenarioToFile({ id: 'x', name: 'Test', createdAt: '2026-01-01T00:00:00.000Z', lists, settings: S({ thresholdPercent: 4 }), inputMode: 'votes' }, r);
    expect(file.lists[0].seats).toBe(r.seatsByList.demo_1);
    expect(file.results?.totalSeatsAllocated).toBe(250);
    const back = parseScenarioFile(JSON.stringify(file));
    expect(back.name).toBe('Test');
    expect(back.settings.thresholdPercent).toBe(4);
    expect(back.lists.map((l) => [l.name, l.votes, l.isMinority, l.isAggregate])).toEqual(lists.map((l) => [l.name, l.votes, l.isMinority, l.isAggregate]));
  });

  it('import odbija neispravan JSON i sanitizuje podatke', () => {
    expect(() => parseScenarioFile('nije json')).toThrow();
    expect(() => parseScenarioFile('{"a":1}')).toThrow();
    const sc = parseScenarioFile(JSON.stringify({ lists: [{ id: 'a', name: 'A', votes: 5, color: 'javascript:alert(1)' }, { id: 'a', name: 'B', votes: 'x' }] }));
    expect(sc.lists[0].color).toMatch(/^#[0-9a-f]{6}$/i);
    expect(sc.lists[1].id).not.toBe('a'); // duplikat ID-ja razrešen
    expect(Number.isNaN(sc.lists[1].votes)).toBe(true); // validacija će prijaviti grešku
    expect(calculateMandates(sc.lists, sc.settings).ok).toBe(false);
  });

  it('CSV sadrži zaglavlje, sve liste i ukupno', () => {
    const lists = demoLists();
    const csv = resultsToCsv(lists, calculateMandates(lists, S()));
    const rows = csv.replace('﻿', '').split('\r\n');
    expect(rows[0]).toContain('Mandati');
    expect(rows).toHaveLength(lists.length + 2);
    expect(rows[rows.length - 1]).toContain('250');
    expect(csv).not.toMatch(/NaN|undefined|Infinity/);
  });

  it('URL deljenje: encode → decode', () => {
    const lists = demoLists();
    const token = encodeShare('Šta ako — ćčžšđ', lists, S({ invalidBallots: 10 }), 'percent');
    expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
    const sc = decodeShare(token)!;
    expect(sc.name).toBe('Šta ako — ćčžšđ');
    expect(sc.inputMode).toBe('percent');
    expect(sc.settings.invalidBallots).toBe(10);
    expect(sc.lists.map((l) => l.votes)).toEqual(lists.map((l) => l.votes));
    expect(sc.lists[4].isMinority).toBe(true);
    expect(sc.lists[5].isAggregate).toBe(true);
    expect(decodeShare('neispravno!!')).toBeNull();
  });
});

describe('Stanje aplikacije (reducer)', () => {
  it('unos po procentima normalizuje na zadati ukupan broj glasova', () => {
    let s = initialDemoState();
    s = reducer(s, { type: 'setInputMode', mode: 'percent' });
    s = reducer(s, { type: 'setPercentTotal', value: 1_000_000 });
    s.lists.forEach((l) => (s = reducer(s, { type: 'setPercent', id: l.id, value: 10 }))); // zbir 60% → normalizacija
    const total = s.lists.reduce((a, l) => a + l.votes, 0);
    expect(total).toBe(1_000_000);
    expect(new Set(s.lists.map((l) => l.votes)).size).toBeLessThanOrEqual(2); // jednaki (± 1 zbog ostatka)
  });

  it('dodaj / obriši / obriši sve / reset', () => {
    let s = initialDemoState();
    s = reducer(s, { type: 'addList' });
    expect(s.lists).toHaveLength(7);
    s = reducer(s, { type: 'removeList', id: s.lists[6].id });
    expect(s.lists).toHaveLength(6);
    s = reducer(s, { type: 'clearAll' });
    expect(s.lists).toHaveLength(0);
    s = reducer(s, { type: 'reset' });
    expect(s.isDemo).toBe(true);
    expect(s.lists).toHaveLength(6);
  });

  it('nasumičan scenario je validan i daje 250 mandata', () => {
    for (let seed = 1; seed < 30; seed++) {
      const s = reducer(initialDemoState(), { type: 'randomize', seed });
      const r = calculateMandates(s.lists, s.settings);
      expect(r.ok).toBe(true);
      expect(r.totalSeatsAllocated).toBe(250);
    }
    const empty = reducer(reducer(initialDemoState(), { type: 'clearAll' }), { type: 'randomize', seed: 3 });
    expect(empty.lists.length).toBeGreaterThan(0);
  });
});

describe('Parsiranje i formatiranje', () => {
  it('parsira srpski i međunarodni format', () => {
    expect(parseVotes('1.700.000')).toEqual({ ok: true, value: 1_700_000 });
    expect(parseVotes('1 700 000')).toEqual({ ok: true, value: 1_700_000 });
    expect(parseVotes('-5').ok).toBe(false);
    expect(parseVotes('').ok).toBe(false);
    expect(parseVotes('12,5').ok).toBe(false);
    expect(parseVotes('abc').ok).toBe(false);
    expect(parseDecimal('2,9')).toEqual({ ok: true, value: 2.9 });
    expect(parseDecimal('3.00%')).toEqual({ ok: true, value: 3 });
    expect(parseDecimal('101', { max: 100 }).ok).toBe(false);
  });

  it('nikada ne prikazuje NaN / Infinity / undefined', () => {
    for (const v of [NaN, Infinity, -Infinity, undefined, null, 'x']) {
      expect(fmtInt(v)).toBe('—');
      expect(fmtPct(v)).toBe('—');
    }
    expect(fmtQuotient(1, 0)).toBe('—');
  });
});
