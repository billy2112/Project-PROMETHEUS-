/**
 * Combine previous discoveries into new candidates (subtree crossover).
 *
 * Two previously discovered algorithms for the same benchmark are recombined
 * by swapping a random subtree, producing a novel candidate that inherits
 * structure from both successful discoveries.
 */

import { Algorithm, Call, If, Node } from "./ir.js";
import { choice } from "./util.js";

/**
 * Swap a random subtree between two parents.
 * Returns a new Algorithm, or null if either parent has no subtrees.
 */
export function crossover(parentA, parentB, rng) {
  const nodesA = collect(parentA.root);
  const nodesB = collect(parentB.root);
  if (!nodesA.length || !nodesB.length) return null;
  const subA = choice(rng, nodesA);
  const subB = choice(rng, nodesB);
  const newRoot = replace(parentA.root, subA, subB);
  return new Algorithm(
    newRoot,
    parentA.benchmark,
    Math.max(parentA.generation, parentB.generation) + 1,
  );
}

function collect(root) {
  const out = [];
  const walk = (n) => {
    out.push(n);
    if (n instanceof Call) for (const a of n.args) walk(a);
    else if (n instanceof If) { walk(n.cond); walk(n.then); walk(n.else_); }
  };
  walk(root);
  return out;
}

function replace(root, target, replacement) {
  if (root === target) return replacement;
  if (root instanceof Call)
    return new Call(root.op, root.args.map((a) => replace(a, target, replacement)));
  if (root instanceof If)
    return new If(
      replace(root.cond, target, replacement),
      replace(root.then, target, replacement),
      replace(root.else_, target, replacement),
    );
  return root;
}
