import { useState } from 'react';
import type { ElectionResult, ElectoralList } from '../types/election';
import { calculateMajority } from '../calculations';
import { safeColor } from '../utils/colors';
import { Swatch } from './ui';

export function MajorityPanel({ lists, result }: { lists: ElectoralList[]; result: ElectionResult }) {
  const [selected, setSelected] = useState<string[]>([]);
  const S = result.settings.seats;
  const valid = selected.filter((id) => lists.some((l) => l.id === id));
  const m = calculateMajority(result.seatsByList, valid, S);
  const pct = Math.min(100, (m.groupSeats / S) * 100);

  const toggle = (id: string) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  return (
    <div className="space-y-3">
      <div className="rounded-lg bg-slate-100 px-3 py-2 text-center dark:bg-slate-800">
        <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Većina</p>
        <p className="text-2xl font-bold tabular-nums">{m.majority} mandata</p>
        <p className="text-xs text-slate-500">od {S} (⌊{S}/2⌋ + 1)</p>
      </div>

      <fieldset>
        <legend className="label mb-1">Hipotetička grupa — izaberite liste:</legend>
        <ul className="space-y-1">
          {lists.map((l) => {
            const seats = result.seatsByList[l.id] ?? 0;
            return (
              <li key={l.id}>
                <label className="flex cursor-pointer items-center gap-2 rounded px-1 py-0.5 text-sm hover:bg-slate-50 dark:hover:bg-slate-800/60">
                  <input type="checkbox" className="h-4 w-4 accent-slate-700 dark:accent-slate-300" checked={valid.includes(l.id)} onChange={() => toggle(l.id)} />
                  <Swatch color={safeColor(l.color)} />
                  <span className="min-w-0 flex-1 truncate">{l.name || '(bez naziva)'}</span>
                  <span className="tabular-nums text-slate-600 dark:text-slate-300">{seats}</span>
                  {seats >= m.majority && <span className="chip chip-pass !px-1.5 text-[9px]" title="Lista sama ima većinu">sama većina</span>}
                </label>
              </li>
            );
          })}
        </ul>
      </fieldset>

      <div className={`rounded-lg p-3 ${m.hasMajority ? 'border-2 border-slate-800 dark:border-slate-200' : 'border-2 border-dashed border-slate-400 dark:border-slate-600'}`} aria-live="polite">
        <div className="flex items-baseline justify-between">
          <span className="text-sm">Ukupno mandata:</span>
          <span className="text-2xl font-bold tabular-nums">{m.groupSeats}</span>
        </div>
        <div className="relative mt-2 h-3 rounded-full bg-slate-200 dark:bg-slate-800">
          <div className="h-full rounded-full bg-slate-700 transition-[width] dark:bg-slate-300" style={{ width: `${pct}%` }} />
          <div className="absolute -bottom-1 -top-1 w-0.5 bg-slate-900 dark:bg-white" style={{ left: `${(m.majority / S) * 100}%` }} title={`Većina: ${m.majority}`} />
        </div>
        <div className="mt-2 flex items-baseline justify-between">
          <span className="text-sm">Većina:</span>
          <span className={`text-lg font-bold ${m.hasMajority ? '' : 'text-slate-500'}`}>{m.hasMajority ? '✓ DA' : '✕ NE'}</span>
        </div>
        <p className="mt-1 text-xs text-slate-500">
          {valid.length === 0 ? 'Nijedna lista nije izabrana.' : m.hasMajority ? `${m.surplus} mandat(a) iznad većine.` : `Nedostaje ${m.missing} mandat(a).`}
        </p>
      </div>
      <p className="text-[11px] text-slate-500">Ovo nije politička preporuka niti procena — samo aritmetički zbir mandata izabranih lista.</p>
    </div>
  );
}
