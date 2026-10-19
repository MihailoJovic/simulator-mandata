import type { ElectoralList } from '../../types/election';
import type { Adjustment } from '../../calculations';
import { safeColor } from '../../utils/colors';
import { Swatch } from '../ui';

export type AdjKind = Adjustment['kind'];

export function toAdjustment(kind: AdjKind, sourceId: string): Adjustment {
  return kind === 'from' ? { kind: 'from', sourceId } : { kind };
}

export function AdjustmentSelect({
  lists,
  kind,
  sourceId,
  excludeId,
  onChange,
}: {
  lists: ElectoralList[];
  kind: AdjKind;
  sourceId: string;
  excludeId?: string;
  onChange: (kind: AdjKind, sourceId: string) => void;
}) {
  const sources = lists.filter((l) => l.id !== excludeId);
  return (
    <div className="space-y-1">
      <span className="label">Kada se rezultat menja, ostale liste:</span>
      <select className="input" value={kind} onChange={(e) => onChange(e.target.value as AdjKind, sourceId || sources[0]?.id || '')}>
        <option value="proportional">proporcionalno se smanjuju/povećavaju (ukupno isto)</option>
        <option value="none">ostaju iste (ukupan broj glasova se menja)</option>
        <option value="from">razlika ide iz/u jednu listu (ukupno isto)</option>
      </select>
      {kind === 'from' && (
        <ListSelect lists={sources} value={sourceId} onChange={(id) => onChange(kind, id)} label="Izvorna lista" />
      )}
    </div>
  );
}

export function ListSelect({ lists, value, onChange, label }: { lists: ElectoralList[]; value: string; onChange: (id: string) => void; label?: string }) {
  return (
    <label className="block space-y-1">
      {label && <span className="label">{label}</span>}
      <select className="input" value={value} onChange={(e) => onChange(e.target.value)}>
        {!lists.some((l) => l.id === value) && <option value="">— izaberite —</option>}
        {lists.map((l) => (
          <option key={l.id} value={l.id}>
            {l.name || '(bez naziva)'}
          </option>
        ))}
      </select>
    </label>
  );
}

export function GroupPicker({ lists, value, onChange, label }: { lists: ElectoralList[]; value: string[]; onChange: (ids: string[]) => void; label: string }) {
  return (
    <fieldset>
      <legend className="label mb-1">{label}</legend>
      <div className="flex flex-wrap gap-1.5">
        {lists.map((l) => {
          const on = value.includes(l.id);
          return (
            <button
              key={l.id}
              type="button"
              aria-pressed={on}
              onClick={() => onChange(on ? value.filter((x) => x !== l.id) : [...value, l.id])}
              className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs transition ${
                on ? 'border-slate-800 bg-slate-800 text-white dark:border-slate-200 dark:bg-slate-200 dark:text-slate-900' : 'border-slate-300 text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800'
              }`}
            >
              <Swatch color={safeColor(l.color)} className="!h-2.5 !w-2.5" />
              {l.name || '(bez naziva)'}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

/** Vraća validan ID iz liste ili prvi dostupan. */
export function pickId(lists: ElectoralList[], id: string, fallbackIndex = 0): string {
  return lists.some((l) => l.id === id) ? id : lists[Math.min(fallbackIndex, lists.length - 1)]?.id ?? '';
}
