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
  }, () => 'site-1', () => new Date('2026-08-02T00:00:00.000Z'));

  assert.deepEqual(site, {
    id: 'site-1',
    name: 'OpenAI 测试',
    endpoint: 'https://api.example.com/v1',
    apiKey: 'test-key',
    note: '',
    createdAt: '2026-08-02T00:00:00.000Z',
    enabled: true
  });
  assert.equal(normalizeEndpoint('http://localhost:3000/v1///'), 'http://localhost:3000/v1');
}, { timeout: 1000 });

test('站点配置可以保存到浏览器存储并重新读取', () => {
  const storage = createMemoryStorage();
  const sites = [{
    id: 'a',
    name: 'A',
    endpoint: 'https://a.example/v1',
    apiKey: 'key-a',
    note: '测试站点',
    createdAt: '2026-08-01T00:00:00.000Z',
    enabled: true
  }];
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

test('导出配置包含迁移所需字段但不包含内部 id', () => {
  const config = createExportConfig([{
    id: 'internal-id',
    name: 'API 1',
    endpoint: 'https://api.example.com/v1/',
    apiKey: 'sk-secret',
    note: 'GPT 测试接口',
    createdAt: '2026-08-01T12:00:00.000Z',
    enabled: false
  }], () => new Date('2026-08-02T00:00:00.000Z'));

  assert.deepEqual(config, {
    formatVersion: 1,
    exportedAt: '2026-08-02T00:00:00.000Z',
    apis: [{
      name: 'API 1',
      endpoint: 'https://api.example.com/v1',
      apiKey: 'sk-secret',
      note: 'GPT 测试接口',
      createdAt: '2026-08-01T12:00:00.000Z',
      enabled: false
    }]
  });
  assert.equal('id' in config.apis[0], false);
});

test('导入配置校验格式并补齐默认字段', () => {
  let nextId = 0;
  const sites = parseImportConfig({
    apis: [{ name: 'API 1', endpoint: 'https://api.example.com/v1/', apiKey: 'sk-key' }]
  }, () => `import-${++nextId}`, () => new Date('2026-08-02T00:00:00.000Z'));

  assert.deepEqual(sites, [{
    id: 'import-1',
    name: 'API 1',
    endpoint: 'https://api.example.com/v1',
    apiKey: 'sk-key',
    note: '',
    createdAt: '2026-08-02T00:00:00.000Z',
    enabled: true
  }]);
  assert.throws(() => parseImportConfig({}), /必须包含 apis 数组/);
  assert.throws(() => parseImportConfig({ apis: [{ name: '', endpoint: 'bad', apiKey: '' }] }), /第 1 个 API 配置无效/);
});

test('重复 Endpoint 可以检测并在确认后覆盖', () => {
  const existing = [{ id: 'old', name: '旧配置', endpoint: 'https://api.example.com/v1', apiKey: 'old' }];
  const imported = [
    { id: 'new', name: '新配置', endpoint: 'https://api.example.com/v1/', apiKey: 'new' },
    { id: 'other', name: '其他', endpoint: 'https://other.example/v1', apiKey: 'other' }
  ];

  assert.deepEqual(findDuplicateEndpoints(existing, imported), ['https://api.example.com/v1']);
  assert.deepEqual(mergeImportedSites(existing, imported, true), imported);
});
