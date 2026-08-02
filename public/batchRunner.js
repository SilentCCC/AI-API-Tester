(function exposeBatchRunner(globalScope) {
  async function runWithConcurrency(items, worker, options = {}) {
    const concurrency = Math.max(1, Number(options.concurrency) || 1);
    const workerCount = Math.min(concurrency, items.length);
    let cursor = 0;

    async function consume() {
      while (!options.signal?.aborted) {
        const index = cursor;
        if (index >= items.length) {
          return;
        }

        cursor += 1;
        const item = items[index];
        options.onItemStart?.(item, index);

        try {
          const result = await worker(item, index);
          options.onItemFinish?.(null, result, item, index);
        } catch (error) {
          options.onItemFinish?.(error, undefined, item, index);
        }
      }
    }

    await Promise.all(Array.from({ length: workerCount }, consume));
    return { started: cursor, total: items.length };
  }

  const api = { runWithConcurrency };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  } else {
    globalScope.BatchRunner = api;
  }
}(typeof globalThis !== 'undefined' ? globalThis : this));
