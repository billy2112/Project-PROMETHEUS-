/**
 * Controlled experiments comparing a candidate against a control.
 *
 * A discovery counts as an improvement only when it is correct (>=99% of
 * cases match the reference) AND strictly more efficient (fewer executed
 * primitive operations) than the current control for that benchmark.
 */

import { evaluateOnBenchmark } from "./evaluator.js";

export class ExperimentResult {
  constructor({ benchmark, candidateCorrectness, candidateOps, controlCorrectness, controlOps, improved }) {
    this.benchmark = benchmark;
    this.candidateCorrectness = candidateCorrectness;
    this.candidateOps = candidateOps;
    this.controlCorrectness = controlCorrectness;
    this.controlOps = controlOps;
    this.improved = improved;
  }
}

/**
 * Run a head-to-head trial of candidate vs control.
 * Returns an ExperimentResult.
 */
export function runExperiment(candidate, benchmark, rng, { control, nCases = 200 } = {}) {
  const [cCorrect, cOps] = evaluateOnBenchmark(candidate, benchmark, rng, nCases);
  let ctrlCorrect, ctrlOps;
  if (!control) {
    ctrlCorrect = 0;
    ctrlOps = Infinity;
  } else {
    [ctrlCorrect, ctrlOps] = evaluateOnBenchmark(control, benchmark, rng, nCases);
  }
  const improved = cCorrect >= 0.99 && cOps < ctrlOps;
  return new ExperimentResult({
    benchmark: benchmark.name,
    candidateCorrectness: cCorrect,
    candidateOps: cOps,
    controlCorrectness: ctrlCorrect,
    controlOps: ctrlOps,
    improved,
  });
}
