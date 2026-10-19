import { useRef, useState } from 'react';
import type { ElectionResult, ElectoralList } from '../../types/election';
import { setListShare, transferVotes, type TransferUnit } from '../../calculations';
import type { Action } from '../../hooks/useSimulator';
import { fmtInt, fmtNum, fmtPct } from '../../utils/format';
import { parseDecimal } from '../../utils/parse';
import { AdjustmentSelect, ListSelect, pickId, toAdjustment, type AdjKind } from './common';
import { InfoNote } from '../ui';

/* ─────────────── Slider "Šta ako?" ─────────────── */

export function WhatIfSlider({ lists, result, dispatch }: { lists: ElectoralList[]; result: ElectionResult; dispatch: (a: Action) => void }) {
  const [listId, setListId] = useState(() => pickId(lists, 'demo_3', 2));
  const [kind, setKind] = useState<AdjKind>('proportional');
  const [sourceId, setSourceId] = useState('');
  const id = pickId(lists, listId);
  const st = result.statuses.find((s) => s.id === id);
  const cur = st?.percentValid ?? 0;
  const [range, setRange] = useState<{ id: string; min: number; max: number } | null>(null);
  const r = range && range.id === id ? range : { id, min: Math.max(0, Math.floor((cur - 1.5) * 10) / 10), max: Math.min(100, Math.ceil((cur + 1.5) * 10) / 10) };
  const base = useRef<ElectoralList[] | null>(null);
  const seats = result.seatsByList[id] ?? 0;
  const thr = result.settings.thresholdPercent;

  if (!lists.length) return <p className="text-sm text-slate-500">Nema lista.</p>;

  const apply = (pct: number) => {
    const src = base.current ?? lists;
    dispatch({ type: 'setLists', lists: setListShare(src, id, pct, toAdjustment(kind, pickId(lists.filter((l) => l.id !== id), sourceId))) });
  };

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <ListSelect lists={lists} value={id} onChange={(v) => { setListId(v); base.current = null; }} label="Lista" />
        <AdjustmentSelect lists={lists} kind={kind} sourceId={pickId(lists.filter((l) => l.id !== id), sourceId)} excludeId={id} onChange={(k, s) => { setKind(k); setSourceId(s); base.current = null; }} />
      </div>

      <div className="rounded-lg border border-slate-200 p-3 dark:border-slate-800">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <span className="font-semibold">{lists.find((l) => l.id === id)?.name}</span>
          <span className="text-sm">
            Trenutno: <strong className="tabular-nums">{fmtPct(cur, 2)}</strong> · {fmtInt(lists.find((l) => l.id === id)?.votes)} gl. · <strong>{seats}</strong> mand. · {st?.passesThreshold ? '✓ prelazi cenzus' : '✕ ispod cenzusa'}
          </span>
        </div>
        <div className="mt-3 flex items-center gap-2">
          <RangeInput value={r.min} onCommit={(v) => setRange({ ...r, min: Math.min(v, r.max - 0.01) })} label="Od" />
          <div className="relative flex-1">
            <input
              type="range"
              className="w-full accent-slate-700 dark:accent-slate-300"
              min={r.min}
              max={r.max}
              step={0.01}
              value={Math.min(r.max, Math.max(r.min, Math.round(cur * 100) / 100))}
              onPointerDown={() => (base.current = lists)}
              onKeyDown={() => (base.current = base.current ?? lists)}
              onPointerUp={() => (base.current = null)}
              onBlur={() => (base.current = null)}
              onChange={(e) => apply(Number(e.target.value))}
              aria-label="Procenat liste"
            />
            {thr >= r.min && thr <= r.max && (
              <div className="pointer-events-none absolute -bottom-3 text-[10px] text-slate-500" style={{ left: `calc(${((thr - r.min) / (r.max - r.min)) * 100}% - 12px)` }}>
                ▲ {fmtNum(thr)}%
              </div>
            )}
          </div>
          <RangeInput value={r.max} onCommit={(v) => setRange({ ...r, max: Math.max(v, r.min + 0.01) })} label="Do" />
        </div>
        <div className="mt-5 flex flex-wrap gap-1">
          {[-0.1, -0.01, 0.01, 0.1].map((d) => (
            <button key={d} className="btn btn-xs" onClick={() => { base.current = null; apply(Math.max(0, Math.round((cur + d) * 10000) / 10000)); }}>
              {d > 0 ? '+' : '−'}{fmtNum(Math.abs(d))} pp
            </button>
          ))}
          <button className="btn btn-xs" onClick={() => { base.current = null; apply(thr - 0.01); }}>{fmtNum(thr - 0.01)}%</button>
          <button className="btn btn-xs" onClick={() => { base.current = null; apply(thr); }}>{fmtNum(thr)}% (cenzus)</button>
        </div>
      </div>
      <InfoNote>
        Pomeranje slidera odmah menja glasove i ceo obračun. Broj glasova se zaokružuje naviše, tako da lista ima najmanje izabrani procenat važećih glasova.
        Napomena: cenzus se po zakonu računa od broja birača koji su glasali (uključujući nevažeće listiće), pa se pri nevažećim listićima prag u važećim glasovima pomera naviše.
      </InfoNote>
    </div>
  );
}

function RangeInput({ value, onCommit, label }: { value: number; onCommit: (v: number) => void; label: string }) {
  const [draft, setDraft] = useState<string | null>(null);
  return (
    <label className="flex w-20 flex-col text-[10px] text-slate-500">
      {label}
      <input
        className="input px-1 py-0.5 text-right text-xs"
        value={draft ?? fmtNum(value)}
        onFocus={() => setDraft(String(value))}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => {
          const r = parseDecimal(draft ?? '', { max: 100 });
          if (r.ok) onCommit(r.value);
          setDraft(null);
        }}
        onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
      />
    </label>
  );
}

/* ─────────────── Prebacivanje glasova ─────────────── */

export function TransferTool({ lists, dispatch }: { lists: ElectoralList[]; dispatch: (a: Action) => void }) {
  const [from, setFrom] = useState(() => pickId(lists, 'demo_3', 2));
  const [to, setTo] = useState(() => pickId(lists, 'demo_1', 0));
  const [amount, setAmount] = useState('50000');
  const [unit, setUnit] = useState<TransferUnit>('votes');
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const f = pickId(lists, from);
  const t = pickId(lists, to, 1);

  const doTransfer = () => {
    const parsed = parseDecimal(amount.replace(/\./g, unit === 'votes' ? '' : '.'));
    if (!parsed.ok) return setMsg({ ok: false, text: parsed.error });
    const r = transferVotes(lists, f, t, parsed.value, unit);
    if (r.error) return setMsg({ ok: false, text: r.error });
    dispatch({ type: 'setLists', lists: r.lists });
    setMsg({ ok: true, text: `Prebačeno ${fmtInt(r.moved)} glasova. Ukupan broj glasova je nepromenjen.` });
  };

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <ListSelect lists={lists} value={f} onChange={setFrom} label="Iz liste" />
        <ListSelect lists={lists} value={t} onChange={setTo} label="U listu" />
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_auto_auto] sm:items-end">
        <label className="space-y-1">
          <span className="label">Iznos</span>
          <input className="input text-right tabular-nums" value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" />
        </label>
        <select className="input" value={unit} onChange={(e) => setUnit(e.target.value as TransferUnit)} aria-label="Jedinica">
          <option value="votes">glasova</option>
          <option value="percentOfTotal">procentnih poena (od ukupnih glasova)</option>
          <option value="percentOfSource">% glasova izvorne liste</option>
        </select>
        <button className="btn btn-primary" onClick={doTransfer} disabled={!f || !t || f === t}>
          PREBACI
        </button>
      </div>
      {f === t && <p className="text-xs text-rose-600">Izvorna i ciljna lista moraju biti različite.</p>}
      {msg && <p className={`text-sm ${msg.ok ? 'text-slate-700 dark:text-slate-300' : 'text-rose-600'}`} role="status">{msg.text}</p>}
    </div>
  );
}
