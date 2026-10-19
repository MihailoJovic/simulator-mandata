/**
 * Geometrija polukružnog prikaza skupštine (parliament / hemicycle diagram).
 * Čista funkcija — bez React-a, testabilna.
 *
 * Mesta su raspoređena u R koncentričnih lukova. Broj mesta u redu je
 * proporcionalan poluprečniku (spoljni redovi imaju više mesta), a mesta se
 * zatim sortiraju po uglu — tako svaka lista zauzima "klin" s leva na desno.
 */

export interface SeatPos {
  x: number;
  y: number;
  /** Ugao u radijanima: π = levo, 0 = desno. */
  angle: number;
  row: number;
}

export interface HemicycleLayout {
  seats: SeatPos[];
  rows: number;
  /** Poluprečnik kruga jednog mesta (u istim jedinicama kao x/y; spoljni poluprečnik = 1). */
  seatRadius: number;
}

const INNER = 0.38;

function seatsPerRow(n: number, rows: number): number[] {
  const radii = Array.from({ length: rows }, (_, i) => (rows === 1 ? 1 : INNER + ((1 - INNER) * i) / (rows - 1)));
  const sum = radii.reduce((a, b) => a + b, 0);
  const exact = radii.map((r) => (n * r) / sum);
  const out = exact.map(Math.floor);
  let left = n - out.reduce((a, b) => a + b, 0);
  const order = exact.map((e, i) => [e - Math.floor(e), i] as const).sort((a, b) => b[0] - a[0] || b[1] - a[1]);
  for (let k = 0; left > 0; k = (k + 1) % rows, left--) out[order[k][1]]++;
  return out;
}

/** Bira broj redova tako da razmak između mesta u redu ≈ razmak između redova. */
function chooseRows(n: number): number {
  let best = 1;
  let bestScore = Infinity;
  for (let r = 1; r <= Math.max(1, Math.min(40, n)); r++) {
    const per = seatsPerRow(n, r);
    if (per.some((k) => k < 1)) break;
    const radial = r === 1 ? 1 - INNER : (1 - INNER) / (r - 1);
    // prosečan razmak u luku
    let arc = 0;
    per.forEach((k, i) => {
      const rad = r === 1 ? 1 : INNER + ((1 - INNER) * i) / (r - 1);
      arc += k > 1 ? (Math.PI * rad) / (k - 1) : Math.PI * rad;
    });
    arc /= r;
    const score = Math.abs(Math.log(arc / radial));
    if (score < bestScore) {
      bestScore = score;
      best = r;
    }
  }
  return best;
}

export function hemicycleLayout(n: number): HemicycleLayout {
  if (!Number.isInteger(n) || n <= 0) return { seats: [], rows: 0, seatRadius: 0 };
  const rows = chooseRows(n);
  const per = seatsPerRow(n, rows);
  const seats: SeatPos[] = [];
  per.forEach((k, i) => {
    const rad = rows === 1 ? 1 : INNER + ((1 - INNER) * i) / (rows - 1);
    for (let j = 0; j < k; j++) {
      const angle = k === 1 ? Math.PI / 2 : Math.PI * (1 - j / (k - 1));
      seats.push({ x: Math.cos(angle) * rad, y: -Math.sin(angle) * rad, angle, row: i });
    }
  });
  // s leva na desno; na istom uglu unutrašnji red prvi
  seats.sort((a, b) => b.angle - a.angle || a.row - b.row);
  const radial = rows === 1 ? 0.3 : (1 - INNER) / (rows - 1);
  const minArc = Math.min(...per.map((k, i) => (k > 1 ? (Math.PI * (rows === 1 ? 1 : INNER + ((1 - INNER) * i) / (rows - 1))) / (k - 1) : 1)));
  return { seats, rows, seatRadius: Math.min(radial, minArc) * 0.42 };
}

/**
 * Dodeljuje mesta listama redom (s leva na desno). Vraća niz ID-jeva dužine n
 * (null = nedodeljeno mesto).
 */
export function assignSeats(order: Array<{ id: string; seats: number }>, n: number): Array<string | null> {
  const out: Array<string | null> = [];
  for (const p of order) for (let k = 0; k < p.seats && out.length < n; k++) out.push(p.id);
  while (out.length < n) out.push(null);
  return out;
}
