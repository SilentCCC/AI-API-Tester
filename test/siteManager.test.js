const test = require('node:test');
const assert = require('node:assert/strict');
const {
  STORAGE_KEY,
  buildSiteModelTasks,
  createSite,
  loadSites,
  normalizeEndpoint,
  saveSites
} = require('../public/siteManager');

function createMemoryStorage() {
  const values = new Map();
  return {
    getItem(key) { return values.has(key) ? values.get(key) : null; },
    setItem(key, value) { values.set(key, value); }
  };
}

test('创建站点时规范化 Endpoint 并保留配置', () => {
  const site = createSite({
    name: ' OpenAI 测试 ',
    endpoint: 'https://api.example.com/v1/',
    apiKey: ' test-key '
  }, () => 'site-1');

  assert.deepEqual(site, {
    id: 'site-1',
    name: 'OpenAI 测试',
    endpoint: 'https://api.example.com/v1',
    apiKey: 'test-key'
  });
  assert.equal(normalizeEndpoint('http://localhost:3000/v1///'), 'http://localhost:3000/v1');
});

test('站点配置可以保存到浏览器存储并重新读取', () => {
  const storage = createMemoryStorage();
  const sites = [{ id: 'a', name: 'A', endpoint: 'https://a.example/v1', apiKey: 'key-a' }];
  saveSites(sites, storage);
  assert.deepEqual(loadSites(storage), sites);
  assert.ok(storage.getItem(STORAGE_KEY));
});

test('按站点与模型生成完整组合任务', () => {
  const sites = [
    { id: 'a', name: 'A', endpoint: 'https://a.example/v1', apiKey: 'key-a' },
    { id: 'b', name: 'B', endpoint: 'https://b.example/v1', apiKey: 'key-b' }
  ];
  const tasks = buildSiteModelTasks(sites, ['gpt-5.6', 'gpt-4.1']);

  assert.equal(tasks.length, 4);
  assert.deepEqual(tasks.map((task) => [task.site.id, task.model]), [
    ['a', 'gpt-5.6'],
    ['a', 'gpt-4.1'],
    ['b', 'gpt-5.6'],
    ['b', 'gpt-4.1']
  ]);
});
