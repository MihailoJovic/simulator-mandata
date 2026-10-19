/**
 * Osnovni tipovi izbornog simulatora.
 *
 * Svi glasovi se interno čuvaju kao CELI BROJEVI (apsolutni glasovi).
 * Procenti su isključivo izvedena (prikazna) vrednost — nikada se ne koriste
 * kao ulaz u D'Hondt obračun. Vidi README → "Tačnost".
 */

export type ListId = string;

export interface ElectoralList {
  id: ListId;
  name: string;
  /** Broj važećih glasova (ceo broj ≥ 0). */
  votes: number;
  /** Lista nacionalne manjine (čl. 140 Zakona o izboru narodnih poslanika). */
  isMinority: boolean;
  /**
   * Zbirna stavka (npr. "Ostale liste"). Glasovi se računaju u ukupan broj,
   * ali stavka NIKADA ne učestvuje u raspodeli jer ne predstavlja jednu listu.
   */
  isAggregate: boolean;
  /** Boja za prikaz (neutralna paleta; korisnik može da promeni). */
  color: string;
  /**
   * Broj kandidata na listi (opciono, čl. 129 st. 4). Ako lista osvoji više
   * mandata nego što ima kandidata, višak ide sledećem najvećem količniku.
   * null = ne ograničava (podrazumevano; zakon dozvoljava najviše 250 kandidata).
   */
  candidates: number | null;
}

/** Osnova za računanje cenzusa. */
export type ThresholdBase =
  /** Zakonska osnova: broj birača koji su glasali (važeći + nevažeći listići), čl. 128. */
  | 'voters'
  /** Hipotetička osnova: samo važeći glasovi. */
  | 'valid';

/**
 * Rešavanje PREOSTALOG nerešenog izjednačenja — kada su i količnici i broj
 * glasova potpuno jednaki. Zakon (čl. 129 st. 3) ovaj slučaj NE propisuje.
 */
export type ResidualTieBreak =
  /** Redosled unosa lista u simulatoru (deterministički; uvek se označava kao NEREŠENO po zakonu). */
  | 'input-order'
  /** Simulirani žreb sa fiksnim seed-om (deterministički i reproduktivan; takođe označen). */
  | 'lot';

export interface ElectionSettings {
  /** Broj mandata koji se raspodeljuje (zakon: 250). */
  seats: number;
  /** Izborni prag u procentima (zakon: 3). Dozvoljeno do 6 decimala. */
  thresholdPercent: number;
  thresholdBase: ThresholdBase;
  /** Broj nevažećih glasačkih listića — ulazi u "broj birača koji su glasali". */
  invalidBallots: number;
  /** Da li se primenjuju posebna pravila za manjinske liste (čl. 140). */
  minorityRules: boolean;
  /** Uvećanje količnika manjinskih lista ispod praga, u procentima (zakon: 35). */
  minorityBonusPercent: number;
  /** Čl. 128 st. 2: ako nijedna lista ne pređe prag, sve liste sa glasovima učestvuju. */
  noListPassesFallback: boolean;
  residualTieBreak: ResidualTieBreak;
  /** Seed za simulirani žreb (koristi se samo kad je residualTieBreak = 'lot'). */
  lotSeed: number;
}

export type InputMode = 'votes' | 'percent';

/** Status liste u odnosu na cenzus i učešće u raspodeli. */
export type QualificationReason =
  /** Prešla cenzus. */
  | 'passed'
  /** Ispod cenzusa, ali manjinska lista — učestvuje (čl. 140 st. 1). */
  | 'minority-exempt'
  /** Nijedna lista nije prešla cenzus — sve učestvuju (čl. 128 st. 2). */
  | 'no-list-passed'
  /** Ispod cenzusa — ne učestvuje. */
  | 'below-threshold'
  /** Zbirna stavka — nikada ne učestvuje. */
  | 'aggregate'
  /** 0 glasova — ne učestvuje. */
  | 'no-votes';

export interface ListStatus {
  id: ListId;
  name: string;
  votes: number;
  /** Procenat od važećih glasova (prikaz). */
  percentValid: number;
  /** Procenat od osnove za cenzus (prikaz). */
  percentOfBase: number;
  /** Tačna (celobrojna) provera: votes / base ≥ threshold. */
  passesThreshold: boolean;
  /** Da li učestvuje u raspodeli. */
  qualifies: boolean;
  reason: QualificationReason;
  /** Da li se količnici uvećavaju (manjinski bonus). */
  bonusApplied: boolean;
  isMinority: boolean;
  isAggregate: boolean;
}

/**
 * Racionalni broj num/den (oba ≥ 0, den > 0) — tačna reprezentacija količnika.
 * Količnik = glasovi × (100 + bonus) / (delilac × 100).
 */
export interface Rational {
  num: number;
  den: number;
}

export interface Quotient {
  /** Redni broj u rang listi (1 = najveći). */
  rank: number;
  listId: ListId;
  listIndex: number;
  votes: number;
  divisor: number;
  value: Rational;
  /** Numerička aproksimacija — SAMO za prikaz. */
  approx: number;
  /** Da li ovaj količnik donosi mandat. */
  awarded: boolean;
  /** Preskočen jer lista nema više kandidata (čl. 129 st. 4). */
  skippedNoCandidates: boolean;
  /** Količnik je jednak susednom (izjednačenje). */
  tiedWithNeighbor: boolean;
}

export interface TieInfo {
  /** Izjednačenje na granici dodele (utiče na rezultat). */
  atBoundary: boolean;
  /** Izjednačenje je rešeno zakonskim pravilom (veći broj glasova). */
  resolvedByVotes: boolean;
  /** Ostalo nerešeno po zakonu (isti količnik I isti broj glasova). */
  unresolvedByLaw: boolean;
  listIds: ListId[];
  description: string;
}

export interface DHondtResult {
  seatsByList: Record<ListId, number>;
  /** Rangirani količnici: svih dodeljenih + najmanje jedan nedodeljen (ako postoji). */
  ranked: Quotient[];
  /** Količnik koji je dodelio poslednji mandat. */
  lastAwarded: Quotient | null;
  /** Prvi količnik koji NIJE dobio mandat. */
  firstNotAwarded: Quotient | null;
  ties: TieInfo[];
  /** Broj mandata koji nije mogao biti dodeljen (npr. nema dovoljno kandidata). */
  unallocated: number;
}

export interface ValidationIssue {
  level: 'error' | 'warning';
  code: string;
  message: string;
  listId?: ListId;
}

export interface ElectionResult {
  ok: boolean;
  issues: ValidationIssue[];
  settings: ElectionSettings;
  totalValidVotes: number;
  /** Broj birača koji su glasali = važeći + nevažeći. */
  votersWhoVoted: number;
  /** Osnova za cenzus (zavisi od thresholdBase). */
  thresholdBaseVotes: number;
  /** Najmanji broj glasova potreban za prelazak cenzusa. */
  minVotesToPass: number;
  statuses: ListStatus[];
  dhondt: DHondtResult | null;
  seatsByList: Record<ListId, number>;
  totalSeatsAllocated: number;
  /** Glasovi lista koje ne učestvuju u raspodeli. */
  votesOutside: number;
  percentOutside: number;
  outsideLists: ListStatus[];
  qualifiedCount: number;
  disqualifiedCount: number;
  noListPassedApplied: boolean;
  computeMs: number;
}

export interface Scenario {
  id: string;
  name: string;
  createdAt: string;
  lists: ElectoralList[];
  settings: ElectionSettings;
  inputMode: InputMode;
}
