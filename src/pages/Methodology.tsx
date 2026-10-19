import { LEGAL_SOURCE } from '../data/rules';

export function Methodology() {
  return (
    <div className="space-y-4 text-sm leading-relaxed">
      <p className="rounded-md border-2 border-slate-800 px-3 py-2 font-medium dark:border-slate-200">
        Simulator prikazuje matematičke posledice unetih podataka. Rezultati zavise isključivo od pretpostavki korisnika. Ovo nije prognoza izbora.
      </p>

      <ol className="list-decimal space-y-2 pl-5">
        <li>
          <strong>Izračunava procenat svake liste</strong>: glasovi ÷ ukupan broj važećih glasova × 100. Procenat služi samo za prikaz — obračun koristi apsolutne (cele) brojeve glasova.
        </li>
        <li>
          <strong>Primenjuje izborni prag</strong> (čl. 128): lista učestvuje u raspodeli ako ima najmanje 3% glasova <em>od broja birača koji su glasali</em> (važeći + nevažeći listići). Provera je tačna, celobrojna: glasovi × 100 ≥ 3 × broj birača koji su glasali — lista sa tačno 3,000% prelazi cenzus.
        </li>
        <li>
          <strong>Izbacuje liste koje ne učestvuju u raspodeli</strong>. Izuzeci: lista nacionalne manjine učestvuje i ispod 3% (čl. 140 st. 1); ako nijedna lista nije prešla 3%, sve liste sa glasovima učestvuju (čl. 128 st. 2).
        </li>
        <li>
          <strong>Za kvalifikovane liste generiše D'Hondt količnike</strong>: glasovi ÷ 1, ÷ 2, … ÷ 250 (čl. 129). Količnici manjinskih lista koje su dobile manje od 3% uvećavaju se za 35% (čl. 140 st. 2).
        </li>
        <li>
          <strong>Sortira količnike</strong> od najvećeg ka najmanjem. Poređenje je tačno (racionalni brojevi, bez zaokruživanja). Ako su dva količnika jednaka, prednost ima lista sa većim brojem glasova (čl. 129 st. 3).
        </li>
        <li>
          <strong>Dodeljuje 250 mandata</strong> — svaki od 250 najvećih količnika donosi jedan mandat. Ako lista ima manje kandidata od osvojenih mandata, višak ide sledećem najvećem količniku (čl. 129 st. 4; opciono polje „Kandidata”).
        </li>
        <li>
          <strong>Sabira mandate po listama.</strong>
        </li>
        <li>
          <strong>Prikazuje rezultate</strong>, uključujući 250. (poslednji osvojeni) i 251. (prvi neizabrani) količnik.
        </li>
      </ol>

      <h3 className="pt-2 font-semibold">Jednaki količnici (tie-breaking)</h3>
      <p>
        Zakon propisuje da kod jednakih količnika prednost ima lista sa više glasova. Zakon <strong>ne propisuje</strong> šta se dešava ako su i količnici i broj glasova potpuno jednaki. U tom (veoma retkom) slučaju simulator primenjuje
        pomoćno pravilo koje birate u naprednim podešavanjima (redosled unosa ili simulirani žreb) i rezultat <strong>jasno označava kao „NEREŠENO PO ZAKONU”</strong>.
      </p>

      <h3 className="pt-2 font-semibold">Šta simulator ne radi</h3>
      <ul className="list-disc space-y-1 pl-5">
        <li>Ne predviđa izborne rezultate i ne koristi nikakve ankete.</li>
        <li>Ne utvrđuje da li je lista manjinska — u stvarnosti to odlučuje RIK (čl. 139); u simulatoru to bira korisnik.</li>
        <li>Ne šalje podatke na server — sve se računa u vašem browseru.</li>
      </ul>

      <h3 className="pt-2 font-semibold">Izvori pravila</h3>
      <p>
        {LEGAL_SOURCE.law}, {LEGAL_SOURCE.gazette} — čl. 128, 129 i 140. Provereno: {LEGAL_SOURCE.checkedOn}
      </p>
      <ul className="list-disc space-y-1 pl-5">
        {LEGAL_SOURCE.urls.map((u) => (
          <li key={u.url}>
            <a className="underline underline-offset-2" href={u.url} target="_blank" rel="noreferrer noopener">
              {u.label}
            </a>
          </li>
        ))}
      </ul>
      <p className="text-xs text-slate-500">
        Provera tačnosti: simulator tačno reprodukuje zvaničnu raspodelu mandata sa izbora 17.12.2023. (ukupan izveštaj RIK-a od 12.01.2024; 18 lista, uključujući 5 manjinskih) — vidi automatski test <code>src/tests/official2023.test.ts</code>.
      </p>
    </div>
  );
}
