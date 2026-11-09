/**
 * Deterministic interpreter + evaluator for algorithm candidates.
 */

import { ALL_OPS, Call, If, Lit, Node, Var } from "./ir.js";

/**
 * Interpret ``root`` under ``env``.
 * Returns [value, opCount]. Unknown variables evaluate to 0; division/modulo
 * by zero are guarded.
 */
export function evaluate(root, env) {
  const _eval = (n) => {
    if (n instanceof Lit) return [n.value, 1];
    if (n instanceof Var) return [env[n.name] !== undefined ? env[n.name] : 0, 1];
    if (n instanceof Call) {
      const argsVals = [];
      let cost = 1;
      for (const a of n.args) {
        const [v, c] = _eval(a);
        argsVals.push(v);
        cost += c;
      }
      const fn = ALL_OPS[n.op];
      if (!fn) return [0, cost];
      try {
        return [fn(...argsVals), cost + 1];
      } catch {
        return [0, cost + 1];
      }
    }
    if (n instanceof If) {
      const [cv, cc] = _eval(n.cond);
      let cost = 1 + cc;
      if (Boolean(cv)) {
        const [tv, tc] = _eval(n.then);
        return [tv, cost + tc];
      }
      const [fv, fc] = _eval(n.else_);
      return [fv, cost + fc];
    }
    return [0, 1];
  };

  return _eval(root);
}

/**
 * Run alg against benchmark on nCases random inputs.
 * Returns [correctnessRate, meanOpCount].
 */
export function evaluateOnBenchmark(alg, benchmark, rng, nCases = 200) {
  let correct = 0;
  let totalOps = 0;
  for (let i = 0; i < nCases; i++) {
    const env = benchmark.generate(rng);
    const expected = benchmark.reference(env);
    const [got, ops] = evaluate(alg.root, env);
    totalOps += ops;
    if (match(got, expected)) correct += 1;
  }
  return [correct / nCases, totalOps / nCases];
}

function match(got, expected) {
  try {
    if (got == expected) return true;
    return Math.abs(Number(got) - Number(expected)) < 1e-6;
  } catch {
    return Boolean(got) === Boolean(expected);
  }
}
