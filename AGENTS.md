# AGENTS.md — Project PROMETHEUS

## Purpose
Project PROMETHEUS is an AI research engine that *discovers* algorithms rather than
simply applying algorithms humans have written. It closes the full research loop:
generate → evaluate → controlled experiment → preserve → combine.

## Layout
```
bin/prometheus          # CLI entry point
lib/ir.js               # algorithm intermediate representation (expression trees)
lib/generator.js        # random generation + 4 mutation operators (replace, tweak, insert, delete)
lib/evaluator.js        # deterministic interpreter; correctness + op-count efficiency
lib/benchmarks.js       # benchmark problems with reference implementations
lib/experiment.js       # controlled candidate-vs-control trials
lib/archive.js          # discovery archive (per-benchmark best control, disk persistence)
lib/combiner.js         # subtree crossover of discoveries
lib/engine.js           # research loop orchestrator (fitness-driven evolution + elitism)
lib/util.js             # shared RNG / sampling helpers
test/run.mjs            # test suite (node test/run.mjs)
```

## Commands
- `node test/run.mjs` — run the test suite
- `node bin/prometheus list-benchmarks` — list available benchmarks
- `node bin/prometheus run <benchmark> --generations N --population P --archive <file>` — run the research loop
- `node bin/prometheus discoveries <benchmark> --archive <file>` — show preserved discoveries

## How it works
1. **Generate**: random expression trees over arithmetic/comparison/boolean/list primitives, plus mutations of the best-so-far candidate.
2. **Evaluate**: deterministic interpreter (never `eval`) measures correctness vs a reference implementation and executed primitive-op count.
3. **Experiment**: every candidate runs a controlled head-to-head trial against the current control.
4. **Discover**: a candidate is preserved only when correctness ≥ 99% AND it is strictly more efficient (fewer ops) than the control; it becomes the new control.
5. **Preserve**: discoveries are archived to disk (JSON) and survive across runs.
6. **Combine**: subtree crossover between two discoveries breeds new candidates.

## Storage discipline
Write code, run tests locally, then `git push origin main` immediately. Do not leave large artifacts in the workspace.

## Benchmarks
abs_diff, clamp, count_positives, cube, in_range, is_even, is_negative, is_positive,
list_max, list_min, list_sum, majority_of_three, max_of_three, median_of_three,
min_of_three, sign, square.
