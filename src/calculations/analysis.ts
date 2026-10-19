import type { ElectionSettings, ElectoralList } from '../types/election';
import { quickSeats } from './mandates';
import { setListShare, setListVotes, type Adjustment } from './voteOps';
import { passesThreshold, thresholdBaseVotes } from './threshold';

/* ────────────────────────────── Pronađi granicu ────────────────────────────── */

export interface SeatGoal {
  /** Liste čiji se mandati sabiraju. */
  listIds: string[];
  /** Uslov: zbir mandata ≥ minSeats. */
  minSeats: number;
}

export interface FindThresholdParams {
  lists: ElectoralList[];
  settings: ElectionSettings;
  /** Lista čiji se rezultat menja. */
  variableId: string;
  adjustment: Adjustment;
  goal: SeatGoal;
  /** Broj uzoraka grube pretrage (podrazumevano 1000). */
  samples?: number;
}

export interface FindThresholdResult {
  found: boolean;
  /** Minimalan broj glasova promenljive liste pri kojem je uslov ispunjen. */
  votes: number;
  percentValid: number;
  lists: ElectoralList[];
  seatsByList: Record<string, number>;
  groupSeats: number;
  /** Uslov je ispunjen već pri 0 glasova promenljive liste. */
  satisfiedAtZero: boolean;
  /** Broj obavljenih obračuna tokom pretrage. */
  evaluations: number;
  searchedRange: [number, number];
  note: string;
}

const sumSeats = (seats: Record<string, number>, ids: string[]) => ids.reduce((a, id) => a + (seats[id] ?? 0), 0);

function upperBound(lists: ElectoralList[], variableId: string, adj: Adjustment): number {
  const total = lists.reduce((a, l) => a + l.votes, 0);
  const v = lists.find((l) => l.id === variableId)?.votes ?? 0;
  if (adj.kind === 'proportional') return total;
  if (adj.kind === 'from') return v + (lists.find((l) => l.id === adj.sourceId)?.votes ?? 0);
  // 'none': do 95% udela (ostali fiksni)
  return Math.max(v, (total - v) * 19, 1);
}

/** Binarna pretraga najmanjeg v u [lo, hi] za koje je pred(v) tačno (pretpostavlja monotonost na intervalu). */
function bisectFirstTrue(lo: number, hi: number, pred: (v: number) => boolean): number {
  // invarijanta: pred(hi) = true; pred(lo) = false
  while (hi - lo > 1) {
    const mid = Math.floor((lo + hi) / 2);
    if (pred(mid)) hi = mid;
    else lo = mid;
  }
  return hi;
}

/**
 * Traži MINIMALAN broj glasova promenljive liste pri kojem grupa lista ima ≥ N mandata.
 *
 * Postupak (deterministički):
 *  1. gruba pretraga na mreži od `samples` tačaka u [0, gornja granica], uz dodate
 *     TAČNE tačke prelaska cenzusa svih lista (gde se raspodela menja skokovito);
 *  2. prvi uzorak koji ispunjava uslov → binarna pretraga između njega i prethodnog
 *     uzorka do tačnosti od 1 glasa.
 * Raspodela mandata nije uvek monotona u odnosu na rezultat jedne liste; zato se
 * rezultat uvek dodatno proverava (v ispunjava, v − 1 ne ispunjava uslov).
 */
export function findThreshold(p: FindThresholdParams): FindThresholdResult {
  const { lists, settings, variableId, adjustment, goal } = p;
  const samples = Math.max(10, Math.min(20000, p.samples ?? 1000));
  let evaluations = 0;
  const listsAt = (v: number) => setListVotes(lists, variableId, v, adjustment);
  const pred = (v: number) => {
    evaluations++;
    return sumSeats(quickSeats(listsAt(v), settings), goal.listIds) >= goal.minSeats;
  };
  const hi = upperBound(lists, variableId, adjustment);
  const points = new Set<number>();
  for (let k = 0; k <= samples; k++) points.add(Math.round((k / samples) * hi));
  for (const x of thresholdCrossings(lists, settings, variableId, adjustment, hi)) {
    points.add(x);
    if (x > 0) points.add(x - 1);
  }
  const grid = [...points].filter((x) => x >= 0 && x <= hi).sort((a, b) => a - b);

  const finish = (v: number, found: boolean, satisfiedAtZero: boolean, note: string): FindThresholdResult => {
    const L = listsAt(v);
    const seats = quickSeats(L, settings);
    const total = L.reduce((a, l) => a + l.votes, 0);
    const vv = L.find((l) => l.id === variableId)?.votes ?? 0;
    return {
      found,
      votes: vv,
      percentValid: total > 0 ? (vv / total) * 100 : 0,
      lists: L,
      seatsByList: seats,
      groupSeats: sumSeats(seats, goal.listIds),
      satisfiedAtZero,
      evaluations,
      searchedRange: [0, hi],
      note,
    };
  };

  if (pred(grid[0])) return finish(grid[0], true, true, 'Uslov je ispunjen već kada promenljiva lista ima 0 glasova.');
  for (let k = 1; k < grid.length; k++) {
    if (pred(grid[k])) {
      const v = bisectFirstTrue(grid[k - 1], grid[k], pred);
      return finish(v, true, false, 'Pronađen tačan prelaz (sa v − 1 glasom uslov nije ispunjen).');
    }
  }
  return finish(lists.find((l) => l.id === variableId)?.votes ?? 0, false, false, `Uslov nije ispunjen ni za jedan rezultat u opsegu 0 – ${hi.toLocaleString('sr-RS')} glasova.`);
}

/** Tačni brojevi glasova promenljive liste pri kojima neka lista menja status u odnosu na cenzus. */
function thresholdCrossings(
  lists: ElectoralList[],
  settings: ElectionSettings,
  variableId: string,
  adj: Adjustment,
  hi: number,
): number[] {
  const out: number[] = [];
  const status = (v: number, id: string) => {
    const L = setListVotes(lists, variableId, v, adj);
    const l = L.find((x) => x.id === id)!;
    return passesThreshold(l.votes, thresholdBaseVotes(L, settings), settings.thresholdPercent);
  };
  for (const l of lists) {
    const a = status(0, l.id);
    const b = status(hi, l.id);
    if (a === b) continue;
    // monotono: nađi prvo v gde se status razlikuje od a
    let lo = 0;
    let h = hi;
    while (h - lo > 1) {
      const m = Math.floor((lo + h) / 2);
      if (status(m, l.id) === a) lo = m;
      else h = m;
    }
    out.push(h);
  }
  return out;
}

/* ────────────────────────────── Analiza osetljivosti ────────────────────────────── */

export interface SensitivityParams {
  lists: ElectoralList[];
  settings: ElectionSettings;
  variableId: string;
  adjustment: Adjustment;
  fromPercent: number;
  toPercent: number;
  stepPercent: number;
  /** Liste čiji se mandati sabiraju u "ciljnu grupu". */
  groupIds: string[];
}

export interface SensitivityRow {
  /** Nominalni procenat (tačka mreže). */
  percent: number;
  votes: number;
  /** Stvarni procenat od važećih glasova posle celobrojnog zaokruživanja. */
  actualPercent: number;
  passesThreshold: boolean;
  /** Ovaj red je prvi u kojem se status cenzusa promenio. */
  thresholdChange: boolean;
  seats: Record<string, number>;
  groupSeats: number;
}

export const MAX_SENSITIVITY_ROWS = 2001;

export function runSensitivityAnalysis(p: SensitivityParams): SensitivityRow[] {
  const { lists, settings, variableId, adjustment, groupIds } = p;
  const from = Math.max(0, Math.min(100, p.fromPercent));
  const to = Math.max(0, Math.min(100, p.toPercent));
  const step = Math.abs(p.stepPercent);
  if (!Number.isFinite(from) || !Number.isFinite(to) || !Number.isFinite(step) || step <= 0 || to < from) return [];
  const count = Math.floor((to - from) / step + 1e-9) + 1;
  if (count > MAX_SENSITIVITY_ROWS) return [];
  const rows: SensitivityRow[] = [];
  let prevPass: boolean | null = null;
  for (let k = 0; k < count; k++) {
    // Racunamo u celim stotim-hiljaditim delovima da izbegnemo akumulaciju greške (2.1 + 0.1 …).
    const pct = Math.round((from + k * step) * 1e6) / 1e6;
    const L = setListShare(lists, variableId, pct, adjustment);
    const seats = quickSeats(L, settings);
    const total = L.reduce((a, l) => a + l.votes, 0);
    const v = L.find((l) => l.id === variableId)?.votes ?? 0;
    const passes = passesThreshold(v, thresholdBaseVotes(L, settings), settings.thresholdPercent);
    rows.push({
      percent: pct,
      votes: v,
      actualPercent: total > 0 ? (v / total) * 100 : 0,
      passesThreshold: passes,
      thresholdChange: prevPass !== null && prevPass !== passes,
      seats,
      groupSeats: sumSeats(seats, groupIds),
    });
    prevPass = passes;
  }
  return rows;
}
