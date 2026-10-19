import { useState } from 'react';
import type { ElectionResult, ElectoralList, ListStatus } from '../types/election';
import type { Action, SimState } from '../hooks/useSimulator';
import { ParsedInput, Toggle } from './ui';
import { StatusChip } from './StatusChip';
import { parseDecimal, parseVotes } from '../utils/parse';
import { fmtInt, fmtNum, fmtPct } from '../utils/format';
import { safeColor } from '../utils/colors';

const STEPS = [-10_000, -1_000, -1, 1, 1_000, 10_000];
const stepLabel = (s: number) => `${s > 0 ? '+' : '−'}${Math.abs(s) >= 1000 ? `${Math.abs(s) / 1000}k` : Math.abs(s)}`;

export function ListEditor({ state, dispatch, result }: { state: SimState; dispatch: (a: Action) => void; result: ElectionResult }) {
  const [advanced, setAdvanced] = useState(false);
  const statusById = new Map(result.statuses.map((s) => [s.id, s]));
  const pctSum = state.lists.reduce((a, l) => a + (state.percentInputs[l.id] ?? 0), 0);

  return (
    <div className="space-y-3">
      {state.inputMode === 'percent' && (
        <div className="grid grid-cols-2 gap-2 rounded-md border border-slate-200 p-2 dark:border-slate-800">
          <label className="col-span-2 text-xs text-slate-500 dark:text-slate-400">
            Unos po procentima: glasovi se računaju iz procenata i ukupnog broja važećih glasova. Ako zbir nije 100%, procenti se normalizuju.
          </label>
          <div>
            <span className="label">Ukupno važećih glasova</span>
            <ParsedInput value={state.percentTotal} format={fmtInt} parse={(s) => { const r = parseVotes(s); return r.ok && r.value === 0 ? { ok: false, error: 'Mora biti > 0.' } : r; }} onCommit={(v) => dispatch({ type: 'setPercentTotal', value: v })} ariaLabel="Ukupno važećih glasova" />
          </div>
          <div>
            <span className="label">Zbir unetih procenata</span>
            <p className={`mt-1 text-right text-sm font-semibold tabular-nums ${Math.abs(pctSum - 100) > 1e-6 ? 'text-amber-700 dark:text-amber-400' : ''}`}>
              {fmtNum(pctSum, 4)}%{Math.abs(pctSum - 100) > 1e-6 && ' → normalizovano'}
            </p>
          </div>
        </div>
      )}

      <ul className="space-y-2">
        {state.lists.map((l, idx) => (
          <ListRow
            key={l.id}
            l={l}
            idx={idx}
            count={state.lists.length}
            status={statusById.get(l.id)}
            seats={result.seatsByList[l.id]}
            percentMode={state.inputMode === 'percent'}
            percentInput={state.percentInputs[l.id] ?? 0}
            advanced={advanced}
            minorityRules={state.settings.minorityRules}
            dispatch={dispatch}
          />
        ))}
      </ul>

      {state.lists.length === 0 && <p className="py-6 text-center text-sm text-slate-500">Nema lista. Dodajte prvu listu.</p>}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <button className="btn btn-primary" onClick={() => dispatch({ type: 'addList' })}>
          + Dodaj listu
        </button>
        <Toggle checked={advanced} onChange={setAdvanced} label="Napredno (kandidati, zbirno)" />
      </div>
    </div>
  );
}

function ListRow({
  l,
  idx,
  count,
  status,
  seats,
  percentMode,
  percentInput,
  advanced,
  minorityRules,
  dispatch,
}: {
  l: ElectoralList;
  idx: number;
  count: number;
  status?: ListStatus;
  seats?: number;
  percentMode: boolean;
  percentInput: number;
  advanced: boolean;
  minorityRules: boolean;
  dispatch: (a: Action) => void;
}) {
  const nameEmpty = !l.name.trim();
  const update = (patch: Partial<ElectoralList>) => dispatch({ type: 'updateList', id: l.id, patch });

  return (
    <li className="rounded-lg border border-slate-200 p-2.5 dark:border-slate-800">
      <div className="flex items-start gap-2">
        <input
          type="color"
          value={safeColor(l.color)}
          onChange={(e) => update({ color: e.target.value })}
          className="mt-1 h-6 w-6 shrink-0 cursor-pointer rounded border border-slate-300 bg-transparent p-0 dark:border-slate-700"
          aria-label={`Boja liste ${l.name}`}
          title="Boja liste"
        />
        <div className="min-w-0 flex-1">
          <input
            className={`input font-medium ${nameEmpty ? 'input-error' : ''}`}
            value={l.name}
            maxLength={120}
            onChange={(e) => update({ name: e.target.value })}
            placeholder="Naziv liste"
            aria-label="Naziv liste"
          />
          {nameEmpty && <p className="mt-0.5 text-[11px] text-rose-600 dark:text-rose-400">Lista mora imati naziv.</p>}
        </div>
        <div className="flex shrink-0 flex-col items-end">
          <span className="text-lg font-bold leading-none tabular-nums" title="Mandati">
            {seats ?? 0}
          </span>
          <span className="text-[10px] uppercase text-slate-500">mand.</span>
        </div>
      </div>

      <div className="mt-2 grid grid-cols-[minmax(0,1fr)_auto] items-start gap-2">
        {percentMode ? (
          <div className="flex items-center gap-1">
            <ParsedInput value={percentInput} format={(v) => fmtNum(v, 4)} parse={(s) => parseDecimal(s, { max: 100 })} onCommit={(v) => dispatch({ type: 'setPercent', id: l.id, value: v })} ariaLabel={`Procenat liste ${l.name}`} />
            <span className="text-sm text-slate-500">%</span>
          </div>
        ) : (
          <ParsedInput value={l.votes} format={fmtInt} parse={parseVotes} onCommit={(v) => update({ votes: v })} ariaLabel={`Glasovi liste ${l.name}`} />
        )}
        <div className="flex flex-col items-end gap-0.5 pt-0.5">
          {status && <StatusChip status={status} />}
          <span className="text-xs tabular-nums text-slate-500">
            {percentMode ? `${fmtInt(l.votes)} gl.` : fmtPct(status?.percentValid, 2)}
          </span>
        </div>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-1">
        {STEPS.map((s) => (
          <button
            key={s}
            className="btn btn-xs tabular-nums"
            onClick={() => update({ votes: Math.max(0, l.votes + s) })}
            disabled={s < 0 && l.votes === 0}
            title={`${s > 0 ? 'Dodaj' : 'Oduzmi'} ${fmtInt(Math.abs(s))} glasova (ostale liste ostaju iste)`}
          >
            {stepLabel(s)}
          </button>
        ))}
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
        <Toggle checked={l.isMinority} onChange={(v) => update({ isMinority: v })} label={<span className="text-xs">Manjinska lista</span>} hint="Lista nacionalne manjine (čl. 140): učestvuje i ispod 3%, a količnici se uvećavaju za 35% ako je ispod 3%." />
        {l.isMinority && !minorityRules && <span className="text-[11px] text-slate-500">(manjinska pravila isključena u podešavanjima)</span>}
        {advanced && (
          <>
            <Toggle checked={l.isAggregate} onChange={(v) => update({ isAggregate: v })} label={<span className="text-xs">Zbirna stavka</span>} hint="Npr. 'Ostali' — glasovi ulaze u ukupan broj, ali stavka ne učestvuje u raspodeli." />
            <label className="flex items-center gap-1 text-xs">
              Kandidata:
              <input
                className="input w-16 py-0.5 text-right text-xs"
                type="number"
                min={0}
                max={250}
                value={l.candidates ?? ''}
                placeholder="—"
                onChange={(e) => {
                  const v = e.target.value === '' ? null : Math.max(0, Math.round(Number(e.target.value)));
                  update({ candidates: v === null || Number.isFinite(v) ? v : null });
                }}
                title="Broj kandidata na listi (čl. 129 st. 4). Prazno = bez ograničenja."
              />
            </label>
          </>
        )}
        <div className="ml-auto flex gap-1">
          <button className="btn btn-xs" onClick={() => dispatch({ type: 'moveList', id: l.id, dir: -1 })} disabled={idx === 0} aria-label="Pomeri gore" title="Pomeri gore">
            ↑
          </button>
          <button className="btn btn-xs" onClick={() => dispatch({ type: 'moveList', id: l.id, dir: 1 })} disabled={idx === count - 1} aria-label="Pomeri dole" title="Pomeri dole">
            ↓
          </button>
          <button className="btn btn-xs btn-danger" onClick={() => dispatch({ type: 'removeList', id: l.id })} aria-label={`Obriši listu ${l.name}`} title="Obriši listu">
            Obriši
          </button>
        </div>
      </div>
    </li>
  );
}
