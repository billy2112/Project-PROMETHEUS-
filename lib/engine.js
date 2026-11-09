/**
 * Research engine: orchestrates generate -> evaluate -> experiment -> preserve
 * -> combine over many generations.
 *
 * Loop per generation:
 *  1. Generate a population (random + mutations of best-so-far + crossovers).
 *  2. Evaluate each candidate (correctness vs reference + op-count efficiency).
 *  3. Run a controlled head-to-head experiment vs the current control.
 *  4. Preserve fully-correct (>=99%) candidates that beat the control as
 *     discoveries; they become the new control.
 *  5. Combine top discoveries via subtree crossover to breed new candidates.
 *
 * Fitness drives the search: correctness is primary (0..1), op-count is the
 * tiebreaker (lower is better).  This lets the engine hill-climb through
 * partially-correct programs toward a full discovery.
 */

import { Archive, Discovery } from "./archive.js";
import { getBenchmark } from "./benchmarks.js";
import { crossover } from "./combiner.js";
import { runExperiment } from "./experiment.js";
import { Generator } from "./generator.js";
import { Algorithm } from "./ir.js";

export class GenerationStats {
  constructor({ generation, benchmark, candidatesTested, discoveries, bestOps, bestCorrectness, elapsedMs }) {
    this.generation = generation;
    this.benchmark = benchmark;
    this.candidatesTested = candidatesTested;
    this.discoveries = discoveries;
    this.bestOps = bestOps;
    this.bestCorrectness = bestCorrectness;
    this.elapsedMs = elapsedMs;
  }
}

/** A scored candidate kept in the evolving population. */
class ScoredCandidate {
  constructor(alg, correctness, ops) {
    this.alg = alg;
    this.correctness = correctness;
    this.ops = ops;
  }
  /** Higher correctness first, then lower ops. */
  static better(a, b) {
    if (a.correctness !== b.correctness) return a.correctness > b.correctness;
    return a.ops < b.ops;
  }
}

/**
 * The AI research engine.
 */
export class ResearchEngine {
  constructor({ seed = 0, archivePath } = {}) {
    const rng = makeRNG(seed);
    this.rng = rng;
    this.archive = new Archive({ path: archivePath });
    this.generator = new Generator({ rng });
    this.generation = 0;
    this.stats = [];
    // bestSoFar[benchmark] = ScoredCandidate (hill-climb seed)
    this.bestSoFar = new Map();
    // population[benchmark] = ScoredCandidate[]
    this.population = new Map();
  }

  runGeneration(benchmarkName, { population = 120, nCases = 200, elite = 8 } = {}) {
    const start = Date.now();
    const benchmark = getBenchmark(benchmarkName);
    const inputVars = benchmark.inputVars.map(([name]) => name);
    let control = this.archive.getBest(benchmarkName);
    let discoveries = 0;
    let bestOps = null;
    let bestCorrectness = 0;

    const prev = this.population.get(benchmarkName) || [];
    const seedState = this.bestSoFar.get(benchmarkName);

    const nRandom = Math.max(1, Math.floor(population * 0.4));
    const nMutate = Math.max(1, Math.floor(population * 0.4));
    const nCombo = population - nRandom - nMutate;

    /** Build one candidate and score it. */
    const makeAndScore = (kind) => {
      this.generation += 1;
      let root;
      if (kind === "random") {
        root = this.generator.generate(inputVars);
      } else if (kind === "mutate" && seedState) {
        root = this.generator.mutate(seedState.alg.root, inputVars, 0.35);
      } else if (kind === "combo" && prev.length >= 2) {
        const [pa, pb] = pickTwo(this.rng, prev);
        const combo = crossover(pa.alg, pb.alg, this.rng);
        root = combo ? combo.root : this.generator.generate(inputVars);
      } else {
        root = this.generator.generate(inputVars);
      }
      const alg = new Algorithm(root, benchmarkName, this.generation);
      const result = runExperiment(alg, benchmark, this.rng, { control, nCases });
      return new ScoredCandidate(alg, result.candidateCorrectness, result.candidateOps);
    };

    const scored = [];
    for (let i = 0; i < nRandom; i++) scored.push(makeAndScore("random"));
    for (let i = 0; i < nMutate; i++) scored.push(makeAndScore("mutate"));
    for (let i = 0; i < nCombo; i++) scored.push(makeAndScore("combo"));

    // Evaluate controlled experiments & preserve discoveries
    for (const sc of scored) {
      const result = runExperiment(sc.alg, benchmark, this.rng, { control, nCases });
      if (
        result.candidateCorrectness > bestCorrectness ||
        (result.candidateCorrectness === bestCorrectness &&
          (bestOps === null || result.candidateOps < bestOps))
      ) {
        bestCorrectness = result.candidateCorrectness;
        bestOps = result.candidateOps;
        this.bestSoFar.set(benchmarkName, new ScoredCandidate(sc.alg, result.candidateCorrectness, result.candidateOps));
      }

      if (result.improved) {
        const disc = new Discovery({
          benchmark: benchmarkName,
          generation: this.generation,
          correctness: result.candidateCorrectness,
          ops: result.candidateOps,
          code: sc.alg.toCode(),
          algorithm: sc.alg,
        });
        if (this.archive.add(disc)) {
          discoveries += 1;
          control = this.archive.getBest(benchmarkName);
          this.bestSoFar.set(benchmarkName, new ScoredCandidate(sc.alg, result.candidateCorrectness, result.candidateOps));
        }
      }
    }

    // Elitism: keep top candidates as next-gen seed population
    scored.sort((a, b) => (ScoredableBetter(a, b) ? -1 : 1));
    const keep = scored.slice(0, Math.min(elite, scored.length));
    this.population.set(benchmarkName, keep);

    const elapsedMs = Date.now() - start;
    const stats = new GenerationStats({
      generation: this.generation,
      benchmark: benchmarkName,
      candidatesTested: population,
      discoveries,
      bestOps,
      bestCorrectness,
      elapsedMs,
    });
    this.stats.push(stats);
    return stats;
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
function pickTwo(rng, arr) {
  const i = Math.floor(rng() * arr.length);
  let j = Math.floor(rng() * (arr.length - 1));
  if (j >= i) j += 1;
  return [arr[i], arr[j]];
}

/** Lexicographic better: correctness desc, ops asc. */
function ScoredableBetter(a, b) {
  if (a.correctness !== b.correctness) return a.correctness > b.correctness;
  return a.ops < b.ops;
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
