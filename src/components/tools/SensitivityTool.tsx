import { useState } from 'react';
import type { ElectionResult, ElectoralList } from '../../types/election';
import { runSensitivityAnalysis, type SensitivityRow, MAX_SENSITIVITY_ROWS as MAX_SENSITIVITY_ROWS_EXPORT } from '../../calculations';
import { majorityOf } from '../../data/rules';
import { fmtInt, fmtNum, fmtPct } from '../../utils/format';
import { parseDecimal } from '../../utils/parse';
import { safeColor } from '../../utils/colors';
import { AdjustmentSelect, GroupPicker, ListSelect, pickId, toAdjustment, type AdjKind } from './common';
import { StepChart } from '../charts';
import { InfoNote } from '../ui';

export function SensitivityTool({ lists, result }: { lists: ElectoralList[]; result: ElectionResult }) {
  const S = result.settings.seats;
  const maj = majorityOf(S);
  const [variable, setVariable] = useState(() => pickId(lists, 'demo_3', 2));
  const [kind, setKind] = useState<AdjKind>('proportional');
  const [sourceId, setSourceId] = useState('');
  const [from, setFrom] = useState('0');
  const [to, setTo] = useState('5');
  const [step, setStep] = useState('0,1');
  const [group, setGroup] = useState<string[]>(() => lists.filter((l) => l.id === 'demo_1' || l.id === 'demo_4').map((l) => l.id));
  const [other, setOther] = useState(() => pickId(lists, 'demo_1', 0));
  const [out, setOut] = useState<{ rows: SensitivityRow[]; variable: string; group: string[]; ms: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const v = pickId(lists, variable);
  const src = pickId(lists.filter((l) => l.id !== v), sourceId);
  const validGroup = group.filter((id) => lists.some((l) => l.id === id));
  const names = Object.fromEntries(lists.map((l) => [l.id, l.name]));
  const colors = Object.fromEntries(lists.map((l) => [l.id, safeColor(l.color)]));
  const o = pickId(lists, other);

  const run = () => {
    setError(null);
    if (!result.ok) return setError('Prvo ispravite greške u unosu.');
    const a = parseDecimal(from, { max: 100 });
    const b = parseDecimal(to, { max: 100 });
    const c = parseDecimal(step, { max: 100 });
    if (!a.ok || !b.ok || !c.ok) return setError('Unesite ispravne brojeve za opseg i korak.');
    if (b.value < a.value) return setError('"Do" mora biti veće ili jednako "Od".');
    if (c.value <= 0) return setError('Korak mora biti veći od 0.');
    if ((b.value - a.value) / c.value + 1 > MAX_SENSITIVITY_ROWS_EXPORT) return setError(`Previše tačaka (najviše ${MAX_SENSITIVITY_ROWS_EXPORT}). Povećajte korak.`);
    const t0 = performance.now();
    const rows = runSensitivityAnalysis({ lists, settings: result.settings, variableId: v, adjustment: toAdjustment(kind, src), fromPercent: a.value, toPercent: b.value, stepPercent: c.value, groupIds: validGroup });
    setOut({ rows, variable: v, group: validGroup, ms: performance.now() - t0 });
  };

  const crossing = out?.rows.find((r) => r.thresholdChange)?.percent ?? null;
  const tableIds = out ? lists.filter((l) => l.id === out.variable || (result.seatsByList[l.id] ?? 0) > 0 || out.group.includes(l.id)).map((l) => l.id) : [];

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <ListSelect lists={lists} value={v} onChange={setVariable} label="Lista čiji se rezultat menja" />
        <AdjustmentSelect lists={lists} kind={kind} sourceId={src} excludeId={v} onChange={(k, s) => { setKind(k); setSourceId(s); }} />
      </div>
      <div className="grid grid-cols-3 gap-3">
        {([['Od %', from, setFrom], ['Do %', to, setTo], ['Korak (pp)', step, setStep]] as const).map(([label, val, set]) => (
          <label key={label} className="space-y-1">
            <span className="label">{label}</span>
            <input className="input text-right" value={val} onChange={(e) => set(e.target.value)} inputMode="decimal" />
          </label>
        ))}
      </div>
      <GroupPicker lists={lists} value={validGroup} onChange={setGroup} label="Ciljna grupa (zbir mandata):" />
      <button className="btn btn-primary" onClick={run}>
        Pokreni analizu osetljivosti
      </button>
      {error && <p className="text-sm text-rose-600">{error}</p>}

      {out && out.rows.length > 0 && (
        <div className="space-y-4">
          <InfoNote>
            Grafikoni prikazuju matematički rezultat simulacije za svaku vrednost iz opsega — ne predviđanje. Isprekidana vertikalna linija označava prelazak cenzusa{crossing !== null ? ` (${fmtNum(crossing)}%)` : ''}. {out.rows.length} tačaka · {out.ms.toFixed(0)} ms.
          </InfoNote>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <StepChart
              title={`${names[out.variable]} — rezultat → mandati liste`}
              points={out.rows.map((r) => ({ x: r.percent, y: r.seats[out.variable] ?? 0 }))}
              color={colors[out.variable]}
              formatX={(x) => `${fmtNum(x)}%`}
              xLabel={`rezultat liste ${names[out.variable]}`}
              markerX={crossing}
              markerXLabel="cenzus"
            />
            <div>
              <label className="mb-1 flex items-center gap-2 text-xs">
                Druga lista:
                <select className="input w-auto py-0.5 text-xs" value={o} onChange={(e) => setOther(e.target.value)}>
                  {lists.map((l) => (
                    <option key={l.id} value={l.id}>{l.name}</option>
                  ))}
                </select>
              </label>
              <StepChart
                title={`${names[out.variable]} rezultat → mandati liste ${names[o]}`}
                points={out.rows.map((r) => ({ x: r.percent, y: r.seats[o] ?? 0 }))}
                color={colors[o]}
                formatX={(x) => `${fmtNum(x)}%`}
                xLabel={`rezultat liste ${names[out.variable]}`}
                markerX={crossing}
                markerXLabel="cenzus"
              />
            </div>
            {out.group.length > 0 && (
              <StepChart
                title={`${names[out.variable]} rezultat → zbir mandata grupe (${out.group.map((id) => names[id]).join(' + ')})`}
                points={out.rows.map((r) => ({ x: r.percent, y: r.groupSeats }))}
                color="#475569"
                formatX={(x) => `${fmtNum(x)}%`}
                xLabel={`rezultat liste ${names[out.variable]}`}
                refY={maj}
                refYLabel={`većina ${maj}`}
                markerX={crossing}
                markerXLabel="cenzus"
              />
            )}
          </div>

          <div className="max-h-[28rem] overflow-auto rounded-md border border-slate-200 dark:border-slate-800">
            <table className="w-full">
              <thead className="sticky top-0 z-10 bg-white dark:bg-slate-900">
                <tr className="border-b border-slate-200 dark:border-slate-800">
                  <th className="th text-right">{names[out.variable]} %</th>
                  <th className="th text-right">Glasovi</th>
                  <th className="th">Cenzus</th>
                  {tableIds.map((id) => (
                    <th key={id} className="th text-right">{names[id]}</th>
                  ))}
                  {out.group.length > 0 && <th className="th text-right">Ciljna grupa</th>}
                </tr>
              </thead>
              <tbody>
                {out.rows.map((r) => (
                  <tr key={r.percent} className={`border-b border-slate-100 dark:border-slate-800 ${r.thresholdChange ? 'border-t-4 border-t-slate-800 font-semibold dark:border-t-slate-200' : ''} ${!r.passesThreshold ? 'hatch' : ''}`}>
                    <td className="td num">{fmtPct(r.percent, 2)}</td>
                    <td className="td num text-slate-500">{fmtInt(r.votes)}</td>
                    <td className="td text-xs">{r.thresholdChange ? (r.passesThreshold ? '◆ PRELAZI' : '◆ PADA ISPOD') : r.passesThreshold ? '✓' : '✕'}</td>
                    {tableIds.map((id) => (
                      <td key={id} className={`td num ${id === out.variable ? 'font-bold' : ''}`}>{r.seats[id] ?? 0}</td>
                    ))}
                    {out.group.length > 0 && <td className={`td num font-bold ${r.groupSeats >= maj ? 'underline decoration-2 underline-offset-2' : ''}`}>{r.groupSeats}{r.groupSeats >= maj ? ' ✓' : ''}</td>}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-slate-500">Šrafirani redovi: lista je ispod cenzusa. Podebljana linija: prvi red posle promene statusa cenzusa. ✓ u koloni grupe: zbir ≥ {maj}.</p>
        </div>
      )}
    </div>
  );
}
