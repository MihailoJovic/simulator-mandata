import { useMemo, useState } from 'react';
import type { ElectionResult, ElectoralList } from '../../types/election';
import { calculateMandates } from '../../calculations';
import { fmtInt, fmtQuotient } from '../../utils/format';
import { dhondtToCsv, downloadText } from '../../utils/serialization';
import { safeColor } from '../../utils/colors';
import { InfoNote, Swatch, Toggle } from '../ui';
import { multiplierLabel } from '../ResultsPanel';

const PAGE = 250;

export function DHondtTable({ lists, result }: { lists: ElectoralList[]; result: ElectionResult }) {
  const [showAll, setShowAll] = useState(false);
  const [filter, setFilter] = useState('');
  const [page, setPage] = useState(0);
  const S = result.settings.seats;
  const names = useMemo(() => Object.fromEntries(lists.map((l) => [l.id, l.name])), [lists]);
  const colors = useMemo(() => Object.fromEntries(lists.map((l) => [l.id, safeColor(l.color)])), [lists]);

  // Kompletan rang svih količnika (n × S) računa se samo na zahtev.
  const full = useMemo(
    () => (showAll ? calculateMandates(lists, result.settings, { extraQuotients: lists.length * S }) : result),
    [showAll, lists, result, S],
  );
  const ranked = full.dhondt?.ranked ?? [];
  const rows = filter ? ranked.filter((q) => q.listId === filter) : ranked;
  const pages = Math.max(1, Math.ceil(rows.length / PAGE));
  const p = Math.min(page, pages - 1);
  const visible = rows.slice(p * PAGE, (p + 1) * PAGE);

  if (!result.ok || !result.dhondt) return <p className="text-sm text-slate-500">Obračun nije dostupan (proverite greške u unosu).</p>;

  return (
    <div className="space-y-3">
      <InfoNote>
        Za svaku listu koja učestvuje u raspodeli računaju se količnici glasovi ÷ 1, 2, 3 … {S}. Količnici se rangiraju od najvećeg; prvih {S} donosi po jedan mandat.
        Kod jednakih količnika prednost ima lista sa više glasova (čl. 129 st. 3). Manjinske liste ispod cenzusa imaju količnike uvećane za {result.settings.minorityBonusPercent}% (čl. 140).
        Poređenje količnika je tačno (racionalni brojevi) — prikazane decimale su samo zaokruženje za prikaz.
      </InfoNote>
      <div className="flex flex-wrap items-center gap-3">
        <Toggle checked={showAll} onChange={(v) => { setShowAll(v); setPage(0); }} label={`Prikaži sve količnike (${fmtInt(result.qualifiedCount * S)})`} />
        <label className="flex items-center gap-1 text-sm">
          Lista:
          <select className="input w-auto py-0.5" value={filter} onChange={(e) => { setFilter(e.target.value); setPage(0); }}>
            <option value="">sve</option>
            {lists.filter((l) => result.statuses.find((s) => s.id === l.id)?.qualifies).map((l) => (
              <option key={l.id} value={l.id}>{l.name}</option>
            ))}
          </select>
        </label>
        <button className="btn btn-xs" onClick={() => downloadText('dhondt-obracun.csv', dhondtToCsv(full, names), 'text/csv;charset=utf-8')}>
          Export CSV
        </button>
        <span className="text-xs text-slate-500">{fmtInt(rows.length)} redova</span>
      </div>

      <div className="max-h-[32rem] overflow-auto rounded-md border border-slate-200 dark:border-slate-800">
        <table className="w-full min-w-[520px]">
          <thead className="sticky top-0 z-10 bg-white dark:bg-slate-900">
            <tr className="border-b border-slate-200 dark:border-slate-800">
              <th className="th text-right">Rang</th>
              <th className="th">Lista</th>
              <th className="th text-right">Glasovi</th>
              <th className="th text-right">Delilac</th>
              <th className="th text-right">Količnik</th>
              <th className="th text-center">Dobija mandat?</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((q) => {
              const isLast = q.rank === S;
              const isNext = q.rank === S + 1;
              return (
                <tr
                  key={`${q.listId}-${q.divisor}`}
                  className={`border-b border-slate-100 dark:border-slate-800 ${isLast ? 'bg-slate-200 font-semibold dark:bg-slate-700' : isNext ? 'hatch font-semibold' : !q.awarded ? 'text-slate-500' : ''} ${isLast ? 'border-b-4 border-b-slate-800 dark:border-b-slate-200' : ''}`}
                >
                  <td className="td num">
                    {q.rank}
                    {isLast && <span className="ml-1 chip chip-pass !px-1 !py-0 text-[9px]">{S}.</span>}
                    {isNext && <span className="ml-1 chip chip-fail !px-1 !py-0 text-[9px]">{S + 1}.</span>}
                  </td>
                  <td className="td">
                    <span className="flex items-center gap-1.5">
                      <Swatch color={colors[q.listId]} />
                      {names[q.listId]}
                    </span>
                  </td>
                  <td className="td num">{fmtInt(q.votes)}</td>
                  <td className="td num">
                    <span className="text-slate-500">{multiplierLabel(q)}</span>
                    {q.divisor}
                  </td>
                  <td className="td num">
                    {fmtQuotient(q.value.num, q.value.den)}
                    {q.tiedWithNeighbor && <span className="ml-1 text-[10px] font-semibold" title="Jednak količnik kao susedni red">=</span>}
                  </td>
                  <td className="td text-center">{q.awarded ? <strong>DA</strong> : <span>NE</span>}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {pages > 1 && (
        <div className="flex items-center justify-center gap-2 text-sm">
          <button className="btn btn-xs" disabled={p === 0} onClick={() => setPage(p - 1)}>← Prethodna</button>
          <span className="tabular-nums">{p + 1} / {pages}</span>
          <button className="btn btn-xs" disabled={p >= pages - 1} onClick={() => setPage(p + 1)}>Sledeća →</button>
        </div>
      )}
    </div>
  );
}
