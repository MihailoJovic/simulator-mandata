/**
 * Ankete javnog mnjenja — OPCIONI prikaz.
 *
 * Podaci se unose tačno onako kako ih je agencija objavila (izvor + datum).
 * Simulator ih ne proverava, ne ponderiše, ne koriguje i ne predviđa ishod —
 * može samo da izračuna raspodelu mandata KADA BI rezultat bio jednak anketi.
 */
export interface PollResult {
  name: string;
  percent: number;
  isMinority?: boolean;
}

export interface Poll {
  id: string;
  agency: string;
  /** Period terenskog istraživanja, kako ga navodi agencija. */
  fieldwork: string;
  published?: string;
  sample?: number;
  source?: string;
  results: PollResult[];
  note?: string;
}

/** Ankete — popunjava se iz materijala koji je dostavio korisnik. */
export const POLLS: Poll[] = [];
