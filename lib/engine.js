/**
 * Research engine: orchestrates generate -> evaluate -> experiment -> preserve
 * -> combine over many generations.
 *
 * Loop per generation:
 *  1. Generate new algorithm candidates (random + mutation of best-so-far).
 *  2. Evaluate each candidate against a benchmark (correctness + ops).
 *  3. Run a controlled experiment vs the current control.
 *  4. Preserve improvements as discoveries (new control).
 *  5. Combine existing discoveries via crossover to spawn new candidates.
 */

import { Archive, Discovery } from "./archive.js";
import { getBenchmark } from "./benchmarks.js";
import { crossover } from "./combiner.js";
import { runExperiment } from "./experiment.js";
import { Generator } from "./generator.js";
import { Algorithm } from "./ir.js";

export class GenerationStats {
  constructor({ generation, benchmark, candidatesTested, discoveries, bestOps, bestCorrectness }) {
    this.generation = generation;
    this.benchmark = benchmark;
    this.candidatesTested = candidatesTested;
    this.discoveries = discoveries;
    this.bestOps = bestOps;
    this.bestCorrectness = bestCorrectness;
  }
}

/**
 * The AI research engine.
 *
 * Maintains a per-benchmark "best-so-far" (highest correctness, then lowest
 * ops) and hill-climbs it by mutation each generation, while running
 * controlled head-to-head experiments against the archived control.  Only a
 * fully-correct (>=99%) candidate that is strictly more efficient than the
 * control is preserved as a discovery.
 */
export class ResearchEngine {
  constructor({ seed = 0, archivePath } = {}) {
    const rng = makeRNG(seed);
    this.rng = rng;
    this.archive = new Archive({ path: archivePath });
    this.generator = new Generator({ rng });
    this.generation = 0;
    this.stats = [];
    // bestSoFar[benchmark] = { algorithm, correctness, ops }
    this.bestSoFar = new Map();
  }

  runGeneration(benchmarkName, { population = 60, nCases = 200 } = {}) {
    const benchmark = getBenchmark(benchmarkName);
    const inputVars = benchmark.inputVars.map(([name]) => name);
    let control = this.archive.getBest(benchmarkName);
    let discoveries = 0;
    let bestOps = null;
    let bestCorrectness = 0;
    const state = this.bestSoFar.get(benchmarkName);

    const nMutate = Math.max(1, Math.floor(population * 0.5));

    for (let i = 0; i < population; i++) {
      this.generation += 1;
      let root;
      if (i < nMutate && state) {
        root = this.generator.mutate(state.algorithm.root, inputVars, 0.4);
      } else {
        root = this.generator.generate(inputVars);
      }
      const alg = new Algorithm(root, benchmarkName, this.generation);
      const result = runExperiment(alg, benchmark, this.rng, { control, nCases });

      // Track best-so-far for hill-climbing (partial credit)
      if (
        result.candidateCorrectness > bestCorrectness ||
        (result.candidateCorrectness === bestCorrectness &&
          (bestOps === null || result.candidateOps < bestOps))
      ) {
        bestCorrectness = result.candidateCorrectness;
        bestOps = result.candidateOps;
        this.bestSoFar.set(benchmarkName, {
          algorithm: alg,
          correctness: result.candidateCorrectness,
          ops: result.candidateOps,
        });
      }

      if (result.improved) {
        const disc = new Discovery({
          benchmark: benchmarkName,
          generation: this.generation,
          correctness: result.candidateCorrectness,
          ops: result.candidateOps,
          code: alg.toCode(),
          algorithm: alg,
        });
        if (this.archive.add(disc)) {
          discoveries += 1;
          control = this.archive.getBest(benchmarkName);
          // A fully-correct control becomes the new hill-climb seed.
          this.bestSoFar.set(benchmarkName, {
            algorithm: alg,
            correctness: result.candidateCorrectness,
            ops: result.candidateOps,
          });
        }
      }
    }

    this._combinePhase(benchmarkName, Math.max(1, Math.floor(population / 4)), inputVars, nCases);

    const stats = new GenerationStats({
      generation: this.generation,
      benchmark: benchmarkName,
      candidatesTested: population,
      discoveries,
      bestOps,
      bestCorrectness,
    });
    this.stats.push(stats);
    return stats;
  }

  _combinePhase(benchmarkName, nCombos, inputVars, nCases) {
    const lst = this.archive.discoveries[benchmarkName];
    if (!lst || lst.length < 2) return;
    const benchmark = getBenchmark(benchmarkName);
    let control = this.archive.getBest(benchmarkName);
    for (let i = 0; i < nCombos; i++) {
      const [pa, pb] = sample2(this.rng, lst);
      const combo = crossover(pa.algorithm, pb.algorithm, this.rng);
      if (!combo) continue;
      this.generation += 1;
      combo.generation = this.generation;
      combo.benchmark = benchmarkName;
      const result = runExperiment(combo, benchmark, this.rng, { control, nCases });
      if (result.improved) {
        const disc = new Discovery({
          benchmark: benchmarkName,
          generation: this.generation,
          correctness: result.candidateCorrectness,
          ops: result.candidateOps,
          code: combo.toCode(),
          algorithm: combo,
        });
        if (this.archive.add(disc)) control = this.archive.getBest(benchmarkName);
      }
    }
  }

  run(benchmarkName, { generations = 10, ...rest } = {}) {
    const out = [];
    for (let i = 0; i < generations; i++) out.push(this.runGeneration(benchmarkName, rest));
    return out;
  }

  discoveriesFor(benchmarkName) {
    const lst = this.archive.discoveries[benchmarkName];
    return lst ? lst.slice() : [];
  }

  bestFor(benchmarkName) {
    return this.archive.getBest(benchmarkName) || null;
  }

}

/** Pick two distinct elements from arr. */
function sample2(rng, arr) {
  const i = Math.floor(rng() * arr.length);
  let j = Math.floor(rng() * (arr.length - 1));
  if (j >= i) j += 1;
  return [arr[i], arr[j]];
}

/** Seeded PRNG (xorshift) returning [0,1). */
function makeRNG(seed) {
  let s = seed >>> 0;
  if (s === 0) s = 0x1234567;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return (s >>> 0) / 0xffffffff;
  };
}
