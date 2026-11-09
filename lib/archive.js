/**
 * Archive of preserved discoveries.
 *
 * Correct, efficient algorithms are preserved as discoveries. The archive
 * keeps the best-known (control) algorithm per benchmark so later candidates
 * and combinations are compared against it, and it can be persisted to disk.
 */

import { Algorithm } from "./ir.js";
import * as fs from "fs";

export class Discovery {
  constructor({ benchmark, generation, correctness, ops, code, algorithm }) {
    this.benchmark = benchmark;
    this.generation = generation;
    this.correctness = correctness;
    this.ops = ops;
    this.code = code;
    this.algorithm = algorithm;
  }
}

export class Archive {
  constructor({ path, keepPerBenchmark = 50 } = {}) {
    this.path = path;
    this.keep = keepPerBenchmark;
    this.discoveries = {};
    this.best = {};
    if (path && fs.existsSync(path)) this._load();
  }

  add(discovery) {
    if (discovery.correctness < 0.99) return false;
    const b = discovery.benchmark;
    if (!this.discoveries[b]) this.discoveries[b] = [];
    const lst = this.discoveries[b];
    const cur = this.best[b];
    if (!cur || discovery.ops < cur.opCount) this.best[b] = discovery.algorithm;
    lst.push(discovery);
    lst.sort((x, y) => x.ops - y.ops);
    if (lst.length > this.keep) {
      lst.length = this.keep;
      this.discoveries[b] = lst;
    }
    if (this.path) this._save();
    return true;
  }

  getBest(benchmark) {
    return this.best[benchmark] || null;
  }

  _save() {
    if (!this.path) return;
    const data = {};
    for (const [b, lst] of Object.entries(this.discoveries)) {
      data[b] = lst.map((d) => this._serialize(d));
    }
    fs.writeFileSync(this.path, JSON.stringify(data, null, 2));
  }

  _load() {
    try {
      const data = JSON.parse(fs.readFileSync(this.path, "utf8"));
      for (const [b, lst] of Object.entries(data)) {
        this.discoveries[b] = lst.map((d) => this._deserialize(d));
        if (lst.length) this.best[b] = lst.reduce((a, c) => (c.ops < a.ops ? c : a)).algorithm;
      }
    } catch {
      /* ignore corrupt archive */
    }
  }

  _serialize(d) {
    return {
      benchmark: d.benchmark,
      generation: d.generation,
      correctness: d.correctness,
      ops: d.ops,
      code: d.code,
      algorithm: d.algorithm.toDict(),
    };
  }

  _deserialize(d) {
    return new Discovery({
      benchmark: d.benchmark,
      generation: d.generation,
      correctness: d.correctness,
      ops: d.ops,
      code: d.code,
      algorithm: Algorithm.fromDict(d.algorithm),
    });
  }
}
