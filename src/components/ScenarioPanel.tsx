import { useMemo, useState } from 'react';
import type { Scenario } from '../types/election';
import type { SimState } from '../hooks/useSimulator';
import { compareScenarios } from '../calculations';
import { fmtDate, fmtSigned } from '../utils/format';
import { Modal } from './ui';

const CURRENT = '__current__';

export function ScenarioPanel({
  state,
  scenarios,
  onSave,
  onLoad,
  onDelete,
}: {
  state: SimState;
  scenarios: Scenario[];
  onSave: (name: string) => void;
  onLoad: (sc: Scenario) => void;
  onDelete: (id: string) => void;
}) {
  const [name, setName] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const [showCompare, setShowCompare] = useState(false);

  const toggle = (id: string) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  const validSel = selected.filter((id) => id === CURRENT || scenarios.some((s) => s.id === id));

  return (
    <div className="space-y-3">
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          onSave(name.trim() || `Scenario ${String.fromCharCode(65 + (scenarios.length % 26))}`);
          setName('');
        }}
      >
        <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder='Naziv, npr. "ES ispod cenzusa"' maxLength={80} aria-label="Naziv scenarija" />
        <button className="btn btn-primary shrink-0" type="submit" disabled={state.lists.length === 0}>
          Sačuvaj
        </button>
      </form>

      <ul className="space-y-1">
        <li className="flex items-center gap-2 rounded px-1 py-0.5 text-sm">
          <input type="checkbox" className="h-4 w-4 accent-slate-700 dark:accent-slate-300" checked={validSel.includes(CURRENT)} onChange={() => toggle(CURRENT)} id="sc-current" />
          <label htmlFor="sc-current" className="flex-1 italic">
            Trenutni (nesačuvan)
          </label>
        </li>
        {scenarios.map((s) => (
          <li key={s.id} className="flex items-center gap-2 rounded px-1 py-0.5 text-sm hover:bg-slate-50 dark:hover:bg-slate-800/60">
            <input type="checkbox" className="h-4 w-4 accent-slate-700 dark:accent-slate-300" checked={validSel.includes(s.id)} onChange={() => toggle(s.id)} id={`sc-${s.id}`} />
            <label htmlFor={`sc-${s.id}`} className="min-w-0 flex-1">
              <span className="block truncate font-medium">{s.name}</span>
              <span className="block text-[11px] text-slate-500">{fmtDate(s.createdAt)} · {s.lists.length} lista</span>
            </label>
            <button className="btn btn-xs" onClick={() => onLoad(s)} title="Učitaj u simulator">
              Učitaj
            </button>
            <button className="btn btn-xs btn-danger" onClick={() => onDelete(s.id)} aria-label={`Obriši scenario ${s.name}`}>
              ✕
            </button>
          </li>
        ))}
        {scenarios.length === 0 && <li className="px-1 text-xs text-slate-500">Još nema sačuvanih scenarija.</li>}
      </ul>

      <button className="btn w-full" disabled={validSel.length < 2} onClick={() => setShowCompare(true)}>
        Uporedi izabrane ({validSel.length})
      </button>
      {validSel.length < 2 && <p className="text-[11px] text-slate-500">Izaberite najmanje dva scenarija za poređenje.</p>}

      <Modal open={showCompare} onClose={() => setShowCompare(false)} title="Poređenje scenarija" wide>
        <ComparisonTable
          scenarios={validSel.map((id) =>
            id === CURRENT
              ? { name: 'Trenutni', lists: state.lists, settings: state.settings }
              : (() => {
                  const s = scenarios.find((x) => x.id === id)!;
                  return { name: s.name, lists: s.lists, settings: s.settings };
                })(),
          )}
        />
      </Modal>
    </div>
  );
}

export function DiffCell({ v }: { v: number }) {
  if (v === 0) return <span className="text-slate-400">0</span>;
  return (
    <span className={`font-semibold ${v > 0 ? '' : 'text-slate-500 dark:text-slate-400'}`}>
      {v > 0 ? '▲' : '▼'} {fmtSigned(v)}
    </span>
  );
}

export function ComparisonTable({ scenarios }: { scenarios: Parameters<typeof compareScenarios>[0] }) {
  const c = useMemo(() => compareScenarios(scenarios), [scenarios]);
  return (
    <div className="space-y-2">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="border-b border-slate-200 dark:border-slate-800">
            <tr>
              <th className="th">Lista</th>
              {c.names.map((n, i) => (
                <th key={i} className="th text-right" colSpan={i === 0 ? 1 : 2}>
                  {n}
                </th>
              ))}
            </tr>
            <tr className="text-[10px]">
              <th />
              {c.names.map((_, i) =>
                i === 0 ? (
                  <th key={i} className="th text-right">mandati</th>
                ) : (
                  [
                    <th key={`${i}a`} className="th text-right">mandati</th>,
                    <th key={`${i}b`} className="th text-right">razlika</th>,
                  ]
                ),
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {c.rows.map((r) => (
              <tr key={r.key}>
                <td className="td">{r.name}</td>
                {r.seats.map((s, i) =>
                  i === 0 ? (
                    <td key={i} className="td num">{s ?? '—'}</td>
                  ) : (
                    [
                      <td key={`${i}a`} className="td num">{s ?? '—'}</td>,
                      <td key={`${i}b`} className="td num"><DiffCell v={r.diffs[i]} /></td>,
                    ]
                  ),
                )}
              </tr>
            ))}
          </tbody>
          <tfoot className="border-t-2 border-slate-300 font-semibold dark:border-slate-700">
            <tr>
              <td className="td">Ukupno</td>
              {c.totals.map((t, i) =>
                i === 0 ? (
                  <td key={i} className="td num">{t}</td>
                ) : (
                  [
                    <td key={`${i}a`} className="td num">{t}</td>,
                    <td key={`${i}b`} className="td num"><DiffCell v={c.totalDiffs[i]} /></td>,
                  ]
                ),
              )}
            </tr>
          </tfoot>
        </table>
      </div>
      {c.invalid.length > 0 && <p className="text-xs text-rose-600">Scenariji sa nevalidnim podacima nisu obračunati: {c.invalid.map((i) => c.names[i]).join(', ')}.</p>}
      <p className="text-xs text-slate-500">Razlika se računa u odnosu na prvi scenario („{c.names[0]}”). Liste se uparuju po nazivu; „—” znači da lista ne postoji u tom scenariju.</p>
    </div>
  );
}
