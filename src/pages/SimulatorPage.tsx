import { useEffect, useMemo, useRef, useState } from 'react';
import type { Scenario } from '../types/election';
import { useSimulator } from '../hooks/useSimulator';
import { useScenarios } from '../hooks/useScenarios';
import { Card, ConfirmDialog, Modal, Segmented, Toggle } from '../components/ui';
import { EzView } from '../components/EzView';
import { Hemicycle } from '../components/visual/Hemicycle';
import { UpdateBanner } from '../components/UpdateBanner';
import { PollsPanel } from '../components/PollsPanel';
import { openVisualWindow } from './VisualPage';
import { loadJSON, saveJSON, STORAGE_KEYS } from '../utils/storage';
import { SettingsBar } from '../components/SettingsBar';
import { ListEditor } from '../components/ListEditor';
import { BoundaryCard, OutsideVotes, ResultsTable, SeatDistribution } from '../components/ResultsPanel';
import { MajorityPanel } from '../components/MajorityPanel';
import { ScenarioPanel } from '../components/ScenarioPanel';
import { DHondtTable } from '../components/tools/DHondtTable';
import { TransferTool, WhatIfSlider } from '../components/tools/WhatIfTool';
import { FindThresholdTool } from '../components/tools/FindThresholdTool';
import { SensitivityTool } from '../components/tools/SensitivityTool';
import { MonteCarloTool } from '../components/tools/MonteCarloTool';
import { DebugPanel } from '../components/tools/DebugPanel';
import { Methodology } from './Methodology';
import {
  buildShareUrl,
  downloadText,
  encodeShare,
  parseScenarioFile,
  resultsToCsv,
  safeFilename,
  scenarioToFile,
} from '../utils/serialization';

/** Desktop (Electron) verzija: link app://… nema smisla za deljenje — koristi se Export JSON. */
const IS_DESKTOP = typeof navigator !== 'undefined' && navigator.userAgent.includes('Electron');

type Tab = 'dhondt' | 'whatif' | 'transfer' | 'find' | 'sensitivity' | 'montecarlo' | 'debug';

export function SimulatorPage() {
  const { state, dispatch, result } = useSimulator();
  const sc = useScenarios();
  const [tab, setTab] = useState<Tab>('dhondt');
  const [debug, setDebug] = useState(false);
  const [showMethod, setShowMethod] = useState(false);
  const [confirm, setConfirm] = useState<null | 'clear' | 'reset'>(null);
  const [toast, setToast] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const toolsRef = useRef<HTMLDivElement>(null);
  const [mode, setMode] = useState<'ez' | 'advanced'>(() => (loadJSON<string>(STORAGE_KEYS.uiMode, 'ez') === 'advanced' ? 'advanced' : 'ez'));
  const [showPolls, setShowPolls] = useState(false);
  useEffect(() => saveJSON(STORAGE_KEYS.uiMode, mode), [mode]);

  const openVisual = () => {
    saveJSON(STORAGE_KEYS.state, { ...state, notice: null }); // vizuelni prozor čita najnovije stanje
    openVisualWindow();
  };

  const names = useMemo(() => Object.fromEntries(state.lists.map((l) => [l.id, l.name])), [state.lists]);
  const flash = (m: string) => {
    setToast(m);
    setTimeout(() => setToast(null), 3500);
  };

  const currentScenario = (name = state.scenarioName): Scenario => ({
    id: `sc_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
    name,
    createdAt: new Date().toISOString(),
    lists: state.lists,
    settings: state.settings,
    inputMode: state.inputMode,
  });

  const exportJson = () => {
    const file = scenarioToFile({ ...currentScenario(), createdAt: state.createdAt }, result.ok ? result : null);
    downloadText(`${safeFilename(state.scenarioName)}.json`, JSON.stringify(file, null, 2), 'application/json');
  };
  const exportCsv = () => {
    if (!result.ok) return flash('Ispravite greške pre exporta.');
    downloadText(`${safeFilename(state.scenarioName)}-rezultati.csv`, resultsToCsv(state.lists, result), 'text/csv;charset=utf-8');
  };
  const importJson = async (f: File) => {
    try {
      if (f.size > 5_000_000) throw new Error('Fajl je prevelik.');
      const s = parseScenarioFile(await f.text());
      dispatch({ type: 'load', scenario: s, notice: `Uvezen scenario "${s.name}".` });
    } catch (e) {
      flash(e instanceof Error ? e.message : 'Greška pri uvozu.');
    }
  };
  const share = async () => {
    const url = buildShareUrl(encodeShare(state.scenarioName, state.lists, state.settings, state.inputMode));
    try {
      await navigator.clipboard.writeText(url);
      flash('Link je kopiran. Podaci su u samom linku (posle #) i ne šalju se na server.');
    } catch {
      window.prompt('Kopirajte link:', url);
    }
  };

  const errors = result.issues.filter((i) => i.level === 'error');
  const warnings = result.issues.filter((i) => i.level === 'warning');

  const tabs: Array<[Tab, string]> = [
    ['dhondt', "D'Hondt obračun"],
    ['whatif', 'Šta ako?'],
    ['transfer', 'Prebaci glasove'],
    ['find', 'Pronađi granicu'],
    ['sensitivity', 'Analiza osetljivosti'],
    ['montecarlo', 'Monte Carlo'],
    ...(debug ? ([['debug', 'Debug']] as Array<[Tab, string]>) : []),
  ];
  const openTool = (t: Tab) => {
    setTab(t);
    requestAnimationFrame(() => toolsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  };

  return (
    <div className="mx-auto max-w-[1600px] px-4 pb-16 pt-4 sm:px-6">
      {/* ───────── TOP ───────── */}
      <header className="mb-4 space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-xl font-bold tracking-tight sm:text-2xl">Simulator raspodele mandata</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">Narodna skupština Republike Srbije · 250 mandata · jedna izborna jedinica · D'Hondt · matematički i edukativni alat, nije prognoza</p>
          </div>
          <div className="no-print flex flex-wrap items-center gap-1.5">
            <Segmented
              value={mode}
              onChange={setMode}
              options={[
                { value: 'ez', label: 'Ez Mode' },
                { value: 'advanced', label: 'Advanced Mode' },
              ]}
            />
            <button className="btn btn-primary" onClick={openVisual}>Vizuelni prikaz ↗</button>
            <button className="btn" onClick={() => setShowPolls(true)}>Ankete</button>
            <button className="btn" onClick={() => setShowMethod(true)}>Kako simulator računa?</button>
            {mode === 'advanced' && <button className="btn" onClick={() => dispatch({ type: 'randomize', seed: (Date.now() ^ (Math.random() * 1e9)) >>> 0 })}>Nasumičan scenario</button>}
            <button className="btn" onClick={() => setConfirm('reset')}>Resetuj scenario</button>
            {mode === 'advanced' && <button className="btn btn-danger" onClick={() => setConfirm('clear')}>Obriši sve liste</button>}
          </div>
        </div>

        <UpdateBanner />

        {state.isDemo && (
          <div className="flex flex-wrap items-center gap-2 rounded-lg border-2 border-dashed border-slate-400 px-3 py-2 text-sm dark:border-slate-600" role="note">
            <span className="chip chip-pass">DEMO PODACI</span>
            <span>Brojevi su izmišljeni radi isprobavanja simulatora. Nisu prognoza, istraživanje javnog mnjenja niti stvarni rezultat.</span>
          </div>
        )}
        {state.notice && (
          <div className="flex items-center justify-between gap-2 rounded-lg bg-slate-100 px-3 py-2 text-sm dark:bg-slate-800">
            <span>{state.notice}</span>
            <button className="btn btn-xs" onClick={() => dispatch({ type: 'dismissNotice' })}>OK</button>
          </div>
        )}

        {mode === 'advanced' && <div className="card no-print p-3">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <label className="flex min-w-0 flex-1 items-center gap-2 text-sm">
              <span className="label shrink-0">Scenario:</span>
              <input className="input max-w-sm font-medium" value={state.scenarioName} onChange={(e) => dispatch({ type: 'setName', name: e.target.value })} maxLength={80} aria-label="Naziv scenarija" />
            </label>
            <div className="flex flex-wrap gap-1.5">
              <button className="btn btn-xs" onClick={exportJson}>Export JSON</button>
              <button className="btn btn-xs" onClick={() => fileRef.current?.click()}>Import JSON</button>
              <button className="btn btn-xs" onClick={exportCsv}>Export CSV</button>
              <button className="btn btn-xs" onClick={() => window.print()} title="Otvara dijalog za štampu — izaberite „Sačuvaj kao PDF”">Export PDF</button>
              {!IS_DESKTOP && <button className="btn btn-xs" onClick={share}>Podeli link</button>}
              <input ref={fileRef} type="file" accept="application/json,.json" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) importJson(f); e.target.value = ''; }} />
              <Toggle checked={debug} onChange={(v) => { setDebug(v); if (v) openTool('debug'); else if (tab === 'debug') setTab('dhondt'); }} label={<span className="text-xs">Debug mode</span>} />
            </div>
          </div>
          <SettingsBar state={state} dispatch={dispatch} minVotesToPass={result.minVotesToPass} />
        </div>}
      </header>

      {(errors.length > 0 || warnings.length > 0) && (
        <div className="mb-4 space-y-1" role="alert">
          {errors.map((e, i) => (
            <p key={`e${i}`} className="rounded-md border border-rose-300 bg-rose-50 px-3 py-1.5 text-sm text-rose-800 dark:border-rose-800 dark:bg-rose-950 dark:text-rose-200">
              <strong>Greška:</strong> {e.message}
            </p>
          ))}
          {warnings.map((w, i) => (
            <p key={`w${i}`} className={`rounded-md border px-3 py-1.5 text-sm ${w.code === 'tie-unresolved' ? 'border-2 border-amber-600 text-amber-900 dark:text-amber-200' : 'border-slate-300 text-slate-700 dark:border-slate-700 dark:text-slate-300'}`}>
              <strong>{w.code === 'tie-unresolved' ? '⚠ Nerešeno po zakonu:' : 'Napomena:'}</strong> {w.message}
            </p>
          ))}
        </div>
      )}

      {mode === 'ez' ? (
        <EzView state={state} dispatch={dispatch} result={result} onOpenVisual={openVisual} />
      ) : (
      <>
      {/* ───────── LEVO / SREDINA / DESNO ───────── */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        <div className="min-w-0 lg:col-span-4 xl:col-span-3">
          <Card title={`Izborne liste (${state.lists.length})`}>
            <ListEditor state={state} dispatch={dispatch} result={result} />
          </Card>
        </div>

        <div className="min-w-0 space-y-4 lg:col-span-8 xl:col-span-6 print-full">
          <Card title="Raspodela mandata" actions={<button className="btn btn-xs no-print" onClick={() => openTool('dhondt')}>Prikaži D'Hondt obračun</button>}>
            {result.ok ? (
              <>
                <div className="mx-auto mb-4 max-w-xl">
                  <Hemicycle lists={state.lists} seatsByList={result.seatsByList} totalSeats={state.settings.seats} compact />
                </div>
                <SeatDistribution lists={state.lists} result={result} />
              </>
            ) :<p className="text-sm text-slate-500">Raspodela nije moguća dok se ne isprave greške u unosu.</p>}
          </Card>
          {result.ok && (
            <>
              <Card title="Rezultati">
                <ResultsTable lists={state.lists} result={result} />
              </Card>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <Card title="Granica za poslednji mandat">
                  <BoundaryCard result={result} names={names} />
                </Card>
                <Card title="Glasovi van raspodele">
                  <OutsideVotes result={result} />
                </Card>
              </div>
            </>
          )}
        </div>

        <div className="min-w-0 space-y-4 lg:col-span-12 xl:col-span-3">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-1">
            <Card title="Većina i grupe">
              <MajorityPanel lists={state.lists} result={result} />
            </Card>
            <Card title="Scenariji" className="no-print">
              <ScenarioPanel
                state={state}
                scenarios={sc.scenarios}
                onSave={(name) => { sc.save(currentScenario(name)); flash(`Scenario "${name}" je sačuvan.`); }}
                onLoad={(s) => dispatch({ type: 'load', scenario: s, notice: `Učitan scenario "${s.name}".` })}
                onDelete={sc.remove}
              />
            </Card>
          </div>
        </div>
      </div>

      {/* ───────── ALATI ───────── */}
      <div ref={toolsRef} className="no-print mt-6 scroll-mt-4">
        <div className="card">
          <nav className="flex gap-1 overflow-x-auto border-b border-slate-200 px-2 pt-2 dark:border-slate-800" role="tablist">
            {tabs.map(([k, label]) => (
              <button
                key={k}
                role="tab"
                aria-selected={tab === k}
                onClick={() => setTab(k)}
                className={`whitespace-nowrap rounded-t-md border-b-2 px-3 py-2 text-sm font-medium transition ${tab === k ? 'border-slate-800 text-slate-900 dark:border-slate-200 dark:text-white' : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'}`}
              >
                {label}
              </button>
            ))}
          </nav>
          <div className="p-4">
            {/* Svi alati ostaju montirani da bi zadržali podešavanja i rezultate. */}
            <div hidden={tab !== 'dhondt'}><DHondtTable lists={state.lists} result={result} /></div>
            <div hidden={tab !== 'whatif'}><WhatIfSlider lists={state.lists} result={result} dispatch={dispatch} /></div>
            <div hidden={tab !== 'transfer'}><TransferTool lists={state.lists} dispatch={dispatch} /></div>
            <div hidden={tab !== 'find'}><FindThresholdTool lists={state.lists} result={result} dispatch={dispatch} /></div>
            <div hidden={tab !== 'sensitivity'}><SensitivityTool lists={state.lists} result={result} /></div>
            <div hidden={tab !== 'montecarlo'}><MonteCarloTool lists={state.lists} result={result} /></div>
            {debug && <div hidden={tab !== 'debug'}><DebugPanel lists={state.lists} result={result} /></div>}
          </div>
        </div>
      </div>
      </>
      )}

      <footer className="mt-8 text-center text-xs text-slate-500">
        Simulator prikazuje matematičke posledice unetih podataka. Rezultati zavise isključivo od pretpostavki korisnika. Svi podaci ostaju u vašem browseru.
      </footer>

      <Modal open={showPolls} onClose={() => setShowPolls(false)} title="Ankete (opciono)" wide>
        <PollsPanel
          onSimulate={(sc) => {
            dispatch({ type: 'load', scenario: sc, notice: `Učitana simulacija na osnovu ankete: ${sc.name}. Ovo su podaci agencije, ne prognoza simulatora.` });
            setShowPolls(false);
          }}
        />
      </Modal>
      <Modal open={showMethod}onClose={() => setShowMethod(false)} title="Kako simulator računa?" wide>
        <Methodology />
      </Modal>
      <ConfirmDialog
        open={confirm === 'clear'}
        title="Obriši sve liste"
        message="Sve izborne liste u trenutnom scenariju biće obrisane. Sačuvani scenariji ostaju. Nastaviti?"
        confirmLabel="Obriši sve"
        onCancel={() => setConfirm(null)}
        onConfirm={() => { dispatch({ type: 'clearAll' }); setConfirm(null); }}
      />
      <ConfirmDialog
        open={confirm === 'reset'}
        title="Resetuj scenario"
        message="Trenutni podaci biće zamenjeni početnim demo podacima. Sačuvani scenariji ostaju. Nastaviti?"
        confirmLabel="Resetuj"
        onCancel={() => setConfirm(null)}
        onConfirm={() => { dispatch({ type: 'reset' }); setConfirm(null); }}
      />
      {toast && (
        <div className="no-print fixed bottom-4 left-1/2 z-50 max-w-[90vw] -translate-x-1/2 rounded-lg bg-slate-900 px-4 py-2 text-sm text-white shadow-lg dark:bg-white dark:text-slate-900" role="status">
          {toast}
        </div>
      )}
    </div>
  );
}
