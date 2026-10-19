import type { ElectionResult, ElectoralList, Quotient } from '../../types/election';
import { fmtInt, fmtMs, fmtNum, fmtQuotient } from '../../utils/format';

export function DebugPanel({ lists, result }: { lists: ElectoralList[]; result: ElectionResult }) {
  const names = Object.fromEntries(lists.map((l) => [l.id, l.name]));
  const d = result.dhondt;
  const q = (x: Quotient | null) =>
    x ? `#${x.rank} ${names[x.listId]} — ${fmtInt(x.votes)} ÷ ${x.divisor} = ${fmtQuotient(x.value.num, x.value.den)} (tačno: ${x.value.num}/${x.value.den})` : '—';
  const rows: Array<[string, string]> = [
    ['Validan ulaz', result.ok ? 'DA' : 'NE'],
    ['Ukupno važećih glasova', fmtInt(result.totalValidVotes)],
    ['Birači koji su glasali (važeći + nevažeći)', fmtInt(result.votersWhoVoted)],
    ['Osnova za cenzus', `${fmtInt(result.thresholdBaseVotes)} (${result.settings.thresholdBase === 'voters' ? 'birači koji su glasali' : 'važeći glasovi'})`],
    ['Cenzus', `${fmtNum(result.settings.thresholdPercent, 6)}% → min. ${fmtInt(result.minVotesToPass)} glasova`],
    ['Kvalifikovane liste', String(result.qualifiedCount)],
    ['Diskvalifikovane liste', String(result.disqualifiedCount)],
    ['Primenjen čl. 128 st. 2', result.noListPassedApplied ? 'DA' : 'NE'],
    ['Ukupno relevantnih količnika (n × S)', fmtInt(result.qualifiedCount * result.settings.seats)],
    ['Dodeljeno mandata', `${result.totalSeatsAllocated} / ${result.settings.seats}`],
    ['Nedodeljeno', String(d?.unallocated ?? 0)],
    [`${result.settings.seats}. količnik`, q(d?.lastAwarded ?? null)],
    [`${result.settings.seats + 1}. količnik`, q(d?.firstNotAwarded ?? null)],
    ['Izjednačenja na granici', d?.ties.length ? d.ties.map((t) => (t.unresolvedByLaw ? 'NEREŠENO PO ZAKONU' : 'rešeno po glasovima')).join(', ') : 'nema'],
    ['Vreme obračuna', fmtMs(result.computeMs)],
  ];
  return (
    <div className="space-y-3">
      <table className="w-full">
        <tbody className="divide-y divide-slate-100 font-mono text-xs dark:divide-slate-800">
          {rows.map(([k, v]) => (
            <tr key={k}>
              <td className="py-1 pr-3 text-slate-500">{k}</td>
              <td className="break-all py-1">{v}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div>
        <p className="label mb-1">Validacija ({result.issues.length})</p>
        {result.issues.length === 0 ? (
          <p className="font-mono text-xs">Nema grešaka ni upozorenja.</p>
        ) : (
          <ul className="space-y-0.5 font-mono text-xs">
            {result.issues.map((i, k) => (
              <li key={k}>
                [{i.level.toUpperCase()}] {i.code}: {i.message}
              </li>
            ))}
          </ul>
        )}
      </div>
      <details>
        <summary className="cursor-pointer text-xs font-semibold">Statusi lista (JSON)</summary>
        <pre className="mt-1 max-h-64 overflow-auto rounded bg-slate-100 p-2 text-[11px] dark:bg-slate-950">{JSON.stringify(result.statuses, null, 2)}</pre>
      </details>
      <p className="text-xs text-slate-500">Sve relevantne količnike vidite u kartici „D'Hondt obračun” uz opciju „Prikaži sve količnike”.</p>
    </div>
  );
}
