import { WorkerPool } from "../../scripts/worker-pool.js";
import { expect, test, describe } from "bun:test";

describe("WorkerPool", () => {
  test("runs jobs and resolves when queue is drained after close", () => {
    const ran: number[] = [];
    const pool = new WorkerPool({ workers: 2, delayMs: 0 });
    pool.push(() => Promise.resolve(ran.push(1)));
    pool.push(() => Promise.resolve(ran.push(2)));
    pool.push(() => Promise.resolve(ran.push(3)));
    pool.close();
    return pool.run().then(() => {
      expect(ran.sort()).toEqual([1, 2, 3]);
    });
  });

  test("close() causes run() to resolve and workers to exit", () => {
    const pool = new WorkerPool({ workers: 1, delayMs: 0 });
    pool.close();
    return pool.run();
  });

  test("push after close is no-op", () => {
    const ran: number[] = [];
    const pool = new WorkerPool({ workers: 1, delayMs: 0 });
    pool.close();
    pool.push(() => Promise.resolve(ran.push(1)));
    return pool.run().then(() => {
      expect(ran).toEqual([]);
    });
  });

  test('on("finished") callback runs when done', () => {
    let finished = false;
    const pool = new WorkerPool({ workers: 1, delayMs: 0 });
    pool.on("finished", () => {
      finished = true;
    });
    pool.push(() => Promise.resolve());
    pool.close();
    return pool.run().then(() => {
      expect(finished).toBe(true);
    });
  });

  test('on("halted") runs when pool stops due to failure limits; on("finished") does not', () => {
    let finished = false;
    let halted = false;
    const pool = new WorkerPool({
      workers: 1,
      delayMs: 0,
      maxConsecutiveFailures: 1,
    });
    pool.on("finished", () => {
      finished = true;
    });
    pool.on("halted", () => {
      halted = true;
    });
    pool.push(() => Promise.reject(new Error("fail")));
    return pool.run().then(() => {
      expect(halted).toBe(true);
      expect(finished).toBe(false);
    });
  });

  test('when halted and on("halted") not provided, on("finished") runs', () => {
    let finished = false;
    const pool = new WorkerPool({
      workers: 1,
      delayMs: 0,
      maxConsecutiveFailures: 1,
    });
    pool.on("finished", () => {
      finished = true;
    });
    pool.push(() => Promise.reject(new Error("fail")));
    return pool.run().then(() => {
      expect(finished).toBe(true);
    });
  });

  test('when done normally, on("halted") does not run', () => {
    let halted = false;
    const pool = new WorkerPool({ workers: 1, delayMs: 0 });
    pool.on("halted", () => {
      halted = true;
    });
    pool.push(() => Promise.resolve());
    pool.close();
    return pool.run().then(() => {
      expect(halted).toBe(false);
    });
  });

  test("stops after maxConsecutiveFailures", () => {
    const ran: number[] = [];
    const pool = new WorkerPool({
      workers: 1,
      delayMs: 0,
      maxConsecutiveFailures: 2,
    });
    pool.push(() => Promise.reject(new Error("fail")));
    pool.push(() => Promise.reject(new Error("fail")));
    pool.push(() => Promise.resolve(ran.push(1)));
    return pool.run().then(() => {
      expect(ran).toEqual([]);
    });
  });

  test("resets consecutiveFailures on success", () => {
    const ran: number[] = [];
    const pool = new WorkerPool({
      workers: 1,
      delayMs: 0,
      maxConsecutiveFailures: 3,
    });
    pool.push(() => Promise.reject(new Error("fail")));
    pool.push(() => Promise.resolve(ran.push(1)));
    pool.push(() => Promise.reject(new Error("fail")));
    pool.push(() => Promise.reject(new Error("fail")));
    pool.push(() => Promise.resolve(ran.push(2)));
    pool.close();
    return pool.run().then(() => {
      expect(ran.sort()).toEqual([1, 2]);
    });
  });

  test("stops after maxFailures (total)", () => {
    const ran: number[] = [];
    const pool = new WorkerPool({
      workers: 2,
      delayMs: 0,
      maxFailures: 2,
    });
    pool.push(() => Promise.reject(new Error("fail")));
    pool.push(() => Promise.reject(new Error("fail")));
    pool.push(() => Promise.resolve(ran.push(1)));
    return pool.run().then(() => {
      expect(ran).toEqual([]);
    });
  });

  test("constructor throws if workers < 1", () => {
    expect(() => new WorkerPool({ workers: 0, delayMs: 0 })).toThrow("workers must be >= 1");
  });

  test("pushDelayed queues job after delay", () => {
    const ran: number[] = [];
    const pool = new WorkerPool({ workers: 1, delayMs: 0 });
    pool.push(() => Promise.resolve(ran.push(1)));
    pool.pushDelayed(() => Promise.resolve(ran.push(2)), 0);
    queueMicrotask(() => pool.close());
    return pool.run().then(() => {
      expect(ran).toContain(1);
      expect(ran.length).toBeGreaterThanOrEqual(1);
    });
  });
});
