import type { ElectionResult, ElectoralList } from '../../types/election';
import { fmtInt, fmtPct } from '../../utils/format';
import { safeColor } from '../../utils/colors';
import { StatusChip } from '../StatusChip';

/** Velike kartice lista (rezultat). Klik bira listu za koaliciju. */
export function ListCards({
  lists,
  result,
  selected = [],
  onToggle,
  previousSeats,
}: {
  lists: ElectoralList[];
  result: ElectionResult;
  selected?: string[];
  onToggle?: (id: string) => void;
  /** Za izbornu noć: prethodni broj mandata (prikazuje promenu). */
  previousSeats?: Record<string, number>;
}) {
  const statusById = new Map(result.statuses.map((s) => [s.id, s]));
  const rows = [...lists].sort((a, b) => (result.seatsByList[b.id] ?? 0) - (result.seatsByList[a.id] ?? 0) || b.votes - a.votes);
  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
      {rows.map((l) => {
        const st = statusById.get(l.id);
        const seats = result.seatsByList[l.id] ?? 0;
        const on = selected.includes(l.id);
        const delta = previousSeats ? seats - (previousSeats[l.id] ?? 0) : 0;
        return (
          <button
            key={l.id}
            type="button"
            onClick={() => onToggle?.(l.id)}
            aria-pressed={on}
            className={`relative overflow-hidden rounded-xl border bg-white p-3 text-left transition dark:bg-slate-900 ${
              on ? 'border-slate-900 ring-2 ring-slate-900 dark:border-white dark:ring-white' : 'border-slate-200 hover:border-slate-400 dark:border-slate-800 dark:hover:border-slate-600'
            } ${onToggle ? 'cursor-pointer' : 'cursor-default'}`}
          >
            <span className="absolute inset-y-0 left-0 w-1.5" style={{ background: safeColor(l.color) }} />
            <div className="flex items-start justify-between gap-2 pl-2">
              <div className="min-w-0">
                <p className="truncate font-semibold" title={l.name}>
                  {l.name || '(bez naziva)'}
                </p>
                <p className="text-sm tabular-nums text-slate-500 dark:text-slate-400">
                  {fmtPct(st?.percentValid, 2)} · {fmtInt(l.votes)} gl.
                </p>
                <div className="mt-1">{st && <StatusChip status={st} />}</div>
              </div>
              <div className="shrink-0 text-right">
                <p className="text-3xl font-bold leading-none tabular-nums">{seats}</p>
                <p className="text-[10px] uppercase text-slate-500">mandata</p>
                {delta !== 0 && <p className="mt-0.5 text-xs font-semibold tabular-nums">{delta > 0 ? `▲ +${delta}` : `▼ −${-delta}`}</p>}
              </div>
            </div>
            {on && <span className="absolute bottom-2 right-2 chip chip-pass !px-1.5 !py-0 text-[9px]">u grupi</span>}
          </button>
        );
      })}
    </div>
  );
}
