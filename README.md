# Simulator raspodele mandata — Narodna skupština Republike Srbije

Interaktivni **matematički i edukativni** simulator raspodele 250 poslaničkih mandata
(jedna izborna jedinica, cenzus 3%, D'Hondt / sistem najvećeg količnika).

> **Ovo nije prognoza izbora.** Simulator prikazuje matematičke posledice unetih podataka.
> Rezultati zavise isključivo od pretpostavki korisnika. Demo liste su izmišljeni brojevi.

Sve radi lokalno u browseru — nema backend-a, ništa se ne šalje na server.

---

## Instalacija i pokretanje

Potrebno: **Node.js 18+** (preporučeno 20 ili 22 LTS) — https://nodejs.org

```bash
npm install        # instalacija zavisnosti
npm run dev        # development server → http://localhost:5173
npm run build      # production build → dist/
npm run preview    # lokalni pregled production build-a
npm test           # pokretanje svih testova (Vitest)
npm run test:watch # testovi u watch režimu
```

### Desktop aplikacija (Windows) i automatsko ažuriranje

**Za korisnike:** preuzmite `Simulator-mandata-Setup-<verzija>.exe` sa
[GitHub Releases](https://github.com/MihailoJovic/simulator-mandata/releases/latest) i pokrenite ga
(instalacija je u jednom kliku, bez administratorskih prava; pravi prečicu na desktopu).
Kada izađe nova verzija, aplikacija prikaže obaveštenje **„Dostupna je nova verzija — Skini”**,
zatim **„Restartuj i instaliraj”**. Ručna provera: link „Proveri ažuriranja” ispod zaglavlja.

Exe nije digitalno potpisan, pa Windows SmartScreen pri prvoj instalaciji može prikazati
upozorenje („More info” → „Run anyway”). Podaci i sačuvani scenariji ostaju na računaru
(`%APPDATA%\Simulator mandata`). U desktop verziji dugme „Podeli link” je sakriveno —
scenario se deli preko **Export JSON / Import JSON**.

```bash
npm run desktop    # simulator u sopstvenom prozoru (Electron), za razvoj
npm run dist:win   # lokalni installer u release/ (bez objavljivanja)
```

Provera upakovane aplikacije: `"release/win-unpacked/Simulator mandata.exe" --smoke-test=rezultat.json`
(zaseban privremeni profil; proverava Ez/Advanced, polukrug, Monte Carlo worker, localStorage,
desktop API i otvaranje prozora „Vizuelni prikaz”). `SMOKE_SHOTS=<folder>` dodatno snima ekran.

### Objavljivanje nove verzije

1. Povećajte verziju: `npm version patch` (1.1.0 → 1.1.1), `npm version minor` (→ 1.2.0) ili ručno u `package.json`.
   `npm version` automatski pravi commit i tag `v<verzija>`.
2. `git push --follow-tags`
3. GitHub Actions (`.github/workflows/release.yml`) pokreće testove, pravi installer i objavljuje
   ga na GitHub Releases zajedno sa `latest.yml`. Instalirane aplikacije ga pronalaze pri
   sledećem pokretanju (i svaka 2 sata dok su otvorene).

Tag mora odgovarati verziji iz `package.json` (workflow to proverava).

## Režimi i prikazi

- **Ez Mode** (podrazumevano): unos naziva i procenata/glasova, polukrug skupštine, provera većine.
- **Advanced Mode**: sva podešavanja i alati (D'Hondt obračun, šta-ako, prebacivanje glasova,
  pronađi granicu, osetljivost, Monte Carlo, scenariji, import/export, debug).
- **Vizuelni prikaz ↗** — poseban prozor koji se uživo osvežava: skupština u polukrugu,
  kartice lista, hipotetička grupa (klik na mesta/kartice; grupa se crta sleva da se vidi
  prelazak sredine = 126) i **Izborna noć** — ilustrativna animacija prebrojavanja koja se na
  100% tačno poklapa sa unetim podacima. Redosled lista u polukrugu = redosled u unosu.
- **Ankete (opciono)** — prikaz objavljenih anketa (`src/data/polls.ts`, sa izvorom i datumom),
  prost prosek izabranih anketa i dugme „Simuliraj” koje učitava rezultat ankete u simulator.
  Deo do 100% ulazi kao zbirna stavka bez mandata. Simulator ankete ne proverava i ne ponderiše.

`dist/` je statički sajt (relativne putanje) — može se otvoriti preko bilo kog statičkog servera
(GitHub Pages, Netlify, `npx serve dist`…).

## Struktura projekta

```
src/
  calculations/       ← IZBORNA MATEMATIKA (bez React-a, čiste funkcije)
    threshold.ts        calculatePercentages(), applyThreshold(), passesThreshold()
    dhondt.ts           calculateDHondt() (heap) + calculateDHondtNaive() (referentna)
    mandates.ts         calculateMandates() — kompletan obračun
    majority.ts         calculateMajority()
    scenarios.ts        compareScenarios()
    voteOps.ts          transferVotes(), setListVotes(), setListShare(), percentagesToVotes()
    analysis.ts         findThreshold(), runSensitivityAnalysis()
    monteCarlo.ts       runMonteCarloSimulation()
    validation.ts       validateLists(), validateSettings(), validatePercentages()
    rational.ts         tačna racionalna aritmetika
    index.ts            javni API engine-a
  data/
    rules.ts            zakonska pravila, izvori, podrazumevana podešavanja
    demo.ts             DEMO PODACI
  types/election.ts   tipovi
  hooks/              stanje aplikacije (reducer, localStorage)
  components/         UI komponente; components/tools/ — alati za analizu
  pages/              glavna stranica i „Kako simulator računa?”
  workers/            Web Worker za Monte Carlo
  utils/              formatiranje, parsiranje, import/export, URL deljenje, PRNG
  tests/              test suite (Vitest)
```

Matematika je potpuno odvojena od UI-ja: komponente samo pozivaju funkcije iz `src/calculations`.

## Izborna pravila i izvori

**Izvor:** Zakon o izboru narodnih poslanika, „Službeni glasnik RS”, br. 14/2022 i 47/2026
(konsolidovani tekst). **Provereno: 19.10.2026.**

- Konsolidovani tekst (PDF, Pokrajinski informacioni katalog):
  https://pik.skupstinavojvodine.gov.rs/docs/12026zakonOIzboruNarodnihPoslanika_8ad4b7f7-815c-4e57-bbfc-2d99066a63e2.pdf
- Pravno-informacioni sistem RS: https://pravno-informacioni-sistem.rs/SlGlasnikPortal/eli/rep/sgrs/skupstina/zakon/2022/14/2
- RIK — O izborima za narodne poslanike: https://www.rik.parlament.gov.rs/tekst/sr/77/o-izborima-za-narodne-poslanike.php

| Pravilo | Član | Implementacija |
|---|---|---|
| 250 poslanika, jedna izborna jedinica | čl. 1 | `LEGAL_DEFAULTS.seats = 250` |
| Cenzus: najmanje 3% glasova **od broja birača koji su glasali** | čl. 128 st. 1 | osnova = važeći + nevažeći listići (polje „Nevažeći listići”) |
| Ako nijedna lista ne pređe 3%, sve liste sa glasovima učestvuju | čl. 128 st. 2 | `noListPassesFallback` |
| Glasovi se dele brojevima 1…250; 250 najvećih količnika | čl. 129 st. 1–2 | `calculateDHondt()` |
| Jednaki količnici → prednost lista sa **više glasova** | čl. 129 st. 3 | komparator u `dhondt.ts` |
| Lista sa manje kandidata od mandata → sledeći najveći količnik | čl. 129 st. 4 | opciono polje „Kandidata” |
| Manjinska lista učestvuje i ispod 3% | čl. 140 st. 1 | checkbox „Manjinska lista” |
| Količnici manjinskih lista sa < 3% uvećavaju se za 35% | čl. 140 st. 2 | množilac 27/20 (tačno) |

Izmena 47/2026 odnosi se na obuku članova izbornih organa i ne menja čl. 128, 129 i 140.

### Otvorena pitanja (zakon ih ne uređuje) — kako su obrađena

1. **Isti količnik I isti broj glasova.** Zakon ne propisuje rešenje. Simulator primenjuje
   konfigurabilno pomoćno pravilo (redosled unosa ili simulirani žreb sa seed-om) i takav
   rezultat **uvek označava kao „NEREŠENO PO ZAKONU”** (upozorenje na vrhu i u kartici granice).
2. **Zaokruživanje.** Zakon ne propisuje zaokruživanje. Obračun ne zaokružuje ništa:
   cenzus i količnici se porede tačno (celi brojevi / razlomci).
3. **Hipotetički cenzus ≠ 3%.** Zakon u čl. 140 navodi „manje od 3%”. Kada korisnik promeni
   cenzus, manjinski bonus se primenjuje na manjinske liste **ispod podešenog cenzusa**.
4. **Manjinski status** u stvarnosti utvrđuje RIK (čl. 139). U simulatoru ga bira korisnik.
5. **„Nijedna lista ne prelazi cenzus” + manjinska lista**: po doslovnom tekstu čl. 140 st. 2,
   manjinska lista ispod 3% i tada dobija uvećanje količnika.

### Provera na zvaničnom rezultatu

Test `src/tests/official2023.test.ts` unosi zvanične rezultate izbora od 17.12.2023.
(ukupan izveštaj RIK-a od 12.01.2024: 18 lista, 3.710.978 važećih i 104.029 nevažećih listića)
i proverava da simulator daje **identičnu** raspodelu mandata kao RIK (129/65/18/13/13/6/2/2/1/1).

## Kako radi D'Hondt

1. Za svaku listu koja učestvuje: količnici glasovi ÷ 1, ÷ 2, … ÷ 250.
2. Svi količnici se rangiraju od najvećeg; prvih 250 donosi po jedan mandat.
3. Prikazuju se 250. (poslednji osvojeni) i 251. (prvi neizabrani) količnik i koliko bi glasova
   lista sa 251. količnikom trebalo da ima da preuzme poslednji mandat.

**Implementacija:** umesto generisanja svih n × 250 količnika koristi se max-heap sa „sledećim”
količnikom svake liste; k-ti izvađeni element je tačno k-ti najveći količnik
(složenost O(S · log n)). Test upoređuje heap sa naivnim „generiši sve i sortiraj” postupkom
na stotinama nasumičnih scenarija.

**Tačnost:** količnik a/d se nikada ne poredi preko floating-point deljenja. Poredi se unakrsnim
množenjem celih brojeva (`a₁·d₂ ⋛ a₂·d₁`), Number aritmetikom dok je rezultat ≤ 2⁵³ (tada je
tačna), a inače automatski preko `BigInt`. Cenzus se proverava kao
`glasovi × 100 × q ≥ p × osnova` za cenzus p/q % (BigInt) — lista sa tačno 3,000% prelazi.
Procenti se koriste samo za prikaz; unos po procentima se pretvara u cele glasove metodom
najvećeg ostatka (zbir je tačno zadati ukupan broj glasova).

## Kako radi cenzus

- Osnova (zakon): broj birača koji su glasali = važeći glasovi + nevažeći listići.
  Može se prebaciti na „samo važeći glasovi” (hipotetički) u naprednim podešavanjima.
- Cenzus je podesiv (0–5% preko dugmadi, ili proizvoljna vrednost do 6 decimala).
- Statusi: **Prelazi**, **Ne prelazi**, **Manjinska** (čl. 140), **Učestvuje** (čl. 128 st. 2),
  **Zbirno** (stavka tipa „Ostali” — nikad ne učestvuje), **Bez glasova**.
- Indikator „Glasovi van raspodele” — klik prikazuje liste koje ga čine.

## Funkcije

- Unos po glasovima ili po procentima (normalizacija ako zbir ≠ 100%), dugmad ±1 / ±1.000 / ±10.000
- Velika vizuelna raspodela (stacked bar + redovi) sa linijom većine (126), sortabilna tabela
- Većina: da li lista sama ima većinu; hipotetičke grupe (zbir izabranih lista)
- **Šta ako?** — slider za procenat liste (ostale liste: proporcionalno / nepromenjene / iz jedne liste)
- **Prebaci glasove** — apsolutno, procentni poeni ukupnih glasova ili % izvorne liste
- **Pronađi granicu** — minimalan broj glasova za cilj „zbir mandata grupe ≥ N”
  (gruba pretraga + tačne tačke prelaska cenzusa + binarna pretraga do 1 glasa; rezultat se
  verifikuje: v ispunjava, v − 1 ne ispunjava uslov). Obrnuta analiza: ista lista kao cilj i promenljiva.
- **Analiza osetljivosti** — tabela + 3 grafikona (mandati liste, mandati druge liste, zbir grupe),
  označen prelazak cenzusa
- **Monte Carlo** — 1.000 / 10.000 / 100.000 simulacija u Web Worker-u, seed za ponovljivost,
  statistika (prosek, min, maks, std, broj simulacija sa većinom / prelaskom cenzusa), histogram
- **Scenariji** — čuvanje (localStorage), učitavanje, poređenje 2+ scenarija sa razlikama
- **Import/Export** — JSON (scenario + podešavanja + rezultati), CSV (rezultati, D'Hondt obračun),
  PDF (štampa → „Sačuvaj kao PDF”), deljenje linkom (`#scenario=…` — hash se ne šalje serveru)
- **Debug mode** — ukupni brojevi, kvalifikovane liste, 250./251. količnik (tačan razlomak),
  vreme obračuna, validacija
- Validacija: negativni brojevi, prazne vrednosti, NaN, Infinity, decimale u glasovima,
  duplikati ID-jeva, liste bez naziva, zbir procenata, broj mandata. UI nikada ne prikazuje
  `NaN` / `Infinity` / `undefined`.

## Kako rade scenariji

Scenario = naziv + datum + liste + podešavanja + režim unosa. Čuvaju se lokalno u browseru
(localStorage). Poređenje uparuje liste **po nazivu** (bez obzira na velika/mala slova), jer
ID-jevi mogu da se razlikuju između uvezenih scenarija; razlike se računaju u odnosu na prvi
izabrani scenario. Trenutno (nesačuvano) stanje može da učestvuje u poređenju.

## Testovi

```bash
npm test
```

`src/tests/`:
- `dhondt.test.ts` — jedna/dve/više lista, ekstremna raspodela, jednaki količnici (rešeni po
  glasovima i nerešeni po zakonu), tačno 250 mandata, heap = naivni algoritam, kandidati, BigInt
- `threshold.test.ts` — ispod / tačno na / iznad 3%, više lista ispod cenzusa, osnova sa
  nevažećim listićima, podesiv cenzus, čl. 128 st. 2, manjinske liste i bonus od 35%
- `scenarios.test.ts` — **regresija ES tik ispod vs. tik iznad cenzusa**, 2,99% → 3,00%,
  promena jednog glasa, prebacivanje glasova, većina, poređenje, pronađi granicu, osetljivost,
  Monte Carlo, validacija
- `official2023.test.ts` — reprodukcija zvaničnog rezultata 2023.
- `io.test.ts` — JSON/CSV/URL, reducer (unos po procentima, reset, nasumičan scenario), parsiranje

## Kako dodati nova izborna pravila

1. Dodajte podešavanje u `ElectionSettings` (`src/types/election.ts`) i podrazumevanu vrednost
   u `LEGAL_DEFAULTS` (`src/data/rules.ts`), sa citatom izvora u komentaru.
2. Pravila o učešću u raspodeli (pragovi, izuzeci) idu u `applyThreshold()` (`threshold.ts`).
3. Pravila o količnicima (množioci, drugi delioci, npr. Sainte-Laguë) idu u `buildDHondtEntries()`
   (`mandates.ts`) i/ili komparator u `dhondt.ts`.
4. Dodajte kontrolu u `SettingsBar.tsx` i opis u `pages/Methodology.tsx`.
5. Dodajte test u `src/tests/` i, ako je moguće, test na zvaničnom istorijskom rezultatu.
6. `sanitizeSettings()` u `utils/serialization.ts` — da bi import/URL podržali novo polje.
