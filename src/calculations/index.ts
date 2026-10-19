/**
 * Izborni matematički engine — potpuno nezavisan od UI-ja.
 * Sve funkcije su čiste i deterministične.
 */
export { calculatePercentages, applyThreshold, passesThreshold, minVotesForThreshold, totalValidVotes, thresholdBaseVotes } from './threshold';
export { calculateDHondt, calculateDHondtNaive, type DHondtEntry, type DHondtOptions } from './dhondt';
export { calculateMandates, quickSeats, buildDHondtEntries } from './mandates';
export { calculateMajority, type MajorityResult } from './majority';
export { compareScenarios, normalizeName, type ComparisonResult, type ScenarioInput } from './scenarios';
export {
  transferVotes,
  setListVotes,
  setListShare,
  percentagesToVotes,
  apportionLargestRemainder,
  type Adjustment,
  type TransferUnit,
} from './voteOps';
export { findThreshold, runSensitivityAnalysis, MAX_SENSITIVITY_ROWS, type SeatGoal, type SensitivityRow, type FindThresholdResult } from './analysis';
export { runMonteCarloSimulation, validateMCParams, type MCParams, type MCResult, type MCRange, type MCGroup } from './monteCarlo';
export { validateLists, validateSettings, validatePercentages } from './validation';
