import type { ListStatus } from '../types/election';

export const STATUS_TEXT: Record<ListStatus['reason'], { label: string; title: string; kind: 'pass' | 'fail' | 'special' }> = {
  passed: { label: '✓ Prelazi', title: 'Prelazi cenzus i učestvuje u raspodeli', kind: 'pass' },
  'minority-exempt': { label: '◆ Manjinska', title: 'Ispod cenzusa, ali kao manjinska lista učestvuje u raspodeli (čl. 140); količnici uvećani', kind: 'special' },
  'no-list-passed': { label: '◇ Učestvuje', title: 'Nijedna lista nije prešla cenzus — sve liste učestvuju (čl. 128 st. 2)', kind: 'special' },
  'below-threshold': { label: '✕ Ne prelazi', title: 'Ne prelazi cenzus — ne učestvuje u raspodeli', kind: 'fail' },
  aggregate: { label: 'Zbirno', title: 'Zbirna stavka — ne učestvuje u raspodeli', kind: 'fail' },
  'no-votes': { label: 'Bez glasova', title: '0 glasova', kind: 'fail' },
};

export function StatusChip({ status }: { status: ListStatus }) {
  const t = STATUS_TEXT[status.reason];
  return (
    <span className={`chip ${t.kind === 'pass' ? 'chip-pass' : t.kind === 'fail' ? 'chip-fail' : 'chip-special'}`} title={t.title}>
      {t.label}
    </span>
  );
}
