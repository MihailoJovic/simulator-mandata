/// <reference lib="webworker" />
import { runMonteCarloSimulation, type MCParams } from '../calculations/monteCarlo';

/** Monte Carlo se izvršava u Web Worker-u da UI ostane responzivan (100.000 simulacija). */
self.onmessage = (e: MessageEvent<MCParams>) => {
  try {
    const result = runMonteCarloSimulation(e.data, (done) => self.postMessage({ type: 'progress', done }));
    self.postMessage({ type: 'done', result });
  } catch (err) {
    self.postMessage({ type: 'error', message: err instanceof Error ? err.message : String(err) });
  }
};
