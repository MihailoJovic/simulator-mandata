import { useEffect, useRef, useState } from 'react';
import type { ElectionResult, ElectoralList } from '../../types/election';
import { validateMCParams, type MCParams, type MCResult } from '../../calculations';
import { majorityOf } from '../../data/rules';
import { fmtInt, fmtNum, fmtPct } from '../../utils/format';
import { parseDecimal } from '../../utils/parse';
import { safeColor } from '../../utils/colors';
import { GroupPicker } from './common';
import { Histogram } from '../charts';
import { InfoNote, Swatch } from '../ui';

type RangeDraft = { on: boolean; min: string; max: string };

const round1 = (x: number) => Math.round(x * 10) / 10;

export function MonteCarloTool({ lists, result }: { lists: ElectoralList[]; result: ElectionResult }) {
  const S = result.settings.seats;
  const maj = majorityOf(S);
  const [ranges, setRanges] = useState<Record<string, RangeDraft>>({});
  const [iterations, setIterations] = useState(10_000);
  const [seed, setSeed] = useState('2026');
  const [group, setGroup] = useState<string[]>(() => lists.filter((l) => l.id === 'demo_1' || l.id === 'demo_4').map((l) => l.id));
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [out, setOut] = useState<{ r: MCResult; names: Record<string, string>; colors: Record<string, string>; groupLabel: string } | null>(null);
  const [histId, setHistId] = useState('');
  const worker = useRef<Worker | null>(null);

  useEffect(() => () => worker.current?.terminate(), []);

  const pctOf = (id: string) => result.statuses.find((s) => s.id === id)?.percentValid ?? 0;
  const draftFor = (l: ElectoralList): RangeDraft =>
    ranges[l.id] ?? { on: !l.isAggregate && l.votes > 0, min: fmtNum(Math.max(0, round1(pctOf(l.id) - 2.5)), 1), max: fmtNum(Math.min(100, round1(pctOf(l.id) + 2.5)), 1) };
  const setDraft = (id: string, patch: Partial<RangeDraft>) => {
    const l = lists.find((x) => x.id === id)!;
    setRanges((r) => ({ ...r, [id]: { ...draftFor(l), ...patch } }));
  };
  const validGroup = group.filter((id) => lists.some((l) => l.id === id));

  const run = () => {
    setError(null);
    if (!result.ok) return setError('Prvo ispravite greške u unosu.');
    const rs: MCParams['ranges'] = [];
    for (const l of lists) {
      const d = draftFor(l);
      if (!d.on) continue;
      const a = parseDecimal(d.min, { max: 100 });
      const b = parseDecimal(d.max, { max: 100 });
      if (!a.ok || !b.ok) return setError(`Neispravan opseg za listu "${l.name}".`);
      rs.push({ id: l.id, minPercent: a.value, maxPercent: b.value });
    }
    const sd = Number(seed);
    const params: MCParams = {
      lists,
      settings: result.settings,
      ranges: rs,
      iterations,
      seed: Number.isFinite(sd) ? Math.abs(Math.round(sd)) : 1,
      totalVotes: result.totalValidVotes,
      groups: validGroup.length ? [{ name: 'Grupa', ids: validGroup }] : [],
    };
    const errs = validateMCParams(params);
    if (errs.length) return setError(errs.join(' '));

    worker.current?.terminate();
    const w = new Worker(new URL('../../workers/monteCarlo.worker.ts', import.meta.url), { type: 'module' });
    worker.current = w;
    setRunning(true);
    setProgress(0);
    const names = Object.fromEntries(lists.map((l) => [l.id, l.name]));
    const colors = Object.fromEntries(lists.map((l) => [l.id, safeColor(l.color)]));
    const groupLabel = validGroup.map((id) => names[id]).join(' + ');
    w.onmessage = (e) => {
      const m = e.data;
      if (m.type === 'progress') setProgress(m.done);
      else {
        setRunning(false);
        w.terminate();
        worker.current = null;
        if (m.type === 'done') {
          setOut({ r: m.result, names, colors, groupLabel });
          setHistId((h) => (m.result.lists.some((x: { id: string }) => x.id === h) ? h : m.result.lists[0]?.id ?? ''));
        } else setError(m.message);
      }
    };
    w.onerror = (e) => {
      setRunning(false);
      setError(`Greška u simulaciji: ${e.message}`);
    };
    w.postMessage(params);
  };

  const cancel = () => {
    worker.current?.terminate();
    worker.current = null;
    setRunning(false);
  };

  const sumMin = lists.reduce((a, l) => {
    const d = draftFor(l);
    const p = parseDecimal(d.min);
    return a + (d.on && p.ok ? p.value : 0);
  }, 0);
  const pctN = (n: number) => (out ? fmtPct((n / out.r.iterations) * 100, 1) : '');

  return (
    <div className="space-y-3">
      <InfoNote>
        <strong>Ovo nije izborna prognoza.</strong> Simulator nasumično (uniformno) bira rezultate unutar opsega koje ste zadali i za svaku kombinaciju računa mandate. Statistika opisuje samo taj, vama zadat prostor scenarija — ne verovatnoću stvarnog ishoda.
        Liste bez opsega dele ostatak do 100% u odnosu na trenutne glasove. Ukupan broj važećih glasova: {fmtInt(result.totalValidVotes)}.
      </InfoNote>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[420px]">
          <thead>
            <tr className="border-b border-slate-200 dark:border-slate-800">
              <th className="th">Lista</th>
              <th className="th text-right">Trenutno</th>
              <th className="th text-center">Nasumično</th>
              <th className="th text-right">Od %</th>
              <th className="th text-right">Do %</th>
            </tr>
          </thead>
          <tbody>
            {lists.map((l) => {
              const d = draftFor(l);
              return (
                <tr key={l.id} className="border-b border-slate-100 dark:border-slate-800">
                  <td className="td">
                    <span className="flex items-center gap-1.5">
                      <Swatch color={safeColor(l.color)} />
                      {l.name}
                    </span>
                  </td>
                  <td className="td num text-slate-500">{fmtPct(pctOf(l.id), 2)}</td>
                  <td className="td text-center">
                    <input type="checkbox" className="h-4 w-4 accent-slate-700" checked={d.on} onChange={(e) => setDraft(l.id, { on: e.target.checked })} aria-label={`Nasumičan rezultat za ${l.name}`} />
                  </td>
                  <td className="td">
                    <input className="input w-20 py-0.5 text-right" disabled={!d.on} value={d.min} onChange={(e) => setDraft(l.id, { min: e.target.value })} inputMode="decimal" />
                  </td>
                  <td className="td">
                    {d.on ? (
                      <input className="input w-20 py-0.5 text-right" value={d.max} onChange={(e) => setDraft(l.id, { max: e.target.value })} inputMode="decimal" />
                    ) : (
                      <span className="text-xs text-slate-500">ostatak</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {sumMin > 100 && <p className="text-sm text-rose-600">Zbir minimalnih vrednosti je {fmtNum(sumMin)}% — veći od 100%.</p>}

      <GroupPicker lists={lists} value={validGroup} onChange={setGroup} label="Grupa za proveru većine (zbir mandata):" />

      <div className="flex flex-wrap items-end gap-3">
        <label className="space-y-1">
          <span className="label block">Broj simulacija</span>
          <select className="input w-auto" value={iterations} onChange={(e) => setIterations(Number(e.target.value))}>
            {[1_000, 10_000, 100_000].map((n) => (
              <option key={n} value={n}>{fmtInt(n)}</option>
            ))}
          </select>
        </label>
        <label className="space-y-1">
          <span className="label block">Seed (ponovljivost)</span>
          <input className="input w-28" value={seed} onChange={(e) => setSeed(e.target.value.replace(/\D/g, ''))} inputMode="numeric" />
        </label>
        {running ? (
          <button className="btn" onClick={cancel}>Prekini</button>
        ) : (
          <button className="btn btn-primary" onClick={run}>Generiši scenarije</button>
        )}
      </div>
      {running && (
        <div className="h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800" role="progressbar" aria-valuenow={progress} aria-valuemax={iterations}>
          <div className="h-full bg-slate-700 transition-[width] dark:bg-slate-300" style={{ width: `${(progress / iterations) * 100}%` }} />
        </div>
      )}
      {error && <p className="text-sm text-rose-600">{error}</p>}

      {out && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Stat label="Broj simulacija" value={fmtInt(out.r.iterations)} />
            <Stat label="Odbačeno (zbir > 100%)" value={fmtInt(out.r.rejected)} />
            <Stat label="Vreme" value={`${(out.r.ms / 1000).toFixed(2)} s`} />
          </div>
          {out.r.groups.map((g) => (
            <div key={g.name} className="rounded-lg border-2 border-slate-800 p-3 dark:border-slate-200">
              <p className="text-xs uppercase tracking-wide text-slate-500">{out.groupLabel} ≥ {out.r.majority}</p>
              <p className="text-xl font-bold tabular-nums">
                {fmtInt(g.majorityCount)} <span className="text-base font-normal text-slate-500">od {fmtInt(out.r.iterations)} simulacija ({pctN(g.majorityCount)})</span>
              </p>
              <p className="text-xs text-slate-500">Zbir mandata: prosek {fmtNum(g.mean, 1)} · min {g.min} · maks {g.max}</p>
            </div>
          ))}
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px]">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800">
                  <th className="th">Lista</th>
                  <th className="th text-right">Prosečan %</th>
                  <th className="th text-right">Prosek mand.</th>
                  <th className="th text-right">Min</th>
                  <th className="th text-right">Maks</th>
                  <th className="th text-right">Std</th>
                  <th className="th text-right">Prelazi cenzus</th>
                  <th className="th text-right">≥ 1 mandat</th>
                  <th className="th text-right">Sama ≥ {maj}</th>
                </tr>
              </thead>
              <tbody>
                {out.r.lists.map((s) => (
                  <tr key={s.id} className="border-b border-slate-100 dark:border-slate-800">
                    <td className="td">
                      <span className="flex items-center gap-1.5">
                        <Swatch color={out.colors[s.id]} />
                        {out.names[s.id]}
                      </span>
                    </td>
                    <td className="td num">{fmtPct(s.meanPercent, 2)}</td>
                    <td className="td num font-bold">{fmtNum(s.mean, 1)}</td>
                    <td className="td num">{s.min}</td>
                    <td className="td num">{s.max}</td>
                    <td className="td num text-slate-500">{fmtNum(s.std, 1)}</td>
                    <td className="td num">{fmtInt(s.passedCount)} <span className="text-xs text-slate-500">({pctN(s.passedCount)})</span></td>
                    <td className="td num">{fmtInt(s.seatsPositiveCount)}</td>
                    <td className="td num">{fmtInt(s.majorityCount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {out.r.warnings.map((w) => (
            <p key={w} className="text-xs text-slate-500">{w}</p>
          ))}
          <div>
            <label className="mb-1 flex items-center gap-2 text-xs">
              Raspodela broja mandata za listu:
              <select className="input w-auto py-0.5 text-xs" value={histId} onChange={(e) => setHistId(e.target.value)}>
                {out.r.lists.map((s) => (
                  <option key={s.id} value={s.id}>{out.names[s.id]}</option>
                ))}
              </select>
            </label>
            {(() => {
              const s = out.r.lists.find((x) => x.id === histId);
              return s ? <Histogram title={`${out.names[s.id]} — broj mandata po simulaciji (udeo simulacija)`} counts={s.histogram} color={out.colors[s.id]} total={out.r.iterations} refX={s.max >= maj - 20 ? maj : undefined} /> : null;
            })()}
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-slate-100 px-3 py-2 dark:bg-slate-800">
      <p className="text-xs text-slate-500 dark:text-slate-400">{label}</p>
      <p className="text-lg font-bold tabular-nums">{value}</p>
    </div>
  );
}
