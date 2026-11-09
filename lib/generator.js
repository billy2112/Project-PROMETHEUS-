/**
 * Generation and mutation of algorithm candidates.
 */

import { ALL_OPS, ARITY, Algorithm, Call, If, Lit, Node, Var } from "./ir.js";
import { choice } from "./util.js";

/**
 * Produces random expression-tree algorithms and mutates existing ones.
 */
export class Generator {
  constructor({ rng, maxDepth = 6 } = {}) {
    this.rng = rng || (() => Math.random());
    this.maxDepth = maxDepth;
  }

  generate(inputVars, depth = 0) {
    if (depth >= this.maxDepth || this.rng() < 0.3) return this._leaf(inputVars);
    const kind = choice(this.rng, ["call", "if", "leaf"]);
    if (kind === "leaf") return this._leaf(inputVars);
    if (kind === "if") {
      return new If(
        this.generate(inputVars, depth + 1),
        this.generate(inputVars, depth + 1),
        this.generate(inputVars, depth + 1),
      );
    }
    const op = choice(this.rng, Object.keys(ALL_OPS));
    const arity = ARITY[op] || 2;
    const args = Array.from({ length: arity }, () => this.generate(inputVars, depth + 1));
    return new Call(op, args);
  }

  _leaf(inputVars) {
    if (this.rng() < 0.6 && inputVars.length) {
      return new Var(choice(this.rng, inputVars));
    }
    return new Lit(choice(this.rng, [0, 1, 2, 10, -1, -10, 0.5]));
  }

  mutate(root, inputVars, mutationRate = 0.3) {
    return this._mutateNode(root, inputVars, mutationRate);
  }

  _mutateNode(n, inputVars, rate) {
    if (this.rng() < rate) return this.generate(inputVars, 0);
    if (n instanceof Call) {
      return new Call(n.op, n.args.map((a) => this._mutateNode(a, inputVars, rate)));
    }
    if (n instanceof If) {
      return new If(
        this._mutateNode(n.cond, inputVars, rate),
        this._mutateNode(n.then, inputVars, rate),
        this._mutateNode(n.else_, inputVars, rate),
      );
    }
    return n;
  }
}
