import { useEffect, useState, type ReactNode } from 'react';

export type UpdateStatus =
  | { state: 'idle' }
  | { state: 'checking' }
  | { state: 'not-available' }
  | { state: 'available'; version: string }
  | { state: 'downloading'; percent: number }
  | { state: 'downloaded'; version: string }
  | { state: 'error'; message: string };

export interface DesktopApi {
  getVersion(): Promise<string>;
  getUpdateStatus(): Promise<UpdateStatus>;
  onUpdateStatus(cb: (s: UpdateStatus) => void): () => void;
  checkForUpdates(): Promise<void>;
  downloadUpdate(): Promise<void>;
  installUpdate(): Promise<void>;
}

declare global {
  interface Window {
    desktop?: DesktopApi;
  }
}

/**
 * Obaveštenje o novoj verziji (samo u desktop aplikaciji).
 * Nova verzija → "Skini" → preuzimanje → "Restartuj i instaliraj".
 */
export function UpdateBanner() {
  const api = typeof window !== 'undefined' ? window.desktop : undefined;
  const [status, setStatus] = useState<UpdateStatus>({ state: 'idle' });
  const [version, setVersion] = useState('');
  const [dismissed, setDismissed] = useState(false);
  const [manual, setManual] = useState(false);

  useEffect(() => {
    if (!api) return;
    api.getVersion().then(setVersion).catch(() => {});
    api.getUpdateStatus().then(setStatus).catch(() => {});
    return api.onUpdateStatus((s) => {
      setStatus(s);
      if (s.state === 'available') setDismissed(false);
    });
  }, [api]);

  if (!api) return null;

  const check = () => {
    setManual(true);
    setDismissed(false);
    api.checkForUpdates().catch(() => {});
  };

  const bar = (children: ReactNode) => (
    <div className="no-print flex flex-wrap items-center gap-2 rounded-lg border-2 border-slate-800 bg-white px-3 py-2 text-sm dark:border-slate-200 dark:bg-slate-900" role="status">
      {children}
    </div>
  );

  if (!dismissed) {
    if (status.state === 'available')
      return bar(
        <>
          <span className="chip chip-pass">NOVO</span>
          <span className="flex-1">
            Dostupna je nova verzija <strong>{status.version}</strong> (vi imate {version}).
          </span>
          <button className="btn btn-primary" onClick={() => api.downloadUpdate()}>Skini</button>
          <button className="btn" onClick={() => setDismissed(true)}>Kasnije</button>
        </>,
      );
    if (status.state === 'downloading')
      return bar(
        <>
          <span className="flex-1">Preuzimanje nove verzije… {Math.round(status.percent)}%</span>
          <span className="h-2 w-40 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
            <span className="block h-full bg-slate-800 dark:bg-slate-200" style={{ width: `${status.percent}%` }} />
          </span>
        </>,
      );
    if (status.state === 'downloaded')
      return bar(
        <>
          <span className="flex-1">
            Verzija <strong>{status.version}</strong> je preuzeta. Aplikacija će se zatvoriti, instalirati novu verziju i ponovo pokrenuti.
          </span>
          <button className="btn btn-primary" onClick={() => api.installUpdate()}>Restartuj i instaliraj</button>
          <button className="btn" onClick={() => setDismissed(true)}>Pri sledećem zatvaranju</button>
        </>,
      );
    if (manual && status.state === 'not-available') return bar(<span className="flex-1">Imate najnoviju verziju ({version}).</span>);
    if (manual && status.state === 'checking') return bar(<span className="flex-1">Proveravam da li postoji nova verzija…</span>);
    if (manual && status.state === 'error') return bar(<span className="flex-1">Provera ažuriranja nije uspela (proverite internet vezu). {status.message}</span>);
  }

  return (
    <p className="no-print text-right text-xs text-slate-500">
      Verzija {version}{' '}
      <button className="underline underline-offset-2 hover:text-slate-800 dark:hover:text-slate-200" onClick={check}>
        Proveri ažuriranja
      </button>
    </p>
  );
}
