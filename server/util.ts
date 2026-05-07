// Asynchronous for each, doing a limited number of things at a time.
export async function asyncForEach(
  array: any[],
  limit: number,
  callback: (item: any, index: number, array: any[], done: () => void) => void,
) {
  let i: number = 0

  for (; i < limit; i++) {
    doNextThing(i)
  }

  function doNextThing(index: number) {
    if (array[index]) {
      callback(array[index], index, array, function done() {
        doNextThing(i++)
      })
    }
  }

  return 1
}


/**
 * Class-based async work queue with limited concurrency.
 *
 * - Construct with an initial list of jobs and a worker count.
 * - Add more jobs later via `addJob()` (useful for sporadic/streaming workflows).
 * - Optional listeners:
 *   - `onIdle(fn)`: called when there are no queued jobs and all workers are idle.
 *     (May fire multiple times if you add jobs in bursts.)
 *   - `onError(fn)`: called when a job rejects/throws.
 */
export class AsyncWorkQueue<T> {
  private queue: { id: number, job: () => Promise<T>, resolve: (result: T) => void, reject: (error: unknown) => void }[] = []
  private workers: (Promise<T> | null)[] = []

  private listeners: {
    idle: Set<() => void>
    error: Set<(error: unknown) => void>
  } = {
      idle: new Set(),
      error: new Set(),
    }

  constructor({
    jobs,
    numberOfWorkers
  }: {
    jobs: (() => Promise<T>)[],
    numberOfWorkers: number
  }) {
    for (let i = 0; i < (numberOfWorkers ?? 10); i++) {
      this.workers[i] = null
    }

    jobs.forEach((job) => {
      this.addJob(job)
    })
  }

  onIdle(listener: () => void) {
    this.listeners.idle.add(listener)
    return () => this.listeners.idle.delete(listener)
  }

  onError(listener: (error: unknown) => void) {
    this.listeners.error.add(listener)
    return () => this.listeners.error.delete(listener)
  }

  private counter = 0
  addJob(job: () => Promise<T>) {
    return new Promise((resolve, reject) => {
      this.queue.push({ id: this.counter++, job, resolve, reject })
      if (this.hasAvailableWorker()) {
        this.runNextJob()
      }
    })
  }

  private runNextJob() {
    if (this.queue.length === 0) {
      this.emitIdleIfNeeded()
      return
    }
    // const {job, resolve, reject} = this.queue.shift()

    const next = this.queue.shift()
    if (!next) {
      this.emitIdleIfNeeded()
      return
    }

    const { id, job, resolve, reject } = next

    const workerID = this.workers.findIndex((worker) => worker === null)
    if (workerID !== -1) {
      this.workers[workerID] = job()
        .then((result) => {
          this.workers[workerID] = null
          this.runNextJob()
          resolve(result)
          return result
        })
        .catch((error) => {
          console.error(`Job ${id} error`, error)
          this.listeners.error.forEach((listener) => listener(error))
          this.workers[workerID] = null
          this.runNextJob()
          reject(error)
          throw error
        })
        .finally(() => {
          this.emitIdleIfNeeded()
        })
    } else {
      this.queue.push(next)
    }

  }

  private hasAvailableWorker() {
    return this.workers.some((worker) => worker === null)
  }

  private emitIdleIfNeeded() {
    if (this.queue.length === 0 && this.workers.every((worker) => worker === null)) {
      this.listeners.idle.forEach((listener) => listener())
    }
  }
}

// Simple spinner
export function spinner(string: string = 'Loading...') {
  const dots = {
    interval: 80,
    frames: [
      "⠋",
      "⠙",
      "⠹",
      "⠸",
      "⠼",
      "⠴",
      "⠦",
      "⠧",
      "⠇",
      "⠏"
    ]
  }

  let i = 0
  const spinnerInterval = setInterval(() => {
    process.stdout.write(`\r${dots.frames[i]} ${string}`)
    i = (i + 1) % dots.frames.length
  }, dots.interval)

  return () => {
    process.stdout.write(`\r${string}\n`)
    clearInterval(spinnerInterval)
  }
}


// Export the models utils?
export * from '../models/util'
