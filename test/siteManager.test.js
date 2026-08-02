const test = require('node:test');
const assert = require('node:assert/strict');
const {
  STORAGE_KEY,
  buildSiteModelTasks,
  createExportConfig,
  createSite,
  findDuplicateEndpoints,
  loadSites,
  mergeImportedSites,
  normalizeEndpoint,
  parseImportConfig,
  reorderSites,
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

test('导出配置只包含 API 名称、端点地址和 API Key', () => {
  const config = createExportConfig([{
    id: 'internal-id',
    name: ' API 1 ',
    endpoint: 'https://api.example.com/v1/',
    apiKey: ' sk-secret '
  }]);

  assert.deepEqual(config, {
    apis: [{
      name: 'API 1',
      endpoint: 'https://api.example.com/v1',
      apiKey: 'sk-secret'
    }]
  });
});

test('导入配置校验 JSON 对象结构和每个站点字段', () => {
  let nextId = 0;
  const sites = parseImportConfig({
    apis: [{ name: 'API 1', endpoint: 'https://api.example.com/v1/', apiKey: 'sk-key' }]
  }, () => `import-${++nextId}`);

  assert.deepEqual(sites, [{
    id: 'import-1',
    name: 'API 1',
    endpoint: 'https://api.example.com/v1',
    apiKey: 'sk-key'
  }]);
  assert.throws(() => parseImportConfig({}), /必须包含 apis 数组/);
  assert.throws(() => parseImportConfig({ apis: [{ name: '', endpoint: 'bad', apiKey: '' }] }), /第 1 个 API 配置无效/);
});

test('重复端点可以检测并在确认后覆盖', () => {
  const existing = [{ id: 'old', name: '旧配置', endpoint: 'https://api.example.com/v1', apiKey: 'old' }];
  const imported = [
    { id: 'new', name: '新配置', endpoint: 'https://api.example.com/v1/', apiKey: 'new' },
    { id: 'other', name: '其他', endpoint: 'https://other.example/v1', apiKey: 'other' }
  ];

  assert.deepEqual(findDuplicateEndpoints(existing, imported), ['https://api.example.com/v1']);
  assert.deepEqual(mergeImportedSites(existing, imported, true), imported);
});

test('站点可以拖动到目标站点之前或之后', () => {
  const sites = [
    { id: 'a', name: 'A' },
    { id: 'b', name: 'B' },
    { id: 'c', name: 'C' },
    { id: 'd', name: 'D' }
  ];

  assert.deepEqual(reorderSites(sites, 'd', 'b', 'before').map((site) => site.id), ['a', 'd', 'b', 'c']);
  assert.deepEqual(reorderSites(sites, 'a', 'c', 'after').map((site) => site.id), ['b', 'c', 'a', 'd']);
  assert.deepEqual(reorderSites(sites, 'missing', 'b', 'before'), sites);
});
