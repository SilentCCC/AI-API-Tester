const test = require('node:test');
const assert = require('node:assert/strict');
const { STORAGE_KEY, load, save } = require('../public/testSessionStore');

function createMemoryStorage() {
  const values = new Map();
  return {
    getItem(key) { return values.has(key) ? values.get(key) : null; },
    setItem(key, value) { values.set(key, value); }
  };
}

test('测试会话可以保存并恢复模型、结果与开始时间', () => {
  const storage = createMemoryStorage();
  const state = {
    selectedSiteIds: ['site-a'],
    aggregatedSiteModels: ['gpt-5.6'],
    selectedSiteModels: ['gpt-5.6'],
    siteModelSummaries: [{ success: true, site: 'API A', count: 1, models: ['gpt-5.6'] }],
    independentSelections: { 'site-a': ['gpt-5.6'] },
    resultRecords: [{ task: { siteId: 'site-a', model: 'gpt-5.6' }, result: { success: true } }],
    independentResultRecords: [],
    testPrompt: 'custom ping',
    batchStartedAt: '2026-08-03T12:00:00.000Z',
    progressText: '测试完成 1/1',
    badgeText: '测试完成',
    badgeClass: 'badge badge-success'
  };

  assert.equal(save(state, storage), true);
  assert.deepEqual(load(storage), state);
  assert.ok(storage.getItem(STORAGE_KEY));
});

test('损坏的测试会话回退为空状态', () => {
  const storage = createMemoryStorage();
  storage.setItem(STORAGE_KEY, '{bad json');

  assert.deepEqual(load(storage), {
    selectedSiteIds: [],
    aggregatedSiteModels: [],
    selectedSiteModels: [],
    siteModelSummaries: [],
    independentSelections: {},
    resultRecords: [],
    independentResultRecords: [],
    testPrompt: 'Hello',
    batchStartedAt: null,
    progressText: '等待测试',
    badgeText: '等待测试',
    badgeClass: 'badge badge-pending'
  });
});
