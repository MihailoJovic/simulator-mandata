import { describe, expect, it } from 'vitest';
import { assignSeats, hemicycleLayout } from '../utils/hemicycle';
import { partialCount } from '../calculations/electionNight';
import { calculateMandates } from '../calculations';
import { averagePolls, pollToScenario } from '../components/PollsPanel';
import { demoLists } from '../data/demo';
import { S } from './helpers';

describe('Polukrug skupštine', () => {
  it.each([1, 5, 50, 126, 250, 400])('raspoređuje tačno %i mesta bez preklapanja', (n) => {
    const { seats, seatRadius } = hemicycleLayout(n);
    expect(seats).toHaveLength(n);
    for (const s of seats) {
      expect(Number.isFinite(s.x) && Number.isFinite(s.y)).toBe(true);
      expect(s.y).toBeLessThanOrEqual(1e-9); // gornja polovina
    }
    // nijedna dva mesta se ne preklapaju
    for (let i = 0; i < seats.length; i++)
      for (let j = i + 1; j < seats.length; j++) {
        const d = Math.hypot(seats[i].x - seats[j].x, seats[i].y - seats[j].y);
        expect(d).toBeGreaterThan(seatRadius * 2 - 1e-9);
      }
  });

  it('mesta su poređana s leva na desno', () => {
    const { seats } = hemicycleLayout(250);
    for (let i = 1; i < seats.length; i++) expect(seats[i].angle).toBeLessThanOrEqual(seats[i - 1].angle);
  });

  it('dodela mesta listama redom', () => {
    expect(assignSeats([{ id: 'a', seats: 2 }, { id: 'b', seats: 1 }], 4)).toEqual(['a', 'a', 'b', null]);
  });

  it('nevalidan broj mesta → prazan raspored', () => {
    expect(hemicycleLayout(0).seats).toHaveLength(0);
    expect(hemicycleLayout(NaN).seats).toHaveLength(0);
  });
});

describe('Izborna noć (ilustracija)', () => {
  it('na 100% se tačno poklapa sa konačnim rezultatom', () => {
    const lists = demoLists();
    expect(partialCount(lists, 1, 7)).toEqual(lists);
    expect(calculateMandates(partialCount(lists, 1, 7), S()).seatsByList).toEqual(calculateMandates(lists, S()).seatsByList);
  });

  it('međurezultati su manji ili jednaki konačnim i rastu', () => {
    const lists = demoLists();
    let prev = partialCount(lists, 0, 3);
    expect(prev.every((l) => l.votes === 0)).toBe(true);
    for (let p = 0.1; p < 1; p += 0.1) {
      const cur = partialCount(lists, p, 3);
      cur.forEach((l, i) => {
        expect(l.votes).toBeGreaterThanOrEqual(prev[i].votes);
        expect(l.votes).toBeLessThanOrEqual(lists[i].votes);
      });
      prev = cur;
    }
  });
});

describe('Ankete → scenario', () => {
  it('ostatak do 100% postaje zbirna stavka bez mandata, a ukupno je 250', () => {
    const sc = pollToScenario('Test', [
      { name: 'A', percent: 45 },
      { name: 'B', percent: 40 },
      { name: 'C', percent: 5 },
    ]);
    expect(sc.lists).toHaveLength(4);
    expect(sc.lists[3].isAggregate).toBe(true);
    const r = calculateMandates(sc.lists, sc.settings);
    expect(r.totalSeatsAllocated).toBe(250);
    expect(r.seatsByList[sc.lists[3].id]).toBe(0);
  });

  it('prosek anketa (lista koja nedostaje = 0%)', () => {
    const avg = averagePolls([
      { id: '1', agency: 'X', fieldwork: '', results: [{ name: 'A', percent: 40 }, { name: 'B', percent: 30 }] },
      { id: '2', agency: 'Y', fieldwork: '', results: [{ name: 'a', percent: 44 }] },
    ]);
    expect(avg).toEqual([
      { name: 'A', percent: 42, isMinority: undefined },
      { name: 'B', percent: 15, isMinority: undefined },
    ]);
  });
});
