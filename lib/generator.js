/**
 * Generation and mutation of algorithm candidates.
 *
 * Mutation operators:
 *  - replace : swap a random subtree for a fresh random tree
 *  - tweak   : change an op (Call), a literal/var (Leaf), or flip an If branch
 *  - insert  : wrap a random subtree inside a new unary/binary op or If
 *  - delete  : replace a random subtree with one of its children or a leaf
 */

import { ALL_OPS, ARITY, Algorithm, Call, If, Lit, Node, Var } from "./ir.js";
import { choice } from "./util.js";

const MUTATION_OPS = ["replace", "tweak", "insert", "delete"];

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

  /**
   * Apply one random mutation operator to ``root``.
   */
  mutate(root, inputVars, mutationRate = 0.3) {
    if (this.rng() < mutationRate) {
      const op = choice(this.rng, MUTATION_OPS);
      return this._apply(root, inputVars, op, 0);
    }
    return this._recurse(root, inputVars, mutationRate);
  }

  _apply(root, inputVars, op, depth) {
    if (op === "replace") return this.generate(inputVars, 0);
    if (op === "tweak") return this._tweak(root, inputVars);
    if (op === "insert") return this._insert(root, inputVars, depth);
    if (op === "delete") return this._delete(root, inputVars);
    return root;
  }

  _recurse(n, inputVars, rate) {
    if (n instanceof Call) {
      return new Call(
        n.op,
        n.args.map((a) => this._recurse(a, inputVars, rate)),
      );
    }
    if (n instanceof If) {
      return new If(
        this._recurse(n.cond, inputVars, rate),
        this._recurse(n.then, inputVars, rate),
        this._recurse(n.else_, inputVars, rate),
      );
    }
    return n;
  }

  _tweak(n, inputVars) {
    if (n instanceof Call) {
      const ops = Object.keys(ALL_OPS).filter((o) => o !== n.op);
      return new Call(choice(this.rng, ops), n.args);
    }
    if (n instanceof If) {
      const branches = [n.then, n.else_];
      const idx = Math.floor(this.rng() * 2);
      return new If(n.cond, branches[idx], branches[idx === 0 ? 1 : 0]);
    }
    if (n instanceof Lit) return this._leaf(inputVars);
    if (n instanceof Var) return this._leaf(inputVars);
    return n;
  }

  _insert(n, inputVars, depth) {
    const op = choice(this.rng, Object.keys(ALL_OPS));
    const arity = ARITY[op] || 2;
    if (depth >= this.maxDepth || arity === 1) {
      const arg = this.generate(inputVars, depth + 1);
      return new Call(op, [arg]);
    }
    const args = Array.from({ length: arity }, () =>
      this.generate(inputVars, depth + 1),
    );
    args.splice(Math.floor(this.rng() * (arity + 1)), 0, n);
    return new Call(op, args);
  }

  _delete(n, inputVars) {
    if (n instanceof Call && n.args.length > 0) {
      return choice(this.rng, n.args);
    }
    if (n instanceof If) {
      return choice(this.rng, [n.then, n.else_]);
    }
    return this._leaf(inputVars);
  }
}
