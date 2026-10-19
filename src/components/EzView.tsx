import { useState } from 'react';
import type { ElectionResult } from '../types/election';
import type { Action, SimState } from '../hooks/useSimulator';
import { calculateMajority } from '../calculations';
import { majorityOf } from '../data/rules';
import { fmtInt, fmtNum, fmtPct } from '../utils/format';
import { parseDecimal, parseVotes } from '../utils/parse';
import { safeColor } from '../utils/colors';
import { Card, ParsedInput, Segmented } from './ui';
import { Hemicycle } from './visual/Hemicycle';

/**
 * Ez Mode — jednostavan prikaz: unos naziva i rezultata, velika skupština,
 * provera većine. Sve ostalo je u Advanced Mode-u.
 */
export function EzView({ state, dispatch, result, onOpenVisual }: { state: SimState; dispatch: (a: Action) => void; result: ElectionResult; onOpenVisual: () => void }) {
  const [unit, setUnit] = useState<'percent' | 'votes'>('percent');
  const [selected, setSelected] = useState<string[]>([]);
  const S = state.settings.seats;
  const maj = majorityOf(S);
  const sel = selected.filter((id) => state.lists.some((l) => l.id === id));
  const m = calculateMajority(result.seatsByList, sel, S);
  const statusById = new Map(result.statuses.map((s) => [s.id, s]));
  const toggle = (id: string) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  const pctSum = state.lists.reduce((a, l) => a + (state.percentInputs[l.id] ?? 0), 0);

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
      <div className="min-w-0 lg:col-span-5">
        <Card
          title="1. Unesite rezultate"
          actions={
            <Segmented
              size="xs"
              value={unit}
              onChange={setUnit}
              options={[
                { value: 'percent', label: 'Procenti' },
                { value: 'votes', label: 'Glasovi' },
              ]}
            />
          }
        >
          <ul className="space-y-2">
            {state.lists.map((l) => {
              const st = statusById.get(l.id);
              const seats = result.seatsByList[l.id] ?? 0;
              return (
                <li key={l.id} className="grid grid-cols-[auto_minmax(0,1fr)_7rem_3rem_auto] items-center gap-2">
                  <span className="h-4 w-4 rounded" style={{ background: safeColor(l.color) }} aria-hidden />
                  <input
                    className={`input text-base ${l.name.trim() ? '' : 'input-error'}`}
                    value={l.name}
                    onChange={(e) => dispatch({ type: 'updateList', id: l.id, patch: { name: e.target.value } })}
                    placeholder="Naziv liste"
                    aria-label="Naziv liste"
                  />
                  {unit === 'percent' ? (
                    <div className="flex items-center gap-1">
                      <ParsedInput
                        className="text-base"
                        value={state.percentInputs[l.id] ?? 0}
                        format={(v) => fmtNum(v, 2)}
                        parse={(s) => parseDecimal(s, { max: 100 })}
                        onCommit={(v) => dispatch({ type: 'setPercent', id: l.id, value: v })}
                        ariaLabel={`Procenat: ${l.name}`}
                      />
                      <span className="text-sm text-slate-500">%</span>
                    </div>
                  ) : (
                    <ParsedInput className="text-base" value={l.votes} format={fmtInt} parse={parseVotes} onCommit={(v) => dispatch({ type: 'updateList', id: l.id, patch: { votes: v } })} ariaLabel={`Glasovi: ${l.name}`} />
                  )}
                  <span className="text-right text-xl font-bold tabular-nums" title={st?.qualifies ? 'mandata' : 'ne učestvuje u raspodeli'}>
                    {seats}
                  </span>
                  <button className="btn btn-xs" onClick={() => dispatch({ type: 'removeList', id: l.id })} aria-label={`Obriši ${l.name}`} title="Obriši">
                    ✕
                  </button>
                  {st && !st.qualifies && st.reason !== 'no-votes' && (
                    <span className="col-span-5 -mt-1 pl-6 text-xs text-slate-500">
                      {st.reason === 'aggregate' ? 'Zbirna stavka — ne dobija mandate' : `Ispod cenzusa (${fmtPct(st.percentOfBase, 2)} < ${fmtNum(state.settings.thresholdPercent)}%) — ne dobija mandate`}
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
            <button className="btn btn-primary" onClick={() => dispatch({ type: 'addList' })}>
              + Dodaj listu
            </button>
            {unit === 'percent' && (
              <span className={`text-sm tabular-nums ${Math.abs(pctSum - 100) > 0.005 ? 'text-amber-700 dark:text-amber-400' : 'text-slate-500'}`}>
                Zbir: {fmtNum(pctSum, 2)}%{Math.abs(pctSum - 100) > 0.005 ? ' (biće preračunato na 100%)' : ''}
              </span>
            )}
          </div>
          <p className="mt-3 text-xs text-slate-500">
            Liste ispod {fmtNum(state.settings.thresholdPercent)}% ne dobijaju mandate (osim manjinskih — podešava se u Advanced Mode-u). Mandati se dele D'Hondt metodom.
          </p>
        </Card>
      </div>

      <div className="min-w-0 space-y-4 lg:col-span-7">
        <Card title="2. Raspodela mandata" actions={<button className="btn btn-xs" onClick={onOpenVisual}>Otvori vizuelni prikaz ↗</button>}>
          {result.ok ? (
            <>
              <div className="mx-auto max-w-2xl">
                <Hemicycle lists={state.lists} seatsByList={result.seatsByList} totalSeats={S} selected={sel} onToggle={toggle} />
              </div>
              <ul className="mt-3 grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                {state.lists
                  .filter((l) => (result.seatsByList[l.id] ?? 0) > 0)
                  .sort((a, b) => (result.seatsByList[b.id] ?? 0) - (result.seatsByList[a.id] ?? 0))
                  .map((l) => (
                    <li key={l.id}>
                      <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 px-2 py-1.5 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800/50">
                        <input type="checkbox" className="h-4 w-4 accent-slate-700" checked={sel.includes(l.id)} onChange={() => toggle(l.id)} />
                        <span className="h-3 w-3 rounded-sm" style={{ background: safeColor(l.color) }} aria-hidden />
                        <span className="min-w-0 flex-1 truncate">{l.name}</span>
                        <strong className="tabular-nums">{result.seatsByList[l.id]}</strong>
                      </label>
                    </li>
                  ))}
              </ul>
            </>
          ) : (
            <p className="text-sm text-slate-500">Ispravite unos (npr. prazan naziv) da bi se prikazala raspodela.</p>
          )}
        </Card>

        <Card title="3. Da li ima većinu?">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-slate-600 dark:text-slate-300">
              {sel.length === 0 ? `Čekirajte liste iznad da saberete njihove mandate. Za većinu je potrebno ${maj}.` : sel.map((id) => state.lists.find((l) => l.id === id)?.name).join(' + ')}
            </p>
            {sel.length > 0 && (
              <div className="text-right">
                <p className="text-3xl font-bold tabular-nums">{m.groupSeats}</p>
                <p className={`chip ${m.hasMajority ? 'chip-pass' : 'chip-fail'}`}>{m.hasMajority ? '✓ IMA VEĆINU' : `✕ nedostaje ${m.missing}`}</p>
              </div>
            )}
          </div>
          <p className="mt-2 text-[11px] text-slate-500">Samo aritmetički zbir — nije politička procena.</p>
        </Card>
      </div>
    </div>
  );
}
