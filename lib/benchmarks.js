/**
 * Benchmark problems used to evaluate discovered algorithms.
 *
 * Each benchmark provides input generation, a reference implementation, and
 * an output type so the engine can measure correctness and efficiency.
 */

import { randomInt } from "./util.js";

export class Benchmark {
  constructor({ name, inputVars, generate, reference, outputKind = "num" }) {
    this.name = name;
    this.inputVars = inputVars; // [name, kind]
    this.generate = generate;
    this.reference = reference;
    this.outputKind = outputKind;
  }
}

const BENCHMARKS = {};

function _numEnv(rng, names, lo = -10, hi = 10) {
  const env = {};
  for (const n of names) env[n] = rng() * (hi - lo) + lo;
  return env;
}

function _listEnv(rng, name, size = 6, lo = -10, hi = 10) {
  const lst = [];
  for (let i = 0; i < size; i++) lst.push(rng() * (hi - lo) + lo);
  return { [name]: lst };
}

const _refMaxThree = (env) => Math.max(env.a, env.b, env.c);
const _refMinThree = (env) => Math.min(env.a, env.b, env.c);
const _refMedianThree = (env) => {
  const s = [env.a, env.b, env.c].sort((x, y) => x - y);
  return s[1];
};
const _refClamp = (env) => Math.min(Math.max(env.x, env.lo), env.hi);
const _refAbsDiff = (env) => Math.abs(env.a - env.b);
const _refSign = (env) => (env.x > 0 ? 1 : env.x < 0 ? -1 : 0);
const _refIsEven = (env) => env.n % 2 === 0;
const _refListMax = (env) => (env.lst.length ? Math.max(...env.lst) : 0);
const _refListMin = (env) => (env.lst.length ? Math.min(...env.lst) : 0);
const _refListSum = (env) => env.lst.reduce((s, v) => s + v, 0);
const _refCountPos = (env) => env.lst.filter((v) => v > 0).length;
const _refInRange = (env) => (env.lo <= env.x && env.x <= env.hi) ? 1 : 0;
const _refIsPositive = (env) => (env.x > 0) ? 1 : 0;
const _refIsNegative = (env) => (env.x < 0) ? 1 : 0;
const _refSquare = (env) => env.x * env.x;
const _refCube = (env) => env.x * env.x * env.x;
const _refMajorityThree = (env) => {
  const { a, b, c } = env;
  if (a === b || a === c) return a;
  if (b === c) return b;
  return a;
};

function add(name, vars_, gen, ref, kind = "num") {
  BENCHMARKS[name] = new Benchmark({ name, inputVars: vars_, generate: gen, reference: ref, outputKind: kind });
}

add("max_of_three", [["a", "num"], ["b", "num"], ["c", "num"]], (rng) => _numEnv(rng, ["a", "b", "c"]), _refMaxThree);
add("min_of_three", [["a", "num"], ["b", "num"], ["c", "num"]], (rng) => _numEnv(rng, ["a", "b", "c"]), _refMinThree);
add("median_of_three", [["a", "num"], ["b", "num"], ["c", "num"]], (rng) => _numEnv(rng, ["a", "b", "c"]), _refMedianThree);
add("clamp", [["x", "num"], ["lo", "num"], ["hi", "num"]], (rng) => _numEnv(rng, ["x", "lo", "hi"]), _refClamp);
add("abs_diff", [["a", "num"], ["b", "num"]], (rng) => _numEnv(rng, ["a", "b"]), _refAbsDiff);
add("sign", [["x", "num"]], (rng) => _numEnv(rng, ["x"]), _refSign);
add("is_even", [["n", "num"]], (rng) => ({ n: randomInt(rng, 0, 20) }), _refIsEven);
add("list_max", [["lst", "list"]], (rng) => _listEnv(rng, "lst"), _refListMax);
add("list_min", [["lst", "list"]], (rng) => _listEnv(rng, "lst"), _refListMin);
add("list_sum", [["lst", "list"]], (rng) => _listEnv(rng, "lst"), _refListSum);
add("count_positives", [["lst", "list"]], (rng) => _listEnv(rng, "lst"), _refCountPos);

add("in_range", [["x", "num"], ["lo", "num"], ["hi", "num"]], (rng) => {
  const lo = rng() * 10 - 10;
  const hi = lo + rng() * 10 + 1;
  const x = lo - 5 + rng() * (hi - lo + 10);
  return { x, lo, hi };
}, _refInRange);
add("is_positive", [["x", "num"]], (rng) => _numEnv(rng, ["x"], -10, 10), _refIsPositive);
add("is_negative", [["x", "num"]], (rng) => _numEnv(rng, ["x"], -10, 10), _refIsNegative);
add("square", [["x", "num"]], (rng) => _numEnv(rng, ["x"], -5, 5), _refSquare);
add("cube", [["x", "num"]], (rng) => _numEnv(rng, ["x"], -5, 5), _refCube);
add("majority_of_three", [["a", "num"], ["b", "num"], ["c", "num"]], (rng) =>
  _numEnv(rng, ["a", "b", "c"], 0, 3), _refMajorityThree);

export function getBenchmark(name) {
  return BENCHMARKS[name];
}

export function listBenchmarks() {
  return Object.keys(BENCHMARKS).sort();
}

export { BENCHMARKS };
