import { useState } from 'react';
import type { ElectionResult, ElectoralList } from '../../types/election';
import { findThreshold, type FindThresholdResult } from '../../calculations';
import type { Action } from '../../hooks/useSimulator';
import { majorityOf } from '../../data/rules';
import { fmtInt, fmtPct } from '../../utils/format';
import { AdjustmentSelect, GroupPicker, ListSelect, pickId, toAdjustment, type AdjKind } from './common';
import { InfoNote } from '../ui';

export function FindThresholdTool({ lists, result, dispatch }: { lists: ElectoralList[]; result: ElectionResult; dispatch: (a: Action) => void }) {
  const S = result.settings.seats;
  const [group, setGroup] = useState<string[]>(() => lists.filter((l) => l.id === 'demo_1' || l.id === 'demo_4').map((l) => l.id));
  const [minSeats, setMinSeats] = useState(majorityOf(S));
  const [variable, setVariable] = useState(() => pickId(lists, 'demo_3', 2));
  const [kind, setKind] = useState<AdjKind>('proportional');
  const [sourceId, setSourceId] = useState('');
  const [res, setRes] = useState<{ r: FindThresholdResult; group: string[]; variable: string; minSeats: number; ms: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const v = pickId(lists, variable);
  const src = pickId(lists.filter((l) => l.id !== v), sourceId);
  const validGroup = group.filter((id) => lists.some((l) => l.id === id));
  const names = Object.fromEntries(lists.map((l) => [l.id, l.name]));

  const run = () => {
    setError(null);
    if (!result.ok) return setError('Prvo ispravite greške u unosu.');
    if (!validGroup.length) return setError('Izaberite bar jednu listu za cilj.');
    if (!Number.isInteger(minSeats) || minSeats < 1 || minSeats > S) return setError(`Broj mandata mora biti od 1 do ${S}.`);
    const t0 = performance.now();
    const r = findThreshold({ lists, settings: result.settings, variableId: v, adjustment: toAdjustment(kind, src), goal: { listIds: validGroup, minSeats } });
    setRes({ r, group: validGroup, variable: v, minSeats, ms: performance.now() - t0 });
  };

  const shownIds = res ? Array.from(new Set([...res.group, res.variable])) : [];

  return (
    <div className="space-y-3">
      <InfoNote>
        Alat traži <strong>najmanji</strong> broj glasova promenljive liste pri kojem izabrana grupa ima najmanje N mandata. Za obrnutu analizu („koliko glasova lista X mora da ima za 126 mandata”) izaberite istu listu i kao cilj i kao promenljivu.
      </InfoNote>
      <GroupPicker lists={lists} value={validGroup} onChange={setGroup} label="Cilj — zbir mandata ovih lista:" />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <label className="space-y-1">
          <span className="label">≥ mandata</span>
          <input className="input text-right" type="number" min={1} max={S} value={minSeats} onChange={(e) => setMinSeats(Math.round(Number(e.target.value)))} />
        </label>
        <ListSelect lists={lists} value={v} onChange={setVariable} label="Promenljiva lista" />
        <AdjustmentSelect lists={lists} kind={kind} sourceId={src} excludeId={v} onChange={(k, s) => { setKind(k); setSourceId(s); }} />
      </div>
      <button className="btn btn-primary" onClick={run}>
        Pronađi granicu
      </button>
      {error && <p className="text-sm text-rose-600">{error}</p>}

      {res && (
        <div className={`rounded-lg p-3 ${res.r.found ? 'border-2 border-slate-800 dark:border-slate-200' : 'border-2 border-dashed border-slate-400'}`}>
          {res.r.found ? (
            <>
              <p className="text-xs uppercase tracking-wide text-slate-500">Minimalni rezultat — {names[res.variable]}</p>
              <p className="text-2xl font-bold tabular-nums">
                {fmtInt(res.r.votes)} glasova <span className="text-lg font-semibold text-slate-500">({fmtPct(res.r.percentValid, 3)})</span>
              </p>
              {res.r.satisfiedAtZero && <p className="text-sm">Uslov je ispunjen čak i kada lista nema nijedan glas.</p>}
              <table className="mt-2 w-full max-w-md">
                <tbody>
                  {shownIds.map((id) => (
                    <tr key={id} className="border-b border-slate-100 dark:border-slate-800">
                      <td className="td">{names[id]}</td>
                      <td className="td num font-semibold">{res.r.seatsByList[id] ?? 0} mandata</td>
                    </tr>
                  ))}
                  <tr className="font-bold">
                    <td className="td">Zajedno (cilj)</td>
                    <td className="td num">{res.r.groupSeats} mandata</td>
                  </tr>
                </tbody>
              </table>
              <p className="mt-2 text-xs text-slate-500">
                {res.r.note} Provereno obračuna: {fmtInt(res.r.evaluations)} · {res.ms.toFixed(0)} ms.
              </p>
              <button className="btn mt-2" onClick={() => dispatch({ type: 'setLists', lists: res.r.lists })}>
                Primeni ovaj rezultat u simulator
              </button>
            </>
          ) : (
            <p className="text-sm">{res.r.note}</p>
          )}
        </div>
      )}
    </div>
  );
}
