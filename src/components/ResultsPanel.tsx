import { useMemo, useState } from 'react';
import type { ElectionResult, ElectoralList, Quotient } from '../types/election';
import { majorityOf } from '../data/rules';
import { fmtInt, fmtNum, fmtPct, fmtQuotient } from '../utils/format';
import { safeColor } from '../utils/colors';
import { Swatch } from './ui';
import { StatusChip } from './StatusChip';

/* ─────────────────── Velika vizuelna raspodela ─────────────────── */

export function SeatDistribution({ lists, result }: { lists: ElectoralList[]; result: ElectionResult }) {
  const S = result.settings.seats;
  const maj = majorityOf(S);
  const withSeats = lists
    .map((l) => ({ l, seats: result.seatsByList[l.id] ?? 0 }))
    .filter((x) => x.seats > 0)
    .sort((a, b) => b.seats - a.seats);
  const [hover, setHover] = useState<string | null>(null);
  const complete = result.totalSeatsAllocated === S;

  return (
    <div>
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Većina: <strong className="text-slate-900 dark:text-slate-100">{maj} mandata</strong>
        </p>
        <p className={`text-2xl font-bold tabular-nums ${complete ? '' : 'text-amber-700 dark:text-amber-400'}`} aria-live="polite">
          {result.totalSeatsAllocated} / {S}
        </p>
      </div>

      {/* Stacked bar */}
      <div className="relative">
        <div className="flex h-12 w-full overflow-hidden rounded-md bg-slate-100 dark:bg-slate-800" role="img" aria-label="Raspodela mandata">
          {withSeats.map(({ l, seats }, i) => (
            <div
              key={l.id}
              className="h-full transition-[width] duration-200"
              style={{
                width: `${(seats / S) * 100}%`,
                background: safeColor(l.color),
                marginLeft: i ? 2 : 0,
                opacity: hover && hover !== l.id ? 0.45 : 1,
              }}
              onMouseEnter={() => setHover(l.id)}
              onMouseLeave={() => setHover(null)}
              title={`${l.name}: ${seats} mandata (${fmtPct((seats / S) * 100, 1)})`}
            />
          ))}
        </div>
        {/* Linija većine */}
        <div className="pointer-events-none absolute -bottom-1 -top-1 w-0.5 bg-slate-900 dark:bg-white" style={{ left: `calc(${(maj / S) * 100}% - 1px)` }} />
        <div className="pointer-events-none absolute -top-5 -translate-x-1/2 text-[10px] font-semibold uppercase text-slate-600 dark:text-slate-300" style={{ left: `${(maj / S) * 100}%` }}>
          {maj}
        </div>
      </div>

      {/* Redovi po listama */}
      <ul className="mt-4 space-y-1.5">
        {withSeats.map(({ l, seats }) => (
          <li key={l.id} className="grid grid-cols-[minmax(0,9rem)_1fr_2.5rem] items-center gap-2 text-sm sm:grid-cols-[minmax(0,12rem)_1fr_3rem]" onMouseEnter={() => setHover(l.id)} onMouseLeave={() => setHover(null)}>
            <span className="flex min-w-0 items-center gap-1.5">
              <Swatch color={safeColor(l.color)} />
              <span className="truncate font-medium uppercase tracking-wide" title={l.name}>
                {l.name}
              </span>
            </span>
            <span className="relative h-4 rounded-sm bg-slate-100 dark:bg-slate-800">
              <span className="absolute inset-y-0 left-0 rounded-r-[4px]" style={{ width: `${(seats / S) * 100}%`, background: safeColor(l.color) }} />
              <span className="absolute inset-y-[-2px] w-px bg-slate-400 dark:bg-slate-500" style={{ left: `${(maj / S) * 100}%` }} />
            </span>
            <span className="text-right font-bold tabular-nums">{seats}</span>
          </li>
        ))}
        {withSeats.length === 0 && <li className="text-sm text-slate-500">Nijedna lista nema mandate.</li>}
      </ul>
    </div>
  );
}

/* ─────────────────── Tabela rezultata (sortiranje) ─────────────────── */

type SortKey = 'order' | 'name' | 'votes' | 'percent' | 'seats';

export function ResultsTable({ lists, result }: { lists: ElectoralList[]; result: ElectionResult }) {
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: 'seats', dir: -1 });
  const maj = majorityOf(result.settings.seats);
  const statusById = useMemo(() => new Map(result.statuses.map((s) => [s.id, s])), [result.statuses]);

  const rows = useMemo(() => {
    const r = lists.map((l, i) => ({ l, i, st: statusById.get(l.id), seats: result.seatsByList[l.id] ?? 0 }));
    const val = (x: (typeof r)[number]): number | string => {
      switch (sort.key) {
        case 'name':
          return x.l.name.toLocaleLowerCase('sr');
        case 'votes':
        case 'percent':
          return x.l.votes;
        case 'seats':
          return x.seats * 1e10 + x.l.votes; // izjednačeni mandati → po glasovima
        default:
          return -x.i;
      }
    };
    return r.sort((a, b) => {
      const va = val(a);
      const vb = val(b);
      const c = typeof va === 'string' ? va.localeCompare(vb as string, 'sr') : (va as number) - (vb as number);
      return c * sort.dir || a.i - b.i;
    });
  }, [lists, statusById, result.seatsByList, sort]);

  const head = (key: SortKey, label: string, right = false) => (
    <th className={`th ${right ? 'text-right' : ''}`} aria-sort={sort.key === key ? (sort.dir === 1 ? 'ascending' : 'descending') : 'none'}>
      <button
        className="inline-flex items-center gap-1 uppercase hover:text-slate-900 dark:hover:text-white"
        onClick={() => setSort((s) => ({ key, dir: s.key === key ? (s.dir === 1 ? -1 : 1) : key === 'name' ? 1 : -1 }))}
      >
        {label}
        <span className="text-[10px]">{sort.key === key ? (sort.dir === 1 ? '▲' : '▼') : '↕'}</span>
      </button>
    </th>
  );

  return (
    <div className="-mx-4 overflow-x-auto px-4">
      <table className="w-full min-w-[560px]">
        <thead className="border-b border-slate-200 dark:border-slate-800">
          <tr>
            {head('name', 'Lista')}
            {head('votes', 'Glasovi', true)}
            {head('percent', '%', true)}
            <th className="th text-right">Cenzus</th>
            <th className="th">Status</th>
            {head('seats', 'Mandati', true)}
            <th className="th text-center" title={`Da li lista sama ima ${maj} ili više mandata`}>
              Sama većina
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
          {rows.map(({ l, st, seats }) => (
            <tr key={l.id} className={st && !st.qualifies ? 'text-slate-500' : ''}>
              <td className="td max-w-[14rem]">
                <span className="flex items-center gap-1.5">
                  <Swatch color={safeColor(l.color)} />
                  <span className="truncate" title={l.name}>
                    {l.name || <em className="text-rose-600">(bez naziva)</em>}
                  </span>
                  {l.isMinority && <span className="chip chip-special !px-1 !py-0 text-[9px]" title="Manjinska lista">MNJ</span>}
                </span>
              </td>
              <td className="td num">{fmtInt(l.votes)}</td>
              <td className="td num">{fmtPct(st?.percentValid, 2)}</td>
              <td className="td num text-slate-500">{fmtPct(result.settings.thresholdPercent, result.settings.thresholdPercent % 1 ? 2 : 0)}</td>
              <td className="td">{st && <StatusChip status={st} />}</td>
              <td className="td num text-base font-bold">{seats}</td>
              <td className="td text-center text-xs">{seats >= maj ? <span className="chip chip-pass">DA</span> : <span className="text-slate-400">ne</span>}</td>
            </tr>
          ))}
        </tbody>
        <tfoot className="border-t-2 border-slate-300 font-semibold dark:border-slate-700">
          <tr>
            <td className="td">Ukupno</td>
            <td className="td num">{fmtInt(result.totalValidVotes)}</td>
            <td className="td num">{result.totalValidVotes > 0 ? '100,00%' : '—'}</td>
            <td className="td" />
            <td className="td text-xs font-normal text-slate-500">
              {result.qualifiedCount} učestvuje · {result.disqualifiedCount} ne
            </td>
            <td className="td num text-base">{result.totalSeatsAllocated}</td>
            <td className="td" />
          </tr>
        </tfoot>
      </table>
      {result.settings.thresholdBase === 'voters' && result.settings.invalidBallots > 0 && (
        <p className="mt-2 text-xs text-slate-500">
          % je udeo u važećim glasovima. Cenzus se računa od broja birača koji su glasali ({fmtInt(result.votersWhoVoted)}, uključujući {fmtInt(result.settings.invalidBallots)} nevažećih listića) — potrebno je najmanje {fmtInt(result.minVotesToPass)} glasova.
        </p>
      )}
    </div>
  );
}

/* ─────────────────── Granica poslednjeg mandata ─────────────────── */

/** Koliko bi glasova lista sa 251. količnikom morala da ima da bi njen količnik bio VEĆI od 250. (ostalo nepromenjeno). */
export function votesToOvertake(last: Quotient, next: Quotient): number {
  // q2 · v / v2 > q1  ⇔  v > n1 · v2 · den2 / (den1 · num2)
  const n = BigInt(last.value.num) * BigInt(next.votes) * BigInt(next.value.den);
  const d = BigInt(last.value.den) * BigInt(next.value.num);
  if (d === 0n) return 0;
  return Number(n / d + 1n);
}

export function BoundaryCard({ result, names }: { result: ElectionResult; names: Record<string, string> }) {
  const d = result.dhondt;
  const last = d?.lastAwarded ?? null;
  const next = d?.firstNotAwarded ?? null;
  const S = result.settings.seats;
  const tie = d?.ties[0];
  const need = last && next ? votesToOvertake(last, next) - next.votes : null;

  const Box = ({ q, label, strong }: { q: Quotient | null; label: string; strong?: boolean }) => (
    <div className={`rounded-lg p-3 ${strong ? 'border-2 border-slate-800 dark:border-slate-200' : 'hatch border-2 border-dashed border-slate-400 dark:border-slate-600'}`}>
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{label}</p>
      {q ? (
        <>
          <p className="mt-1 truncate font-semibold" title={names[q.listId]}>
            {names[q.listId] ?? q.listId}
          </p>
          <p className="text-xl font-bold tabular-nums">{fmtQuotient(q.value.num, q.value.den)}</p>
          <p className="text-xs tabular-nums text-slate-500">
            {fmtInt(q.votes)} {multiplierLabel(q)}÷ {q.divisor}
          </p>
        </>
      ) : (
        <p className="mt-1 text-sm text-slate-500">— nema —</p>
      )}
    </div>
  );

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <Box q={last} label={`${S}. mandat — poslednji osvojeni količnik`} strong />
        <Box q={next} label={`${S + 1}. količnik — prvi neizabrani`} />
      </div>
      {tie && (
        <p className={`rounded-md px-3 py-2 text-xs ${tie.unresolvedByLaw ? 'border-2 border-amber-600 text-amber-900 dark:text-amber-200' : 'border border-slate-300 text-slate-700 dark:border-slate-700 dark:text-slate-300'}`} role="status">
          <strong>{tie.unresolvedByLaw ? '⚠ NEREŠENO PO ZAKONU: ' : 'Izjednačenje: '}</strong>
          {tie.description}
        </p>
      )}
      {last && next && need !== null && need > 0 && !tie && (
        <p className="text-xs text-slate-600 dark:text-slate-400">
          Lista „{names[next.listId]}” bi uz nepromenjene ostale rezultate preuzela {S}. mandat sa još <strong>{fmtInt(need)}</strong> glasova (razlika u količnicima: {fmtQuotient(last.value.num * next.value.den - next.value.num * last.value.den, last.value.den * next.value.den)}).
        </p>
      )}
    </div>
  );
}

/* ─────────────────── Glasovi van raspodele ─────────────────── */

export function OutsideVotes({ result }: { result: ElectionResult }) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button className="w-full rounded-lg border border-slate-200 p-3 text-left transition hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800/50" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        <div className="grid grid-cols-3 gap-2 text-center">
          <div>
            <p className="label">Ukupno glasova</p>
            <p className="font-semibold tabular-nums">{fmtInt(result.totalValidVotes)}</p>
          </div>
          <div>
            <p className="label">Van raspodele</p>
            <p className="font-semibold tabular-nums">{fmtInt(result.votesOutside)}</p>
          </div>
          <div>
            <p className="label">Procenat van raspodele</p>
            <p className="font-semibold tabular-nums">{fmtPct(result.percentOutside, 1)}</p>
          </div>
        </div>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
          <div className="hatch h-full bg-slate-400 dark:bg-slate-500" style={{ width: `${Math.min(100, result.percentOutside)}%` }} />
        </div>
        <p className="mt-1.5 text-center text-xs text-slate-500">{open ? '▲ Sakrij liste' : `▼ Prikaži liste (${result.outsideLists.length})`}</p>
      </button>
      {open && (
        <ul className="mt-2 divide-y divide-slate-100 text-sm dark:divide-slate-800">
          {result.outsideLists.length === 0 && <li className="py-1.5 text-slate-500">Sve liste učestvuju u raspodeli.</li>}
          {result.outsideLists.map((s) => (
            <li key={s.id} className="flex items-center justify-between gap-2 py-1.5">
              <span className="truncate">{s.name || '(bez naziva)'}</span>
              <span className="shrink-0 tabular-nums text-slate-600 dark:text-slate-400">
                {fmtInt(s.votes)} · {fmtPct(s.percentValid, 2)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** "× 1,35 " za količnike sa manjinskim uvećanjem, inače prazno. */
export function multiplierLabel(q: Quotient): string {
  if (q.value.den === q.divisor || q.votes === 0) return '';
  const m = q.value.num / q.votes / (q.value.den / q.divisor);
  return `× ${fmtNum(m, 4)} `;
}
