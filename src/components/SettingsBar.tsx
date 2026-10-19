import { useState } from 'react';
import type { ElectionSettings } from '../types/election';
import type { Action, SimState } from '../hooks/useSimulator';
import { LEGAL_DEFAULTS, THRESHOLD_PRESETS } from '../data/rules';
import { fmtInt, fmtNum } from '../utils/format';
import { parseDecimal, parseVotes } from '../utils/parse';
import { ParsedInput, Segmented, Toggle } from './ui';

export function SettingsBar({ state, dispatch, minVotesToPass }: { state: SimState; dispatch: (a: Action) => void; minVotesToPass: number }) {
  const s = state.settings;
  const set = (patch: Partial<ElectionSettings>) => dispatch({ type: 'setSettings', patch });
  const [adv, setAdv] = useState(false);
  const isLegal =
    s.seats === LEGAL_DEFAULTS.seats &&
    s.thresholdPercent === LEGAL_DEFAULTS.thresholdPercent &&
    s.thresholdBase === LEGAL_DEFAULTS.thresholdBase &&
    s.minorityRules &&
    s.minorityBonusPercent === LEGAL_DEFAULTS.minorityBonusPercent &&
    s.noListPassesFallback;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-x-6 gap-y-3">
        <div>
          <span className="label mb-1 block">Izborni cenzus</span>
          <div className="flex flex-wrap items-center gap-2">
            <Segmented
              size="xs"
              value={THRESHOLD_PRESETS.includes(s.thresholdPercent as (typeof THRESHOLD_PRESETS)[number]) ? String(s.thresholdPercent) : 'custom'}
              options={[...THRESHOLD_PRESETS.map((p) => ({ value: String(p), label: `${p}%` })), { value: 'custom', label: 'drugo' }]}
              onChange={(v) => v !== 'custom' && set({ thresholdPercent: Number(v) })}
            />
            <div className="w-20">
              <ParsedInput value={s.thresholdPercent} format={(v) => fmtNum(v, 6)} parse={(x) => parseDecimal(x, { max: 100 })} onCommit={(v) => set({ thresholdPercent: v })} ariaLabel="Proizvoljan cenzus u procentima" />
            </div>
            <span className="text-sm">%</span>
          </div>
        </div>
        <div>
          <span className="label mb-1 block">Način unosa</span>
          <Segmented
            size="xs"
            value={state.inputMode}
            options={[
              { value: 'votes', label: 'Unos po glasovima' },
              { value: 'percent', label: 'Unos po procentima' },
            ]}
            onChange={(m) => dispatch({ type: 'setInputMode', mode: m })}
          />
        </div>
        <div className="w-40">
          <span className="label mb-1 block" title="Ulaze u 'broj birača koji su glasali' — osnovu za cenzus (čl. 128)">Nevažeći listići</span>
          <ParsedInput value={s.invalidBallots} format={fmtInt} parse={parseVotes} onCommit={(v) => set({ invalidBallots: v })} ariaLabel="Broj nevažećih listića" />
        </div>
        <div className="text-xs text-slate-600 dark:text-slate-400">
          <p>
            Mandata: <strong>{s.seats}</strong> · Metod: <strong>D'Hondt</strong>
          </p>
          <p>
            Prag: <strong>{fmtInt(minVotesToPass)}</strong> glasova
          </p>
          <p>{isLegal ? <span className="chip chip-special !text-[9px]">Zakonska pravila</span> : <span className="chip chip-fail !text-[9px]">Hipotetička pravila</span>}</p>
        </div>
        <button className="btn btn-xs" onClick={() => setAdv((a) => !a)} aria-expanded={adv}>
          {adv ? '▲' : '▼'} Napredna podešavanja
        </button>
      </div>

      {adv && (
        <div className="grid grid-cols-1 gap-4 rounded-lg border border-slate-200 p-3 text-sm sm:grid-cols-2 lg:grid-cols-3 dark:border-slate-800">
          <label className="space-y-1">
            <span className="label block">Broj mandata (zakon: 250)</span>
            <input className="input" type="number" min={1} max={1000} value={s.seats} onChange={(e) => { const v = Math.round(Number(e.target.value)); if (Number.isFinite(v) && v >= 1 && v <= 1000) set({ seats: v }); }} />
          </label>
          <label className="space-y-1">
            <span className="label block">Osnova za cenzus</span>
            <select className="input" value={s.thresholdBase} onChange={(e) => set({ thresholdBase: e.target.value as ElectionSettings['thresholdBase'] })}>
              <option value="voters">Birači koji su glasali (zakon, čl. 128)</option>
              <option value="valid">Samo važeći glasovi (hipotetički)</option>
            </select>
          </label>
          <div className="space-y-1">
            <span className="label block">Manjinske liste (čl. 140)</span>
            <Toggle checked={s.minorityRules} onChange={(v) => set({ minorityRules: v })} label="Primeni posebna pravila" />
            <label className="flex items-center gap-2">
              Uvećanje količnika:
              <input className="input w-20 py-0.5 text-right" type="number" min={0} max={1000} step={1} value={s.minorityBonusPercent} disabled={!s.minorityRules} onChange={(e) => { const v = Number(e.target.value); if (Number.isFinite(v) && v >= 0 && v <= 1000) set({ minorityBonusPercent: v }); }} />%
            </label>
          </div>
          <div className="space-y-1">
            <span className="label block">Kada nijedna lista ne pređe cenzus</span>
            <Toggle checked={s.noListPassesFallback} onChange={(v) => set({ noListPassesFallback: v })} label="Sve liste učestvuju (čl. 128 st. 2)" />
          </div>
          <label className="space-y-1">
            <span className="label block">Nerešeno izjednačenje (isti količnik i isti broj glasova)</span>
            <select className="input" value={s.residualTieBreak} onChange={(e) => set({ residualTieBreak: e.target.value as ElectionSettings['residualTieBreak'] })}>
              <option value="input-order">Redosled unosa lista (označava se)</option>
              <option value="lot">Simulirani žreb sa seed-om (označava se)</option>
            </select>
            {s.residualTieBreak === 'lot' && (
              <input className="input mt-1 w-28" type="number" min={0} value={s.lotSeed} onChange={(e) => { const v = Math.round(Number(e.target.value)); if (Number.isFinite(v) && v >= 0) set({ lotSeed: v }); }} aria-label="Seed žreba" />
            )}
            <span className="block text-[11px] text-slate-500">Zakon ovaj slučaj ne propisuje — simulator ga uvek jasno označava.</span>
          </label>
          <div className="flex items-end">
            <button className="btn" onClick={() => set({ ...LEGAL_DEFAULTS, invalidBallots: s.invalidBallots })}>
              Vrati zakonska pravila
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
