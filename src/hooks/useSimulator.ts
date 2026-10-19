import { useEffect, useMemo, useReducer } from 'react';
import type { ElectionSettings, ElectoralList, InputMode, Scenario } from '../types/election';
import { LEGAL_DEFAULTS } from '../data/rules';
import { DEMO_TOTAL_VOTES, demoLists } from '../data/demo';
import { calculateMandates, percentagesToVotes } from '../calculations';
import { colorForIndex } from '../utils/colors';
import { mulberry32, randomId } from '../utils/prng';
import { loadJSON, saveJSON, STORAGE_KEYS } from '../utils/storage';
import { decodeShare, readShareTokenFromHash, sanitizeSettings } from '../utils/serialization';

export interface SimState {
  scenarioName: string;
  createdAt: string;
  lists: ElectoralList[];
  settings: ElectionSettings;
  inputMode: InputMode;
  /** Ukupan broj važećih glasova koji se koristi u režimu unosa po procentima. */
  percentTotal: number;
  /** Uneti procenti (režim po procentima). */
  percentInputs: Record<string, number>;
  isDemo: boolean;
  /** Poruka o učitavanju iz URL-a i sl. */
  notice: string | null;
}

export type Action =
  | { type: 'setLists'; lists: ElectoralList[] }
  | { type: 'updateList'; id: string; patch: Partial<ElectoralList> }
  | { type: 'addList' }
  | { type: 'removeList'; id: string }
  | { type: 'moveList'; id: string; dir: -1 | 1 }
  | { type: 'setPercent'; id: string; value: number }
  | { type: 'setPercentTotal'; value: number }
  | { type: 'setSettings'; patch: Partial<ElectionSettings> }
  | { type: 'setInputMode'; mode: InputMode }
  | { type: 'setName'; name: string }
  | { type: 'reset' }
  | { type: 'clearAll' }
  | { type: 'randomize'; seed: number }
  | { type: 'load'; scenario: Scenario; notice?: string }
  | { type: 'dismissNotice' };

const total = (ls: ElectoralList[]) => ls.reduce((a, l) => a + (Number.isFinite(l.votes) ? l.votes : 0), 0);

function percentsFromVotes(lists: ElectoralList[]): Record<string, number> {
  const t = total(lists);
  const out: Record<string, number> = {};
  for (const l of lists) out[l.id] = t > 0 && Number.isFinite(l.votes) ? Math.round((l.votes / t) * 100 * 10000) / 10000 : 0;
  return out;
}

function withVotes(state: SimState, lists: ElectoralList[]): SimState {
  const t = total(lists);
  return { ...state, lists, percentInputs: percentsFromVotes(lists), percentTotal: t > 0 ? t : state.percentTotal, isDemo: false };
}

export function initialDemoState(): SimState {
  const lists = demoLists();
  return {
    scenarioName: 'Demo scenario',
    createdAt: new Date().toISOString(),
    lists,
    settings: { ...LEGAL_DEFAULTS },
    inputMode: 'votes',
    percentTotal: DEMO_TOTAL_VOTES,
    percentInputs: percentsFromVotes(lists),
    isDemo: true,
    notice: null,
  };
}

function fromScenario(sc: Scenario, notice: string | null = null): SimState {
  return {
    scenarioName: sc.name,
    createdAt: sc.createdAt,
    lists: sc.lists,
    settings: sanitizeSettings(sc.settings),
    inputMode: sc.inputMode,
    percentTotal: total(sc.lists) || DEMO_TOTAL_VOTES,
    percentInputs: percentsFromVotes(sc.lists),
    isDemo: false,
    notice,
  };
}

export function reducer(state: SimState, a: Action): SimState {
  switch (a.type) {
    case 'setLists':
      return withVotes(state, a.lists);
    case 'updateList': {
      const lists = state.lists.map((l) => (l.id === a.id ? { ...l, ...a.patch } : l));
      return 'votes' in a.patch ? withVotes(state, lists) : { ...state, lists, isDemo: false };
    }
    case 'addList': {
      const n = state.lists.length;
      const l: ElectoralList = {
        id: randomId('l'),
        name: `Lista ${n + 1}`,
        votes: 0,
        isMinority: false,
        isAggregate: false,
        color: colorForIndex(n),
        candidates: null,
      };
      return { ...state, lists: [...state.lists, l], percentInputs: { ...state.percentInputs, [l.id]: 0 }, isDemo: false };
    }
    case 'removeList':
      return withVotes(state, state.lists.filter((l) => l.id !== a.id));
    case 'moveList': {
      const i = state.lists.findIndex((l) => l.id === a.id);
      const j = i + a.dir;
      if (i < 0 || j < 0 || j >= state.lists.length) return state;
      const lists = [...state.lists];
      [lists[i], lists[j]] = [lists[j], lists[i]];
      return { ...state, lists };
    }
    case 'setPercent': {
      const percentInputs = { ...state.percentInputs, [a.id]: a.value };
      const votes = percentagesToVotes(state.lists.map((l) => percentInputs[l.id] ?? 0), state.percentTotal);
      return { ...state, percentInputs, lists: state.lists.map((l, i) => ({ ...l, votes: votes[i] })), isDemo: false };
    }
    case 'setPercentTotal': {
      const votes = percentagesToVotes(state.lists.map((l) => state.percentInputs[l.id] ?? 0), a.value);
      return { ...state, percentTotal: a.value, lists: state.lists.map((l, i) => ({ ...l, votes: votes[i] })), isDemo: false };
    }
    case 'setSettings':
      return { ...state, settings: { ...state.settings, ...a.patch }, isDemo: false };
    case 'setInputMode':
      return { ...state, inputMode: a.mode, percentInputs: percentsFromVotes(state.lists), percentTotal: total(state.lists) || state.percentTotal };
    case 'setName':
      return { ...state, scenarioName: a.name };
    case 'reset':
      return initialDemoState();
    case 'clearAll':
      return { ...state, lists: [], percentInputs: {}, isDemo: false, scenarioName: 'Novi scenario' };
    case 'randomize': {
      const rnd = mulberry32(a.seed);
      let lists = state.lists;
      if (lists.length === 0) {
        lists = Array.from({ length: 6 }, (_, i) => ({
          id: randomId('l'),
          name: `Lista ${String.fromCharCode(65 + i)}`,
          votes: 0,
          isMinority: false,
          isAggregate: false,
          color: colorForIndex(i),
          candidates: null,
        }));
      }
      // Eksponencijalne težine (Dirichlet(1)) → validna raspodela koja daje 100%.
      const w = lists.map(() => Math.pow(-Math.log(1 - rnd()), 1.6));
      const votes = percentagesToVotes(w, state.percentTotal || DEMO_TOTAL_VOTES);
      return withVotes(state, lists.map((l, i) => ({ ...l, votes: votes[i] })));
    }
    case 'load':
      return fromScenario(a.scenario, a.notice ?? null);
    case 'dismissNotice':
      return { ...state, notice: null };
    default:
      return state;
  }
}

function initState(): SimState {
  const token = typeof window !== 'undefined' ? readShareTokenFromHash() : null;
  if (token) {
    const sc = decodeShare(token);
    if (sc) return fromScenario(sc, `Učitan scenario iz linka: "${sc.name}".`);
  }
  const saved = loadJSON<SimState | null>(STORAGE_KEYS.state, null);
  if (saved && Array.isArray(saved.lists) && saved.settings) {
    return { ...initialDemoState(), ...saved, settings: sanitizeSettings(saved.settings), notice: null };
  }
  return initialDemoState();
}

export function useSimulator() {
  const [state, dispatch] = useReducer(reducer, undefined, initState);

  useEffect(() => {
    const t = setTimeout(() => saveJSON(STORAGE_KEYS.state, { ...state, notice: null }), 300);
    return () => clearTimeout(t);
  }, [state]);

  const result = useMemo(() => calculateMandates(state.lists, state.settings, { extraQuotients: 25 }), [state.lists, state.settings]);

  return { state, dispatch, result };
}
