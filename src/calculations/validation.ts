import type { ElectionSettings, ElectoralList, ValidationIssue } from '../types/election';
import { LIMITS } from '../data/rules';

const isNonNegInt = (v: unknown): v is number =>
  typeof v === 'number' && Number.isSafeInteger(v) && v >= 0;

/** Validira podešavanja simulatora. */
export function validateSettings(s: ElectionSettings): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if (!isNonNegInt(s.seats) || s.seats < 1 || s.seats > LIMITS.maxSeats) {
    issues.push({ level: 'error', code: 'seats', message: `Broj mandata mora biti ceo broj od 1 do ${LIMITS.maxSeats}.` });
  }
  if (typeof s.thresholdPercent !== 'number' || !Number.isFinite(s.thresholdPercent) || s.thresholdPercent < 0 || s.thresholdPercent > 100) {
    issues.push({ level: 'error', code: 'threshold', message: 'Cenzus mora biti broj između 0 i 100%.' });
  }
  if (!isNonNegInt(s.invalidBallots) || s.invalidBallots > LIMITS.maxVotes) {
    issues.push({ level: 'error', code: 'invalid-ballots', message: 'Broj nevažećih listića mora biti nenegativan ceo broj.' });
  }
  if (typeof s.minorityBonusPercent !== 'number' || !Number.isFinite(s.minorityBonusPercent) || s.minorityBonusPercent < 0 || s.minorityBonusPercent > 1000) {
    issues.push({ level: 'error', code: 'bonus', message: 'Manjinski bonus mora biti broj između 0 i 1000%.' });
  }
  if (!isNonNegInt(s.lotSeed)) {
    issues.push({ level: 'error', code: 'seed', message: 'Seed žreba mora biti nenegativan ceo broj.' });
  }
  return issues;
}

/** Validira liste. Greške blokiraju obračun; upozorenja ne. */
export function validateLists(lists: ElectoralList[]): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if (!Array.isArray(lists)) {
    return [{ level: 'error', code: 'lists', message: 'Liste nisu ispravno zadate.' }];
  }
  if (lists.length === 0) {
    issues.push({ level: 'error', code: 'no-lists', message: 'Dodajte bar jednu izbornu listu.' });
  }
  if (lists.length > LIMITS.maxLists) {
    issues.push({ level: 'error', code: 'too-many', message: `Najviše ${LIMITS.maxLists} lista.` });
  }

  const ids = new Set<string>();
  const names = new Map<string, number>();
  let total = 0;

  for (const l of lists) {
    const label = l.name?.trim() ? `"${l.name.trim()}"` : '(bez naziva)';
    if (typeof l.id !== 'string' || !l.id) {
      issues.push({ level: 'error', code: 'id-missing', message: `Lista ${label} nema ID.` });
    } else if (ids.has(l.id)) {
      issues.push({ level: 'error', code: 'id-duplicate', message: `Dupliran ID liste: ${l.id}.`, listId: l.id });
    } else {
      ids.add(l.id);
    }

    if (typeof l.name !== 'string' || !l.name.trim()) {
      issues.push({ level: 'error', code: 'name-empty', message: 'Lista bez naziva — unesite naziv.', listId: l.id });
    } else {
      if (l.name.length > LIMITS.maxNameLength) {
        issues.push({ level: 'error', code: 'name-long', message: `Naziv ${label} je predugačak.`, listId: l.id });
      }
      const key = l.name.trim().toLocaleLowerCase('sr');
      names.set(key, (names.get(key) ?? 0) + 1);
    }

    const v = l.votes as unknown;
    if (v === null || v === undefined || (typeof v === 'string' && v === '')) {
      issues.push({ level: 'error', code: 'votes-empty', message: `Lista ${label}: broj glasova nije unet.`, listId: l.id });
    } else if (typeof v !== 'number' || Number.isNaN(v)) {
      issues.push({ level: 'error', code: 'votes-nan', message: `Lista ${label}: broj glasova nije broj.`, listId: l.id });
    } else if (!Number.isFinite(v)) {
      issues.push({ level: 'error', code: 'votes-inf', message: `Lista ${label}: broj glasova nije konačan.`, listId: l.id });
    } else if (v < 0) {
      issues.push({ level: 'error', code: 'votes-negative', message: `Lista ${label}: broj glasova ne može biti negativan.`, listId: l.id });
    } else if (!Number.isInteger(v)) {
      issues.push({ level: 'error', code: 'votes-fraction', message: `Lista ${label}: broj glasova mora biti ceo broj.`, listId: l.id });
    } else if (v > LIMITS.maxVotes) {
      issues.push({ level: 'error', code: 'votes-large', message: `Lista ${label}: broj glasova je veći od ${LIMITS.maxVotes.toLocaleString('sr-RS')}.`, listId: l.id });
    } else {
      total += v;
    }

    if (l.candidates !== null && l.candidates !== undefined && (!isNonNegInt(l.candidates) || l.candidates > LIMITS.maxSeats)) {
      issues.push({ level: 'error', code: 'candidates', message: `Lista ${label}: broj kandidata mora biti ceo broj ≥ 0.`, listId: l.id });
    }
  }

  for (const [name, count] of names) {
    if (count > 1) {
      issues.push({ level: 'warning', code: 'name-duplicate', message: `Više lista ima isti naziv ("${name}") — poređenje scenarija se oslanja na nazive.` });
    }
  }

  if (lists.length > 0 && total === 0 && !issues.some((i) => i.level === 'error')) {
    issues.push({ level: 'error', code: 'total-zero', message: 'Ukupan broj glasova je 0 — nema šta da se raspodeli.' });
  }
  if (total > LIMITS.maxVotes) {
    issues.push({ level: 'error', code: 'total-large', message: 'Ukupan broj glasova je nerealno veliki.' });
  }
  return issues;
}

/** Validacija procentnog unosa (pre normalizacije). */
export function validatePercentages(values: number[]): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  let sum = 0;
  values.forEach((p) => {
    if (typeof p !== 'number' || !Number.isFinite(p)) {
      issues.push({ level: 'error', code: 'pct-nan', message: 'Procenat mora biti konačan broj.' });
    } else if (p < 0) {
      issues.push({ level: 'error', code: 'pct-negative', message: 'Procenat ne može biti negativan.' });
    } else {
      sum += p;
    }
  });
  if (!issues.length) {
    if (sum === 0) issues.push({ level: 'error', code: 'pct-zero', message: 'Zbir procenata je 0.' });
    else if (Math.abs(sum - 100) > 1e-9) {
      issues.push({ level: 'warning', code: 'pct-sum', message: `Zbir procenata je ${sum.toFixed(2)}% — vrednosti su normalizovane na 100%.` });
    }
  }
  return issues;
}
