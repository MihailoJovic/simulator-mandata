import { useEffect, useMemo, useRef, useState } from 'react';
import type { ElectionSettings, ElectoralList } from '../../types/election';
import { calculateMandates } from '../../calculations';
import { partialCount } from '../../calculations/electionNight';
import { fmtInt } from '../../utils/format';
import { Hemicycle } from './Hemicycle';
import { ListCards } from './ListCards';
import { Segmented } from '../ui';

/** Animirana "izborna noć" — ilustracija kako se raspodela menja dok "pristižu" glasovi. */
export function ElectionNight({
  lists,
  settings,
  selected,
  onToggle,
}: {
  lists: ElectoralList[];
  settings: ElectionSettings;
  selected: string[];
  onToggle: (id: string) => void;
}) {
  const [progress, setProgress] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [duration, setDuration] = useState<'15' | '30' | '60'>('30');
  const [seed, setSeed] = useState(1);
  const last = useRef<number | null>(null);

  useEffect(() => {
    if (!playing) return;
    let raf = 0;
    const tick = (t: number) => {
      const dt = last.current === null ? 0 : t - last.current;
      last.current = t;
      setProgress((p) => Math.min(1, p + dt / (Number(duration) * 1000)));
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      last.current = null;
    };
  }, [playing, duration]);

  useEffect(() => {
    if (progress >= 1) setPlaying(false);
  }, [progress]);

  // Korak od 0,5% — dovoljno glatko, a obračun se ne ponavlja na svaki frejm.
  const step = Math.round(progress * 200) / 200;
  const partial = useMemo(() => partialCount(lists, step, seed), [lists, step, seed]);
  const result = useMemo(
    () => calculateMandates(partial, { ...settings, invalidBallots: Math.round(settings.invalidBallots * step) }, { record: false }),
    [partial, settings, step],
  );
  const counted = partial.reduce((a, l) => a + l.votes, 0);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {playing ? (
          <button className="btn btn-primary" onClick={() => setPlaying(false)}>❚❚ Pauza</button>
        ) : (
          <button
            className="btn btn-primary"
            onClick={() => {
              if (progress >= 1) setProgress(0);
              setPlaying(true);
            }}
          >
            ▶ {progress > 0 && progress < 1 ? 'Nastavi' : 'Pokreni'}
          </button>
        )}
        <button className="btn" onClick={() => { setPlaying(false); setProgress(0); }}>⟲ Na početak</button>
        <button className="btn" onClick={() => { setPlaying(false); setProgress(1); }}>⏭ Konačno</button>
        <button className="btn" onClick={() => { setSeed((s) => s + 1); setProgress(0); setPlaying(true); }} title="Drugačiji (nasumičan) redosled pristizanja glasova">
          🎲 Nova animacija
        </button>
        <span className="ml-auto flex items-center gap-2 text-sm">
          Trajanje
          <Segmented size="xs" value={duration} onChange={setDuration} options={[{ value: '15', label: '15 s' }, { value: '30', label: '30 s' }, { value: '60', label: '60 s' }]} />
        </span>
      </div>

      <div>
        <div className="flex items-baseline justify-between text-sm">
          <span>
            Prebrojano: <strong className="tabular-nums">{(progress * 100).toFixed(1)}%</strong>
          </span>
          <span className="tabular-nums text-slate-500">{fmtInt(counted)} glasova</span>
        </div>
        <input
          type="range"
          min={0}
          max={1000}
          value={Math.round(progress * 1000)}
          onChange={(e) => { setPlaying(false); setProgress(Number(e.target.value) / 1000); }}
          className="w-full accent-slate-700 dark:accent-slate-300"
          aria-label="Napredak prebrojavanja"
        />
      </div>

      <div className="mx-auto max-w-3xl">
        <Hemicycle lists={lists} seatsByList={result.seatsByList} totalSeats={settings.seats} selected={selected} onToggle={onToggle} />
      </div>
      <ListCards lists={partial} result={result} selected={selected} onToggle={onToggle} />
      <p className="text-center text-xs text-slate-500">
        Ilustrativna animacija: glasovi lista „pristižu” različitom (nasumičnom) brzinom. Ovo nije stvarni tok prebrojavanja niti prognoza — na 100% se rezultat tačno poklapa sa unetim podacima.
      </p>
    </div>
  );
}
