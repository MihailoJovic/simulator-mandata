import { describe, expect, it } from 'vitest';
import { calculateMandates } from '../calculations';
import { L, S, sumSeats } from './helpers';

/**
 * Validacija engine-a na ZVANIČNOM rezultatu: izbori za narodne poslanike 17.12.2023.
 * Izvor: Ukupan izveštaj RIK-a (12.01.2024), preneto u Danas,
 * https://www.danas.rs/vesti/politika/sta-stoji-u-konacnom-izvestaju-rik-a-koliko-je-ko-osvojio-glasova-i-mandata/
 * Važeći listići: 3.710.978; nevažeći: 104.029; glasalo: 3.815.007.
 * Ovo je ISTORIJSKI test tačnosti obračuna, ne prognoza.
 */
const M = { isMinority: true };
const lists = [
  L('Srbija ne sme da stane', 1_783_701, { id: 'l1' }),
  L('Srbija protiv nasilja', 902_450, { id: 'l2' }),
  L('SPS', 249_916, { id: 'l3' }),
  L('NADA', 191_431, { id: 'l4' }),
  L('Mi – Glas iz naroda', 178_830, { id: 'l5' }),
  L('Zavetnici/Dveri', 105_165, { id: 'l6' }),
  L('Savez vojvođanskih Mađara', 64_747, { id: 'l7', ...M }),
  L('SRS', 55_782, { id: 'l8' }),
  L('Radulović/Tadić', 45_079, { id: 'l9' }),
  L('Narodna stranka', 33_388, { id: 'l10' }),
  L('Ujedinjeni za pravdu', 29_066, { id: 'l11', ...M }),
  L('SDA Sandžaka', 21_827, { id: 'l12', ...M }),
  L('Politička borba Albanaca', 13_501, { id: 'l13', ...M }),
  L('Ruska stranka', 11_369, { id: 'l14', ...M }),
  L('Mora drugačije', 9_243, { id: 'l15' }),
  L('Zajedno za budućnost i razvoj', 6_786, { id: 'l16' }),
  L('Srbija na zapadu', 5_462, { id: 'l17' }),
  L('Albanska demokratska alternativa', 3_235, { id: 'l18', ...M }),
];

const official: Record<string, number> = {
  l1: 129, l2: 65, l3: 18, l4: 13, l5: 13, l6: 0, l7: 6, l8: 0, l9: 0,
  l10: 0, l11: 2, l12: 2, l13: 1, l14: 1, l15: 0, l16: 0, l17: 0, l18: 0,
};

describe('Zvanični rezultat 2023 (RIK)', () => {
  it('zbir glasova odgovara broju važećih listića', () => {
    expect(lists.reduce((a, l) => a + l.votes, 0)).toBe(3_710_978);
  });

  it('simulator reprodukuje zvaničnu raspodelu mandata', () => {
    const r = calculateMandates(lists, S({ invalidBallots: 104_029 }));
    expect(r.ok).toBe(true);
    expect(r.votersWhoVoted).toBe(3_815_007);
    expect(r.minVotesToPass).toBe(114_451); // ⌈3% × 3.815.007⌉
    expect(r.seatsByList).toEqual(official);
    expect(sumSeats(r.seatsByList)).toBe(250);
  });
});
