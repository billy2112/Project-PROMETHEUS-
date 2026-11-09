/**
 * Intermediate representation for discovered algorithms.
 *
 * Algorithms are expression trees over a small, safe set of primitives.
 * Trees are interpreted (never eval'd) so every candidate can be evaluated
 * deterministically and its operation count measured for efficiency.
 */

const NUM_OPS = {
  add: (a, b) => a + b,
  sub: (a, b) => a - b,
  mul: (a, b) => a * b,
  div: (a, b) => (b !== 0 ? a / b : Infinity),
  mod: (a, b) => (b !== 0 ? a % b : 0),
  neg: (a) => -a,
  abs: (a) => Math.abs(a),
};

const CMP_OPS = {
  lt: (a, b) => a < b,
  le: (a, b) => a <= b,
  gt: (a, b) => a > b,
  ge: (a, b) => a >= b,
  eq: (a, b) => a == b,
  ne: (a, b) => a != b,
};

const BOOL_OPS = {
  and: (a, b) => Boolean(a && b),
  or: (a, b) => Boolean(a || b),
  not: (a) => !Boolean(a),
};

const LIST_OPS = {
  len: (lst) => (Array.isArray(lst) ? lst.length : 0),
  get: (lst, i) => {
    if (!Array.isArray(lst) || lst.length === 0) return 0;
    const idx = Math.max(0, Math.min(Number(i) || 0, lst.length - 1));
    return lst[idx];
  },
  min: (lst) => (Array.isArray(lst) && lst.length ? Math.min(...lst) : 0),
  max: (lst) => (Array.isArray(lst) && lst.length ? Math.max(...lst) : 0),
  sum: (lst) => (Array.isArray(lst) ? lst.reduce((s, v) => s + v, 0) : 0),
};

const ALL_OPS = { ...NUM_OPS, ...CMP_OPS, ...BOOL_OPS, ...LIST_OPS };
const UNARY_OPS = new Set(["neg", "abs", "not", "len", "min", "max", "sum"]);

const ARITY = {};
for (const op of Object.keys(NUM_OPS)) ARITY[op] = UNARY_OPS.has(op) ? 1 : 2;
for (const op of Object.keys(CMP_OPS)) ARITY[op] = 2;
for (const op of Object.keys(BOOL_OPS)) ARITY[op] = op === "not" ? 1 : 2;
ARITY.len = 1;
ARITY.get = 2;
ARITY.min = 1;
ARITY.max = 1;
ARITY.sum = 1;

/** Base class for every IR node. */
class Node {
  opCount() {
    return 1;
  }
}

/** Literal value. */
class Lit extends Node {
  constructor(value) {
    super();
    this.value = value;
  }
}

/** Reference to an input variable. */
class Var extends Node {
  constructor(name) {
    super();
    this.name = name;
  }
}

/** Function call: op(args...). */
class Call extends Node {
  constructor(op, args = []) {
    super();
    this.op = op;
    this.args = args;
  }
  opCount() {
    return 1 + this.args.reduce((s, a) => s + a.opCount(), 0);
  }
}

/** Conditional: cond ? then : else_. */
class If extends Node {
  constructor(cond, then, else_) {
    super();
    this.cond = cond;
    this.then = then;
    this.else_ = else_;
  }
  opCount() {
    return 1 + this.cond.opCount() + this.then.opCount() + this.else_.opCount();
  }
}

/**
 * A discovered algorithm: an expression tree plus metadata.
 */
class Algorithm {
  constructor(root, benchmark, generation, { correctness = 0, ops = 0, notes = "" } = {}) {
    this.root = root;
    this.benchmark = benchmark;
    this.generation = generation;
    this.correctness = correctness;
    this.ops = ops;
    this.notes = notes;
  }

  get opCount() {
    return this.root.opCount();
  }

  toCode() {
    const render = (n) => {
      if (n instanceof Lit) return JSON.stringify(n.value);
      if (n instanceof Var) return n.name;
      if (n instanceof Call) return `${n.op}(${n.args.map(render).join(", ")})`;
      if (n instanceof If) return `(${render(n.cond)} ? ${render(n.then)} : ${render(n.else_)})`;
      return String(n);
    };
    return render(this.root);
  }

  toDict() {
    return {
      benchmark: this.benchmark,
      generation: this.generation,
      correctness: this.correctness,
      ops: this.ops,
      notes: this.notes,
      root: nodeToDict(this.root),
    };
  }

  static fromDict(d) {
    return new Algorithm(nodeFromDict(d.root), d.benchmark, d.generation, {
      correctness: d.correctness ?? 0,
      ops: d.ops ?? 0,
      notes: d.notes ?? "",
    });
  }
}

/** Serialize a node to a plain object. */
function nodeToDict(n) {
  if (n instanceof Lit) return { type: "lit", value: n.value };
  if (n instanceof Var) return { type: "var", name: n.name };
  if (n instanceof Call)
    return { type: "call", op: n.op, args: n.args.map(nodeToDict) };
  if (n instanceof If)
    return {
      type: "if",
      cond: nodeToDict(n.cond),
      then: nodeToDict(n.then),
      else: nodeToDict(n.else_),
    };
  throw new Error(`unknown node type ${n && n.constructor.name}`);
}

/** Deserialize a node from a plain object. */
function nodeFromDict(d) {
  const t = d.type;
  if (t === "lit") return new Lit(d.value);
  if (t === "var") return new Var(d.name);
  if (t === "call") return new Call(d.op, d.args.map(nodeFromDict));
  if (t === "if")
    return new If(nodeFromDict(d.cond), nodeFromDict(d.then), nodeFromDict(d.else));
  throw new Error(`unknown node type ${t}`);
}

function staticOpCount(root) {
  return root.opCount();
}

export {
  ALL_OPS,
  ARITY,
  Algorithm,
  Call,
  If,
  Lit,
  Node,
  Var,
  nodeFromDict,
  nodeToDict,
  staticOpCount,
};
