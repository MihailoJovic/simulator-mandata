import type { ElectionResult, ElectionSettings, ElectoralList, InputMode, Scenario } from '../types/election';
import { LEGAL_DEFAULTS } from '../data/rules';
import { colorForIndex, safeColor } from './colors';
import { fmtNum } from './format';

/**
 * Import/Export i deljenje preko URL-a. Sve se dešava LOKALNO u browseru —
 * podaci se nikada ne šalju na server (URL hash se ne šalje serveru).
 */

export const FILE_FORMAT = 'simulator-mandata-srbija';
export const FILE_VERSION = 1;

export interface ScenarioFile {
  format: typeof FILE_FORMAT;
  version: number;
  name: string;
  createdAt: string;
  exportedAt: string;
  inputMode: InputMode;
  settings: ElectionSettings;
  lists: Array<ElectoralList & { percent?: number; seats?: number; passesThreshold?: boolean }>;
  results?: { totalValidVotes: number; votersWhoVoted: number; totalSeatsAllocated: number };
}

export function scenarioToFile(sc: Scenario, result: ElectionResult | null): ScenarioFile {
  return {
    format: FILE_FORMAT,
    version: FILE_VERSION,
    name: sc.name,
    createdAt: sc.createdAt,
    exportedAt: new Date().toISOString(),
    inputMode: sc.inputMode,
    settings: sc.settings,
    lists: sc.lists.map((l) => {
      const st = result?.statuses.find((s) => s.id === l.id);
      return {
        ...l,
        percent: st ? Number(st.percentValid.toFixed(6)) : undefined,
        seats: result?.seatsByList[l.id],
        passesThreshold: st?.passesThreshold,
      };
    }),
    results: result?.ok
      ? { totalValidVotes: result.totalValidVotes, votersWhoVoted: result.votersWhoVoted, totalSeatsAllocated: result.totalSeatsAllocated }
      : undefined,
  };
}

const num = (v: unknown, d: number) => (typeof v === 'number' && Number.isFinite(v) ? v : d);
const bool = (v: unknown, d: boolean) => (typeof v === 'boolean' ? v : d);

export function sanitizeSettings(raw: unknown): ElectionSettings {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  return {
    seats: Math.round(num(r.seats, LEGAL_DEFAULTS.seats)),
    thresholdPercent: num(r.thresholdPercent, LEGAL_DEFAULTS.thresholdPercent),
    thresholdBase: r.thresholdBase === 'valid' ? 'valid' : 'voters',
    invalidBallots: Math.max(0, Math.round(num(r.invalidBallots, 0))),
    minorityRules: bool(r.minorityRules, true),
    minorityBonusPercent: num(r.minorityBonusPercent, LEGAL_DEFAULTS.minorityBonusPercent),
    noListPassesFallback: bool(r.noListPassesFallback, true),
    residualTieBreak: r.residualTieBreak === 'lot' ? 'lot' : 'input-order',
    lotSeed: Math.max(0, Math.round(num(r.lotSeed, LEGAL_DEFAULTS.lotSeed))),
  };
}

/** Parsira i sanitizuje uvezeni scenario. Baca grešku sa jasnom porukom. */
export function parseScenarioFile(text: string): Scenario {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error('Fajl nije ispravan JSON.');
  }
  if (!data || typeof data !== 'object') throw new Error('Neispravan format fajla.');
  const d = data as Record<string, unknown>;
  if (!Array.isArray(d.lists)) throw new Error('Fajl ne sadrži liste ("lists").');
  const seen = new Set<string>();
  const lists: ElectoralList[] = d.lists.map((x: unknown, i: number) => {
    const l = (x && typeof x === 'object' ? x : {}) as Record<string, unknown>;
    let id = typeof l.id === 'string' && l.id ? l.id : `imp_${i + 1}`;
    if (seen.has(id)) id = `${id}_${i + 1}`;
    seen.add(id);
    const votes = typeof l.votes === 'number' ? l.votes : Number.NaN;
    return {
      id,
      name: typeof l.name === 'string' ? l.name.slice(0, 120) : '',
      votes,
      isMinority: bool(l.isMinority, false),
      isAggregate: bool(l.isAggregate, false),
      color: safeColor(typeof l.color === 'string' ? l.color : '', colorForIndex(i)),
      candidates: typeof l.candidates === 'number' && Number.isFinite(l.candidates) ? Math.round(l.candidates) : null,
    };
  });
  return {
    id: `sc_${Date.now().toString(36)}`,
    name: typeof d.name === 'string' && d.name.trim() ? d.name.slice(0, 120) : 'Uvezeni scenario',
    createdAt: typeof d.createdAt === 'string' ? d.createdAt : new Date().toISOString(),
    lists,
    settings: sanitizeSettings(d.settings),
    inputMode: d.inputMode === 'percent' ? 'percent' : 'votes',
  };
}

/* ───── CSV ───── */

const csvCell = (v: string | number) => {
  const s = String(v);
  return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export function resultsToCsv(lists: ElectoralList[], r: ElectionResult): string {
  const statusLabel: Record<string, string> = {
    passed: 'PRELAZI',
    'minority-exempt': 'MANJINSKA (čl. 140)',
    'no-list-passed': 'UČESTVUJE (čl. 128 st. 2)',
    'below-threshold': 'NE PRELAZI',
    aggregate: 'ZBIRNO (ne učestvuje)',
    'no-votes': 'BEZ GLASOVA',
  };
  const head = ['Lista', 'Glasovi', 'Procenat (važeći)', 'Procenat (osnova cenzusa)', 'Cenzus %', 'Status', 'Manjinska', 'Mandati'];
  const rows = lists.map((l) => {
    const st = r.statuses.find((s) => s.id === l.id);
    return [
      l.name,
      l.votes,
      st ? st.percentValid.toFixed(4).replace('.', ',') : '',
      st ? st.percentOfBase.toFixed(4).replace('.', ',') : '',
      fmtNum(r.settings.thresholdPercent, 6),
      st ? statusLabel[st.reason] : '',
      l.isMinority ? 'DA' : 'NE',
      r.seatsByList[l.id] ?? 0,
    ];
  });
  rows.push(['UKUPNO', r.totalValidVotes, '100', '', '', '', '', r.totalSeatsAllocated]);
  // ; separator + BOM → ispravno se otvara u Excel-u sa srpskim podešavanjima
  return '﻿' + [head, ...rows].map((row) => row.map(csvCell).join(';')).join('\r\n');
}

export function dhondtToCsv(r: ElectionResult, names: Record<string, string>): string {
  if (!r.dhondt) return '';
  const head = ['Rang', 'Lista', 'Glasovi', 'Delilac', 'Količnik', 'Količnik (tačan razlomak)', 'Mandat'];
  const rows = r.dhondt.ranked.map((q) => [
    q.rank,
    names[q.listId] ?? q.listId,
    q.votes,
    q.divisor,
    q.approx.toFixed(6).replace('.', ','),
    `${q.value.num}/${q.value.den}`,
    q.awarded ? 'DA' : 'NE',
  ]);
  return '﻿' + [head, ...rows].map((row) => row.map(csvCell).join(';')).join('\r\n');
}

export function downloadText(filename: string, text: string, mime: string) {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function safeFilename(s: string): string {
  return (s || 'scenario').replace(/[^\p{L}\p{N}_-]+/gu, '_').slice(0, 60);
}

/* ───── URL deljenje ───── */

interface ShareData {
  v: 1;
  n: string;
  m: InputMode;
  s: ElectionSettings;
  l: Array<[string, number, number, string, number | null]>; // [naziv, glasovi, flags, boja, kandidati]
}

function b64urlEncode(s: string): string {
  const bytes = new TextEncoder().encode(s);
  let bin = '';
  bytes.forEach((b) => (bin += String.fromCharCode(b)));
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function b64urlDecode(s: string): string {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4);
  const bin = atob(b64);
  return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
}

export function encodeShare(name: string, lists: ElectoralList[], settings: ElectionSettings, mode: InputMode): string {
  const data: ShareData = {
    v: 1,
    n: name,
    m: mode,
    s: settings,
    l: lists.map((l) => [l.name, l.votes, (l.isMinority ? 1 : 0) | (l.isAggregate ? 2 : 0), l.color, l.candidates]),
  };
  return b64urlEncode(JSON.stringify(data));
}

export function decodeShare(token: string): Scenario | null {
  try {
    const d = JSON.parse(b64urlDecode(token)) as ShareData;
    if (d.v !== 1 || !Array.isArray(d.l)) return null;
    return {
      id: `sc_${Date.now().toString(36)}`,
      name: typeof d.n === 'string' ? d.n : 'Deljeni scenario',
      createdAt: new Date().toISOString(),
      inputMode: d.m === 'percent' ? 'percent' : 'votes',
      settings: sanitizeSettings(d.s),
      lists: d.l.map((x, i) => ({
        id: `sh_${i + 1}`,
        name: String(x[0] ?? ''),
        votes: typeof x[1] === 'number' ? x[1] : Number.NaN,
        isMinority: Boolean(Number(x[2]) & 1),
        isAggregate: Boolean(Number(x[2]) & 2),
        color: safeColor(String(x[3] ?? ''), colorForIndex(i)),
        candidates: typeof x[4] === 'number' ? x[4] : null,
      })),
    };
  } catch {
    return null;
  }
}

export function buildShareUrl(token: string): string {
  const { origin, pathname, search } = window.location;
  return `${origin}${pathname}${search}#scenario=${token}`;
}

export function readShareTokenFromHash(): string | null {
  const m = window.location.hash.match(/scenario=([A-Za-z0-9_-]+)/);
  return m ? m[1] : null;
}
