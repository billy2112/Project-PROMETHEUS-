# Project PROMETHEUS — An AI That Invents Its Own Algorithms

PROMETHEUS is an AI research engine that *discovers* algorithms rather than
simply applying algorithms humans have written.  It closes the full
research loop:

1. **Generate** completely new algorithm candidates (random expression trees
   and mutation of existing ones).
2. **Evaluate** each candidate mathematically/computationally against a
   benchmark (correctness vs a reference implementation, plus executed
   primitive-operation count as an efficiency measure).
3. **Experiment** with controlled head-to-head trials of every candidate
   against the current best-known control.
4. **Discover** more efficient approaches: a candidate becomes a discovery
   only when it is correct (>=99% of cases) and strictly faster than the
   control.
5. **Preserve** successful discoveries in an archive (optionally persisted
   to disk), keeping the best-known algorithm per benchmark as the control.
6. **Combine** previous discoveries via subtree crossover to breed new
   candidate algorithms that inherit structure from multiple successes.

## Layout

```
lib/
  ir.js          # algorithm intermediate representation (expression trees)
  generator.js   # random candidate generation + mutation
  evaluator.js   # deterministic interpreter + correctness/efficiency metrics
  benchmarks.js  # benchmark problems with reference implementations
  experiment.js  # controlled candidate-vs-control trials
  archive.js     # preserved-discovery library (control per benchmark)
  combiner.js    # subtree crossover of discoveries
  engine.js      # research loop orchestrator
bin/prometheus   # command-line interface
```

## Quick start

```bash
npm install
node bin/prometheus list-benchmarks
node bin/prometheus run max_of_three --generations 20 --population 200 --archive discoveries.json
node bin/prometheus discoveries max_of_three --archive discoveries.json
```

Each benchmark is a function-discovery problem (e.g. `max_of_three`,
`clamp`, `list_max`, `count_positives`).  The engine searches the space of
expression trees over arithmetic, comparison, boolean, and list primitives,
measures correctness against a reference, and preserves only algorithms that
are both correct and more efficient than the incumbent.
