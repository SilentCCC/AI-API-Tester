const test = require('node:test');
const assert = require('node:assert/strict');
const { runWithConcurrency } = require('../public/batchRunner');

test('批量执行同时最多运行三个任务', async () => {
  let active = 0;
  let maximumActive = 0;
  const completed = [];

  await runWithConcurrency([1, 2, 3, 4, 5, 6, 7], async (item) => {
    active += 1;
    maximumActive = Math.max(maximumActive, active);
    await new Promise((resolve) => setTimeout(resolve, 10));
    completed.push(item);
    active -= 1;
  }, { concurrency: 3 });

  assert.equal(maximumActive, 3);
  assert.equal(completed.length, 7);
});

test('收到停止信号后不再启动等待中的任务', async () => {
  const controller = new AbortController();
  const started = [];

  await runWithConcurrency([1, 2, 3, 4, 5, 6], async (item) => {
    started.push(item);
    controller.abort();
  }, {
    concurrency: 3,
    signal: controller.signal
  });

  assert.ok(started.length < 6);
});
