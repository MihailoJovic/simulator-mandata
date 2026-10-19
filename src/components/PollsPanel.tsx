import { useMemo, useState } from 'react';
import type { ElectoralList, Scenario } from '../types/election';
import { POLLS, type Poll } from '../data/polls';
import { LEGAL_DEFAULTS } from '../data/rules';
import { percentagesToVotes } from '../calculations';
import { normalizeName } from '../calculations/scenarios';
import { NEUTRAL_PALETTE } from '../utils/colors';
import { fmtInt, fmtNum, fmtPct } from '../utils/format';
import { InfoNote } from './ui';

const BASE_VOTES = 3_700_000;

/** Pravi scenario za simulator od rezultata ankete (ostatak do 100% → zbirna stavka). */
export function pollToScenario(name: string, results: Poll['results']): Scenario {
  const sum = results.reduce((a, r) => a + r.percent, 0);
  const rows = [...results];
  if (sum < 100 - 1e-9) rows.push({ name: 'Ostali / neraspoređeno (zbirno)', percent: 100 - sum });
  const votes = percentagesToVotes(rows.map((r) => r.percent), BASE_VOTES);
  const lists: ElectoralList[] = rows.map((r, i) => {
    const aggregate = i >= results.length;
    return {
      id: `poll_${i + 1}`,
      name: r.name,
      votes: votes[i],
      isMinority: !!r.isMinority,
      isAggregate: aggregate,
      color: aggregate ? NEUTRAL_PALETTE.aggregate : NEUTRAL_PALETTE.series[i % NEUTRAL_PALETTE.series.length],
      candidates: null,
    };
  });
  return { id: `sc_poll_${Date.now().toString(36)}`, name, createdAt: new Date().toISOString(), lists, settings: { ...LEGAL_DEFAULTS }, inputMode: 'percent' };
}

/** Prost (neponderisan) prosek izabranih anketa; liste se uparuju po nazivu. */
export function averagePolls(polls: Poll[]): Poll['results'] {
  const acc = new Map<string, { name: string; sum: number; n: number; isMinority?: boolean }>();
  for (const p of polls)
    for (const r of p.results) {
      const k = normalizeName(r.name);
      const e = acc.get(k) ?? { name: r.name, sum: 0, n: 0, isMinority: r.isMinority };
      e.sum += r.percent;
      e.n += 1;
      acc.set(k, e);
    }
  // Lista koja nije u nekoj anketi računa se kao 0 u toj anketi.
  return [...acc.values()].map((e) => ({ name: e.name, percent: Math.round((e.sum / polls.length) * 100) / 100, isMinority: e.isMinority })).sort((a, b) => b.percent - a.percent);
}

export function PollsPanel({ onSimulate }: { onSimulate: (sc: Scenario) => void }) {
  const [picked, setPicked] = useState<string[]>(() => POLLS.map((p) => p.id));
  const chosen = POLLS.filter((p) => picked.includes(p.id));
  const avg = useMemo(() => (chosen.length > 1 ? averagePolls(chosen) : null), [chosen]);

  if (POLLS.length === 0) {
    return (
      <div className="space-y-3 text-sm">
        <InfoNote>Podaci iz anketa još nisu uneti u ovu verziju aplikacije. Biće dodati u sledećem ažuriranju.</InfoNote>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <InfoNote>
        <strong>Opciono.</strong> Prikazani su rezultati anketa onako kako su ih agencije objavile. Simulator ih ne proverava, ne ponderiše i ne predviđa ishod izbora — dugme „Simuliraj” samo računa raspodelu mandata <em>kada bi</em> rezultat bio jednak anketi. Deo do 100% (neopredeljeni, ostali) ulazi kao zbirna stavka bez mandata.
      </InfoNote>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {POLLS.map((p) => (
          <PollCard key={p.id} poll={p} checked={picked.includes(p.id)} onCheck={(v) => setPicked((s) => (v ? [...s, p.id] : s.filter((x) => x !== p.id)))} onSimulate={() => onSimulate(pollToScenario(`Anketa: ${p.agency} (${p.fieldwork})`, p.results))} />
        ))}
      </div>

      {avg && (
        <div className="rounded-xl border-2 border-slate-800 p-3 dark:border-slate-200">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <p className="font-semibold">Prosek izabranih anketa ({chosen.length})</p>
            <button className="btn btn-primary btn-xs" onClick={() => onSimulate(pollToScenario(`Prosek anketa: ${chosen.map((c) => c.agency).join(', ')}`, avg))}>
              Simuliraj prosek
            </button>
          </div>
          <Bars results={avg} />
          <p className="mt-2 text-[11px] text-slate-500">Prost aritmetički prosek, bez ponderisanja po veličini uzorka ili datumu; lista koja nije merena u nekoj anketi računa se kao 0%.</p>
        </div>
      )}
    </div>
  );
}

function PollCard({ poll, checked, onCheck, onSimulate }: { poll: Poll; checked: boolean; onCheck: (v: boolean) => void; onSimulate: () => void }) {
  return (
    <div className="rounded-xl border border-slate-200 p-3 dark:border-slate-800">
      <div className="mb-2 flex items-start justify-between gap-2">
        <label className="flex cursor-pointer items-start gap-2">
          <input type="checkbox" className="mt-1 h-4 w-4 accent-slate-700" checked={checked} onChange={(e) => onCheck(e.target.checked)} title="Uključi u prosek" />
          <span>
            <span className="block font-semibold">{poll.agency}</span>
            <span className="block text-xs text-slate-500">
              Teren: {poll.fieldwork}
              {poll.sample ? ` · uzorak ${fmtInt(poll.sample)}` : ''}
              {poll.published ? ` · objavljeno ${poll.published}` : ''}
            </span>
          </span>
        </label>
        <button className="btn btn-xs" onClick={onSimulate}>Simuliraj</button>
      </div>
      <Bars results={poll.results} />
      {poll.note && <p className="mt-2 text-[11px] text-slate-500">{poll.note}</p>}
      {poll.source && (
        <a className="mt-1 block truncate text-[11px] text-slate-500 underline" href={poll.source} target="_blank" rel="noreferrer noopener">
          Izvor
        </a>
      )}
    </div>
  );
}

function Bars({ results }: { results: Poll['results'] }) {
  const max = Math.max(...results.map((r) => r.percent), 1);
  return (
    <ul className="space-y-1">
      {results.map((r, i) => (
        <li key={r.name} className="grid grid-cols-[minmax(0,8rem)_1fr_3.5rem] items-center gap-2 text-sm">
          <span className="truncate" title={r.name}>
            {r.name}
          </span>
          <span className="h-3 rounded-r-[4px] bg-slate-100 dark:bg-slate-800">
            <span className="block h-full rounded-r-[4px]" style={{ width: `${(r.percent / max) * 100}%`, background: NEUTRAL_PALETTE.series[i % NEUTRAL_PALETTE.series.length] }} />
          </span>
          <span className="text-right tabular-nums">{fmtPct(r.percent, r.percent % 1 ? 1 : 0)}</span>
        </li>
      ))}
      <li className="pt-1 text-right text-[11px] text-slate-500">Zbir: {fmtNum(results.reduce((a, r) => a + r.percent, 0), 1)}%</li>
    </ul>
  );
}
