import type { ElectionSettings } from '../types/election';

/**
 * Izborna pravila Republike Srbije — parlamentarni izbori.
 *
 * IZVOR: Zakon o izboru narodnih poslanika ("Službeni glasnik RS", br. 14/2022 i 47/2026),
 * konsolidovani tekst. Provereno: 19.10.2026.
 *
 *  - čl. 128 st. 1: U raspodeli mandata mogu učestvovati samo izborne liste koje su dobile
 *    najmanje 3% glasova OD BROJA BIRAČA KOJI SU GLASALI.
 *  - čl. 128 st. 2: Ako nijedna lista nije dobila 3%, sve liste koje su dobile glasove
 *    učestvuju u raspodeli.
 *  - čl. 129 st. 1–2: Sistem najvećeg količnika — glasovi se dele brojevima od 1 do 250,
 *    lista dobija onoliko mandata koliko ima količnika među 250 najvećih.
 *  - čl. 129 st. 3: Ako dve ili više lista dobiju iste količnike na osnovu kojih se
 *    raspodeljuje mandat, prednost ima lista koja je dobila VEĆI BROJ GLASOVA.
 *  - čl. 129 st. 4: Ako lista ima više mandata nego kandidata, mandat se dodeljuje listi
 *    kojoj pripada sledeći najveći količnik za koji nije dodeljen mandat.
 *  - čl. 140 st. 1: Lista nacionalne manjine učestvuje u raspodeli i kada dobije manje od 3%.
 *  - čl. 140 st. 2: Količnici lista nacionalnih manjina koje su osvojile manje od 3%
 *    UVEĆAVAJU SE ZA 35%.
 *  - Tekst čl. 128, 129 i 140 preuzet je iz konsolidovanog teksta koji uključuje izmenu
 *    47/2026 (izmena se odnosi na obuku članova izbornih organa, ne na raspodelu mandata).
 *
 * NAPOMENE / OTVORENA PITANJA (zakon ih ne uređuje):
 *  - Zakon ne propisuje zaokruživanje: simulator radi isključivo sa tačnom celobrojnom
 *    (racionalnom) aritmetikom, bez ikakvog zaokruživanja u obračunu.
 *  - Zakon ne propisuje šta se dešava kada su i količnik i broj glasova jednaki.
 *    Simulator takav slučaj označava kao "NEREŠENO PO ZAKONU" i primenjuje
 *    konfigurabilno pomoćno pravilo (redosled unosa ili simulirani žreb).
 *  - Status manjinske liste u stvarnosti utvrđuje RIK (čl. 139); u simulatoru ga bira korisnik.
 */
export const LEGAL_SOURCE = {
  law: 'Zakon o izboru narodnih poslanika',
  gazette: '"Službeni glasnik RS", br. 14/2022 i 47/2026',
  checkedOn: '19.10.2026.',
  urls: [
    {
      label: 'Konsolidovani tekst (Pokrajinski informacioni katalog, Skupština AP Vojvodine, PDF)',
      url: 'https://pik.skupstinavojvodine.gov.rs/docs/12026zakonOIzboruNarodnihPoslanika_8ad4b7f7-815c-4e57-bbfc-2d99066a63e2.pdf',
    },
    {
      label: 'Pravno-informacioni sistem RS (zvanični portal)',
      url: 'https://pravno-informacioni-sistem.rs/SlGlasnikPortal/eli/rep/sgrs/skupstina/zakon/2022/14/2',
    },
    {
      label: 'RIK — O izborima za narodne poslanike',
      url: 'https://www.rik.parlament.gov.rs/tekst/sr/77/o-izborima-za-narodne-poslanike.php',
    },
  ],
} as const;

/** Podrazumevana (zakonska) podešavanja. */
export const LEGAL_DEFAULTS: ElectionSettings = {
  seats: 250,
  thresholdPercent: 3,
  thresholdBase: 'voters',
  invalidBallots: 0,
  minorityRules: true,
  minorityBonusPercent: 35,
  noListPassesFallback: true,
  residualTieBreak: 'input-order',
  lotSeed: 2026,
};

export const THRESHOLD_PRESETS = [0, 1, 2, 3, 4, 5] as const;

/** Granice validacije. */
export const LIMITS = {
  maxVotes: 1_000_000_000,
  maxSeats: 1000,
  maxLists: 200,
  maxNameLength: 120,
  maxThresholdDecimals: 6,
} as const;

export function majorityOf(seats: number): number {
  return Math.floor(seats / 2) + 1;
}
