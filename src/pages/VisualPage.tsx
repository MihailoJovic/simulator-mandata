import { useEffect, useMemo, useState } from 'react';
import type { ElectoralList, ElectionSettings } from '../types/election';
import { calculateMandates, calculateMajority } from '../calculations';
import { LEGAL_DEFAULTS, majorityOf } from '../data/rules';
import { demoLists } from '../data/demo';
import { loadJSON, STORAGE_KEYS } from '../utils/storage';
import { sanitizeSettings } from '../utils/serialization';
import { fmtInt, fmtPct } from '../utils/format';
import { Hemicycle } from '../components/visual/Hemicycle';
import { ListCards } from '../components/visual/ListCards';
import { ElectionNight } from '../components/visual/ElectionNight';
import { Segmented } from '../components/ui';

interface Snapshot {
  name: string;
  lists: ElectoralList[];
  settings: ElectionSettings;
  isDemo: boolean;
}

function readSnapshot(): Snapshot {
  const s = loadJSON<Partial<Snapshot> & { scenarioName?: string } | null>(STORAGE_KEYS.state, null);
  if (s && Array.isArray(s.lists) && s.settings) {
    return { name: s.scenarioName ?? 'Scenario', lists: s.lists, settings: sanitizeSettings(s.settings), isDemo: !!s.isDemo };
  }
  return { name: 'Demo scenario', lists: demoLists(), settings: { ...LEGAL_DEFAULTS }, isDemo: true };
}

/**
 * Poseban prozor za vizuelni prikaz. Podatke čita iz lokalnog skladišta glavnog
 * prozora i automatski se osvežava kad se oni promene (događaj "storage").
 */
export function VisualPage() {
  const [snap, setSnap] = useState<Snapshot>(readSnapshot);
  const [view, setView] = useState<'result' | 'night'>('result');
  const [selected, setSelected] = useState<string[]>([]);

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEYS.state) setSnap(readSnapshot());
    };
    window.addEventListener('storage', onStorage);
    document.title = 'Vizuelni prikaz — Simulator mandata';
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const result = useMemo(() => calculateMandates(snap.lists, snap.settings, { record: false }), [snap]);
  const sel = selected.filter((id) => snap.lists.some((l) => l.id === id));
  const toggle = (id: string) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  const S = snap.settings.seats;
  const maj = majorityOf(S);
  const m = calculateMajority(result.seatsByList, sel, S);

  return (
    <div className="mx-auto max-w-[1400px] px-4 pb-10 pt-4 sm:px-6">
      <header className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl font-bold tracking-tight sm:text-2xl">{snap.name}</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Narodna skupština · {S} mandata · većina {maj} · cenzus {fmtPct(snap.settings.thresholdPercent, snap.settings.thresholdPercent % 1 ? 2 : 0)} · {fmtInt(result.totalValidVotes)} važećih glasova
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 text-xs text-slate-500" title="Prikaz se automatski osvežava kada promenite podatke u glavnom prozoru">
            <span className="h-2 w-2 animate-pulse rounded-full bg-slate-500" /> uživo
          </span>
          <Segmented value={view} onChange={setView} options={[{ value: 'result', label: 'Rezultat' }, { value: 'night', label: 'Izborna noć' }]} />
        </div>
      </header>

      {snap.isDemo && (
        <p className="mb-4 rounded-lg border-2 border-dashed border-slate-400 px-3 py-1.5 text-sm dark:border-slate-600">
          <span className="chip chip-pass mr-2">DEMO PODACI</span>Izmišljeni brojevi — nisu prognoza.
        </p>
      )}

      {!result.ok ? (
        <p className="card p-6 text-center text-slate-500">Podaci u glavnom prozoru sadrže greške — ispravite ih da bi se prikazala raspodela.</p>
      ) : view === 'result' ? (
        <div className="space-y-5">
          <section className="card p-4">
            <div className="mx-auto max-w-4xl">
              <Hemicycle lists={snap.lists} seatsByList={result.seatsByList} totalSeats={S} selected={sel} onToggle={toggle} />
            </div>
            <div className="mt-2 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-sm">
              {sel.length > 0 ? (
                <>
                  <span>
                    Grupa: <strong>{sel.map((id) => snap.lists.find((l) => l.id === id)?.name).join(' + ')}</strong>
                  </span>
                  <span className="text-lg font-bold tabular-nums">{m.groupSeats} mandata</span>
                  <span className={`chip ${m.hasMajority ? 'chip-pass' : 'chip-fail'}`}>{m.hasMajority ? `✓ većina (+${m.surplus})` : `✕ nedostaje ${m.missing}`}</span>
                  <button className="btn btn-xs" onClick={() => setSelected([])}>Poništi grupu</button>
                </>
              ) : (
                <span className="text-slate-500">Kliknite na mesta u skupštini ili na kartice da sastavite hipotetičku grupu i proverite da li ima {maj} mandata.</span>
              )}
            </div>
          </section>
          <ListCards lists={snap.lists} result={result} selected={sel} onToggle={toggle} />
          <p className="text-center text-xs text-slate-500">
            Redosled lista s leva na desno odgovara redosledu u unosu (simulator ne svrstava liste ideološki). Izabrana grupa se prikazuje sleva. Ovo je aritmetički prikaz unetih podataka — ne prognoza i ne politička preporuka.
          </p>
        </div>
      ) : (
        <ElectionNight lists={snap.lists} settings={snap.settings} selected={sel} onToggle={toggle} />
      )}
    </div>
  );
}

/** Otvara vizuelni prikaz u posebnom prozoru (u desktop aplikaciji: novi prozor aplikacije). */
export function openVisualWindow() {
  const url = `${window.location.pathname}?view=visual`;
  const w = window.open(url, 'vizuelni-prikaz', 'width=1280,height=880');
  w?.focus();
}
