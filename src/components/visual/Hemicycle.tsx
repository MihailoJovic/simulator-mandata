import { useMemo, useState } from 'react';
import type { ElectoralList } from '../../types/election';
import { assignSeats, hemicycleLayout } from '../../utils/hemicycle';
import { majorityOf } from '../../data/rules';
import { safeColor } from '../../utils/colors';

/**
 * Polukružni prikaz skupštine. Redosled lista s leva na desno = redosled u unosu
 * (simulator ne svrstava liste ideološki). Ako je zadata koalicija, njene liste
 * idu prve (sleva), pa se odmah vidi da li prelaze sredinu (većinu).
 */
export function Hemicycle({
  lists,
  seatsByList,
  totalSeats,
  selected,
  onToggle,
  compact = false,
}: {
  lists: ElectoralList[];
  seatsByList: Record<string, number>;
  totalSeats: number;
  /** Izabrane liste (koalicija). Prazno = bez isticanja. */
  selected?: string[];
  onToggle?: (id: string) => void;
  compact?: boolean;
}) {
  const layout = useMemo(() => hemicycleLayout(totalSeats), [totalSeats]);
  const [hover, setHover] = useState<string | null>(null);
  const sel = selected ?? [];
  const maj = majorityOf(totalSeats);

  const ordered = useMemo(() => {
    const withSeats = lists.filter((l) => (seatsByList[l.id] ?? 0) > 0);
    const a = withSeats.filter((l) => sel.includes(l.id));
    const b = withSeats.filter((l) => !sel.includes(l.id));
    return [...a, ...b].map((l) => ({ id: l.id, seats: seatsByList[l.id] ?? 0 }));
  }, [lists, seatsByList, sel]);

  const owner = useMemo(() => assignSeats(ordered, layout.seats.length), [ordered, layout.seats.length]);
  const byId = useMemo(() => new Map(lists.map((l) => [l.id, l])), [lists]);
  const groupSeats = sel.reduce((a, id) => a + (seatsByList[id] ?? 0), 0);
  const allocated = Object.values(seatsByList).reduce((a, b) => a + b, 0);
  const pad = layout.seatRadius * 1.6;
  const focus = hover ?? null;

  return (
    <figure className="w-full">
      <svg viewBox={`${-1 - pad} ${-1 - pad} ${2 + 2 * pad} ${1 + 2 * pad}`} className="block w-full" role="img" aria-label={`Raspodela ${totalSeats} mandata u skupštini`}>
        {/* linija sredine — granica većine */}
        <line x1={0} y1={-0.3} x2={0} y2={-1 - pad * 0.6} stroke="currentColor" strokeWidth={0.006} strokeDasharray="0.02 0.015" className="text-slate-500" />
        {layout.seats.map((s, i) => {
          const id = owner[i];
          const l = id ? byId.get(id) : undefined;
          const dim = (sel.length > 0 && (!id || !sel.includes(id))) || (focus !== null && id !== focus);
          return (
            <circle
              key={i}
              cx={s.x}
              cy={s.y}
              r={layout.seatRadius}
              fill={l ? safeColor(l.color) : 'transparent'}
              stroke={l ? 'none' : 'currentColor'}
              strokeWidth={l ? 0 : 0.004}
              className="text-slate-400 transition-[fill,opacity] duration-500"
              opacity={dim ? 0.18 : 1}
              style={{ cursor: id && onToggle ? 'pointer' : undefined }}
              onMouseEnter={() => id && setHover(id)}
              onMouseLeave={() => setHover(null)}
              onClick={() => id && onToggle?.(id)}
            >
              {l && <title>{`${l.name}: ${seatsByList[l.id]} mandata`}</title>}
            </circle>
          );
        })}
        <text x={0} y={-0.12} textAnchor="middle" fontSize={compact ? 0.2 : 0.17} fontWeight={700} fill="currentColor">
          {sel.length ? groupSeats : allocated}
        </text>
        <text x={0} y={-0.01} textAnchor="middle" fontSize={0.055} fill="currentColor" className="text-slate-500">
          {sel.length ? (groupSeats >= maj ? `✓ većina (${maj})` : `nedostaje ${maj - groupSeats} do ${maj}`) : `od ${totalSeats} · većina ${maj}`}
        </text>
      </svg>
      {focus && byId.get(focus) && (
        <figcaption className="mt-1 text-center text-sm">
          <strong>{byId.get(focus)!.name}</strong>: {seatsByList[focus]} mandata
        </figcaption>
      )}
    </figure>
  );
}
