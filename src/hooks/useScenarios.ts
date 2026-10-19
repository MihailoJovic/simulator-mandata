import { useEffect, useState } from 'react';
import type { Scenario } from '../types/election';
import { loadJSON, saveJSON, STORAGE_KEYS } from '../utils/storage';

/** Sačuvani scenariji (lokalno, localStorage). */
export function useScenarios() {
  const [scenarios, setScenarios] = useState<Scenario[]>(() => {
    const s = loadJSON<Scenario[]>(STORAGE_KEYS.scenarios, []);
    return Array.isArray(s) ? s : [];
  });

  useEffect(() => saveJSON(STORAGE_KEYS.scenarios, scenarios), [scenarios]);

  return {
    scenarios,
    save: (sc: Scenario) => setScenarios((prev) => [...prev, sc]),
    remove: (id: string) => setScenarios((prev) => prev.filter((s) => s.id !== id)),
    rename: (id: string, name: string) => setScenarios((prev) => prev.map((s) => (s.id === id ? { ...s, name } : s))),
  };
}
