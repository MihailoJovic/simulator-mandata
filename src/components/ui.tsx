import { useEffect, useRef, useState, type ReactNode } from 'react';

export function Card({ title, actions, children, className = '', id }: { title?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string; id?: string }) {
  return (
    <section className={`card min-w-0 ${className}`} id={id}>
      {(title || actions) && (
        <header className="card-h">
          {title && <h2 className="card-title">{title}</h2>}
          {actions && <div className="flex flex-wrap items-center gap-1.5">{actions}</div>}
        </header>
      )}
      <div className="min-w-0 p-4">{children}</div>
    </section>
  );
}

export function Toggle({ checked, onChange, label, hint }: { checked: boolean; onChange: (v: boolean) => void; label: ReactNode; hint?: string }) {
  return (
    <label className="inline-flex cursor-pointer select-none items-center gap-2 text-sm" title={hint}>
      <input type="checkbox" className="h-4 w-4 accent-slate-700 dark:accent-slate-300" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span>{label}</span>
    </label>
  );
}

export function Segmented<T extends string>({ value, options, onChange, size = 'sm' }: { value: T; options: Array<{ value: T; label: ReactNode }>; onChange: (v: T) => void; size?: 'sm' | 'xs' }) {
  return (
    <div className="inline-flex rounded-md border border-slate-300 p-0.5 dark:border-slate-700" role="radiogroup">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={`rounded ${size === 'xs' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-sm'} font-medium transition ${
            value === o.value ? 'bg-slate-800 text-white dark:bg-slate-200 dark:text-slate-900' : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Modal({ open, onClose, title, children, wide }: { open: boolean; onClose: () => void; title: ReactNode; children: ReactNode; wide?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    ref.current?.focus();
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/50 p-4 sm:p-8" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div ref={ref} tabIndex={-1} role="dialog" aria-modal="true" className={`card w-full ${wide ? 'max-w-4xl' : 'max-w-lg'} outline-none`}>
        <header className="card-h">
          <h2 className="text-base font-semibold">{title}</h2>
          <button className="btn btn-xs" onClick={onClose} aria-label="Zatvori">
            ✕
          </button>
        </header>
        <div className="max-h-[80vh] overflow-y-auto p-4">{children}</div>
      </div>
    </div>
  );
}

export function ConfirmDialog({ open, title, message, confirmLabel, onConfirm, onCancel }: { open: boolean; title: string; message: ReactNode; confirmLabel: string; onConfirm: () => void; onCancel: () => void }) {
  return (
    <Modal open={open} onClose={onCancel} title={title}>
      <div className="space-y-4 text-sm">
        <div>{message}</div>
        <div className="flex justify-end gap-2">
          <button className="btn" onClick={onCancel}>
            Otkaži
          </button>
          <button className="btn btn-primary" onClick={onConfirm}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </Modal>
  );
}

export function Swatch({ color, className = '' }: { color: string; className?: string }) {
  return <span className={`inline-block h-3 w-3 shrink-0 rounded-sm ${className}`} style={{ background: color }} aria-hidden />;
}

export function InfoNote({ children }: { children: ReactNode }) {
  return <p className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-400">{children}</p>;
}

/** Tekstualni unos koji se potvrđuje tek kada je vrednost validna; greška se prikazuje odmah. */
export function ParsedInput({
  value,
  format,
  parse,
  onCommit,
  className = '',
  ariaLabel,
  placeholder,
}: {
  value: number;
  format: (v: number) => string;
  parse: (s: string) => { ok: true; value: number } | { ok: false; error: string };
  onCommit: (v: number) => void;
  className?: string;
  ariaLabel?: string;
  placeholder?: string;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const shown = draft ?? (Number.isFinite(value) ? format(value) : '');
  return (
    <div className="w-full">
      <input
        className={`input text-right tabular-nums ${error ? 'input-error' : ''} ${className}`}
        value={shown}
        inputMode="decimal"
        aria-label={ariaLabel}
        aria-invalid={!!error}
        placeholder={placeholder}
        onFocus={(e) => {
          setDraft(Number.isFinite(value) ? String(value) : '');
          requestAnimationFrame(() => e.target.select());
        }}
        onChange={(e) => {
          setDraft(e.target.value);
          const r = parse(e.target.value);
          if (r.ok) {
            setError(null);
            onCommit(r.value);
          } else setError(r.error);
        }}
        onBlur={() => {
          // Nevalidan unos ostaje vidljiv sa greškom (obračun koristi poslednju validnu vrednost).
          if (!error) setDraft(null);
        }}
        onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
      />
      {error && (
        <p className="mt-0.5 whitespace-normal text-left text-[11px] text-rose-600 dark:text-rose-400" role="alert">
          {error} Obračun koristi poslednju ispravnu vrednost ({format(value)}).
        </p>
      )}
    </div>
  );
}
