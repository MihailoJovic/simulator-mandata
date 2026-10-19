import { useEffect, useRef, useState } from 'react';

function useWidth<T extends HTMLElement>(): [React.RefObject<T>, number] {
  const ref = useRef<T>(null);
  const [w, setW] = useState(600);
  useEffect(() => {
    if (!ref.current) return;
    const ro = new ResizeObserver((e) => setW(Math.max(240, Math.floor(e[0].contentRect.width))));
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);
  return [ref, w];
}

function niceTicks(min: number, max: number, count = 5): number[] {
  if (!(max > min)) return [min];
  const span = max - min;
  const step0 = span / count;
  const mag = 10 ** Math.floor(Math.log10(step0));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => span / s <= count) ?? mag * 10;
  const out: number[] = [];
  for (let v = Math.ceil(min / step) * step; v <= max + 1e-9; v += step) out.push(Math.round(v * 1e6) / 1e6);
  return out;
}

export interface StepPoint {
  x: number;
  y: number;
}

/**
 * Stepenasti linijski grafikon (broj mandata je celobrojan i menja se skokovito).
 * Jedna serija, jedna Y osa; opciono referentna linija (većina) i vertikalni marker (cenzus).
 */
export function StepChart({
  title,
  points,
  color = '#4f6d8a',
  formatX,
  xLabel,
  yLabel = 'mandati',
  refY,
  refYLabel,
  markerX,
  markerXLabel,
  height = 200,
}: {
  title: string;
  points: StepPoint[];
  color?: string;
  formatX: (x: number) => string;
  xLabel: string;
  yLabel?: string;
  refY?: number;
  refYLabel?: string;
  markerX?: number | null;
  markerXLabel?: string;
  height?: number;
}) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  if (!points.length) return null;

  const m = { t: 12, r: 12, b: 34, l: 40 };
  const iw = width - m.l - m.r;
  const ih = height - m.t - m.b;
  const xs = points.map((p) => p.x);
  const x0 = Math.min(...xs);
  const x1 = Math.max(...xs);
  const yMaxData = Math.max(...points.map((p) => p.y), refY ?? 0, 1);
  const yMax = Math.ceil(yMaxData * 1.08);
  const sx = (x: number) => m.l + (x1 > x0 ? ((x - x0) / (x1 - x0)) * iw : iw / 2);
  const sy = (y: number) => m.t + ih - (y / yMax) * ih;

  let d = `M${sx(points[0].x)},${sy(points[0].y)}`;
  for (let i = 1; i < points.length; i++) d += ` H${sx(points[i].x)} V${sy(points[i].y)}`;

  const yt = niceTicks(0, yMax, 4);
  const xt = niceTicks(x0, x1, Math.max(2, Math.floor(iw / 80)));

  const onMove = (e: React.PointerEvent<SVGRectElement>) => {
    const r = (e.currentTarget as SVGRectElement).getBoundingClientRect();
    const px = e.clientX - r.left + m.l;
    let best = 0;
    let bd = Infinity;
    points.forEach((p, i) => {
      const dd = Math.abs(sx(p.x) - px);
      if (dd < bd) {
        bd = dd;
        best = i;
      }
    });
    setHover(best);
  };

  const hp = hover !== null ? points[hover] : null;

  return (
    <figure ref={ref} className="relative w-full">
      <figcaption className="mb-1 text-xs font-semibold text-slate-600 dark:text-slate-300">{title}</figcaption>
      <svg width={width} height={height} className="block overflow-visible text-slate-500 dark:text-slate-400" role="img" aria-label={title}>
        {yt.map((t) => (
          <g key={`y${t}`}>
            <line x1={m.l} x2={m.l + iw} y1={sy(t)} y2={sy(t)} stroke="currentColor" strokeOpacity={0.15} />
            <text x={m.l - 6} y={sy(t)} dy="0.32em" textAnchor="end" fontSize={11} fill="currentColor">
              {t}
            </text>
          </g>
        ))}
        {xt.map((t) => (
          <text key={`x${t}`} x={sx(t)} y={m.t + ih + 16} textAnchor="middle" fontSize={11} fill="currentColor">
            {formatX(t)}
          </text>
        ))}
        <text x={m.l + iw} y={height - 2} textAnchor="end" fontSize={10} fill="currentColor">
          {xLabel}
        </text>
        <text x={4} y={m.t - 2} fontSize={10} fill="currentColor">
          {yLabel}
        </text>
        <line x1={m.l} x2={m.l + iw} y1={sy(0)} y2={sy(0)} stroke="currentColor" strokeOpacity={0.5} />

        {markerX != null && markerX >= x0 && markerX <= x1 && (
          <g>
            <line x1={sx(markerX)} x2={sx(markerX)} y1={m.t} y2={m.t + ih} stroke="currentColor" strokeDasharray="4 3" />
            <text x={sx(markerX) + 4} y={m.t + 10} fontSize={10} fill="currentColor">
              {markerXLabel}
            </text>
          </g>
        )}
        {refY != null && (
          <g>
            <line x1={m.l} x2={m.l + iw} y1={sy(refY)} y2={sy(refY)} stroke="currentColor" strokeWidth={1.5} strokeDasharray="6 3" className="text-slate-800 dark:text-slate-200" />
            <text x={m.l + 4} y={sy(refY) - 4} fontSize={10} fill="currentColor" className="text-slate-800 dark:text-slate-200">
              {refYLabel}
            </text>
          </g>
        )}

        <path d={d} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" />

        {hp && (
          <g pointerEvents="none">
            <line x1={sx(hp.x)} x2={sx(hp.x)} y1={m.t} y2={m.t + ih} stroke="currentColor" strokeOpacity={0.4} />
            <circle cx={sx(hp.x)} cy={sy(hp.y)} r={4} fill={color} stroke="white" strokeWidth={2} />
          </g>
        )}
        <rect x={m.l} y={m.t} width={iw} height={ih} fill="transparent" onPointerMove={onMove} onPointerLeave={() => setHover(null)} />
      </svg>
      {hp && (
        <div
          className="pointer-events-none absolute z-10 rounded-md border border-slate-200 bg-white px-2 py-1 text-xs shadow dark:border-slate-700 dark:bg-slate-900"
          style={{ left: Math.min(width - 120, Math.max(0, sx(hp.x) + 8)), top: 18 }}
        >
          <div className="text-slate-500">{formatX(hp.x)}</div>
          <div className="font-semibold tabular-nums">
            {hp.y} {yLabel}
          </div>
        </div>
      )}
    </figure>
  );
}

/** Histogram raspodele mandata (Monte Carlo). */
export function Histogram({ title, counts, color = '#4f6d8a', total, refX }: { title: string; counts: number[]; color?: string; total: number; refX?: number }) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  let lo = counts.findIndex((c) => c > 0);
  let hi = counts.length - 1 - [...counts].reverse().findIndex((c) => c > 0);
  if (lo < 0) return null;
  if (refX !== undefined) {
    lo = Math.min(lo, refX);
    hi = Math.max(hi, refX);
  }
  lo = Math.max(0, lo - 1);
  hi = Math.min(counts.length - 1, hi + 1);
  const bins = counts.slice(lo, hi + 1);
  const height = 180;
  const m = { t: 10, r: 10, b: 28, l: 44 };
  const iw = width - m.l - m.r;
  const ih = height - m.t - m.b;
  const maxC = Math.max(...bins, 1);
  const bw = iw / bins.length;
  const gap = bw > 6 ? 2 : bw > 3 ? 1 : 0;
  const xt = niceTicks(lo, hi, Math.max(2, Math.floor(iw / 60)));
  return (
    <figure ref={ref} className="relative w-full">
      <figcaption className="mb-1 text-xs font-semibold text-slate-600 dark:text-slate-300">{title}</figcaption>
      <svg width={width} height={height} className="block text-slate-500 dark:text-slate-400" role="img" aria-label={title}>
        <line x1={m.l} x2={m.l + iw} y1={m.t + ih} y2={m.t + ih} stroke="currentColor" strokeOpacity={0.5} />
        {[0, 0.5, 1].map((f) => (
          <text key={f} x={m.l - 6} y={m.t + ih - f * ih} dy="0.32em" textAnchor="end" fontSize={10} fill="currentColor">
            {((f * maxC * 100) / total).toFixed(1)}%
          </text>
        ))}
        {bins.map((c, i) => {
          const h = (c / maxC) * ih;
          return (
            <rect
              key={i}
              x={m.l + i * bw + gap / 2}
              y={m.t + ih - h}
              width={Math.max(1, bw - gap)}
              height={h}
              rx={bw > 8 ? 2 : 0}
              fill={color}
              opacity={hover === null || hover === i ? 1 : 0.5}
              onPointerEnter={() => setHover(i)}
              onPointerLeave={() => setHover(null)}
            />
          );
        })}
        {xt.map((t) => (
          <text key={t} x={m.l + (t - lo + 0.5) * bw} y={height - 12} textAnchor="middle" fontSize={10} fill="currentColor">
            {t}
          </text>
        ))}
        {refX !== undefined && (
          <line x1={m.l + (refX - lo) * bw} x2={m.l + (refX - lo) * bw} y1={m.t} y2={m.t + ih} stroke="currentColor" strokeDasharray="4 3" className="text-slate-800 dark:text-slate-200" />
        )}
      </svg>
      {hover !== null && (
        <div className="pointer-events-none absolute right-0 top-0 rounded-md border border-slate-200 bg-white px-2 py-1 text-xs shadow dark:border-slate-700 dark:bg-slate-900">
          <strong>{lo + hover}</strong> mandata: {bins[hover].toLocaleString('sr-RS')} simulacija ({((bins[hover] / total) * 100).toFixed(2)}%)
        </div>
      )}
    </figure>
  );
}
