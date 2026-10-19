import type { ElectionSettings, ElectoralList } from '../types/election';
import { LEGAL_DEFAULTS } from '../data/rules';

export const S = (over: Partial<ElectionSettings> = {}): ElectionSettings => ({ ...LEGAL_DEFAULTS, ...over });

export function L(name: string, votes: number, over: Partial<ElectoralList> = {}): ElectoralList {
  return {
    id: over.id ?? name.toLowerCase().replace(/\s+/g, '_'),
    name,
    votes,
    isMinority: false,
    isAggregate: false,
    color: '#444444',
    candidates: null,
    ...over,
  };
}

export const sumSeats = (r: Record<string, number>) => Object.values(r).reduce((a, b) => a + b, 0);
