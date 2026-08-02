const test = require('node:test');
const assert = require('node:assert/strict');
const { STATUS_CODES, getStatusCodeInfo } = require('../public/statusCodes');

test('常用 HTTP 状态码均提供说明', () => {
  const expectedCodes = [200, 201, 400, 401, 402, 403, 404, 408, 413, 422, 429, 500, 502, 503, 504];
  assert.deepEqual(Object.keys(STATUS_CODES).map(Number).sort((a, b) => a - b), expectedCodes);
  for (const code of expectedCodes) {
    const info = getStatusCodeInfo(code);
    assert.ok(info.icon);
    assert.ok(info.label);
    assert.ok(info.description);
  }
});

test('关键状态码使用预期的展示等级和名称', () => {
  assert.deepEqual(
    { label: getStatusCodeInfo(200).label, level: getStatusCodeInfo(200).level },
    { label: '请求成功', level: 'success' }
  );
  assert.deepEqual(
    { label: getStatusCodeInfo(401).label, level: getStatusCodeInfo(401).level },
    { label: '未授权', level: 'error' }
  );
  assert.deepEqual(
    { label: getStatusCodeInfo(429).label, level: getStatusCodeInfo(429).level },
    { label: '请求过多', level: 'warning' }
  );
});

test('未配置状态码返回保守的未知说明', () => {
  const info = getStatusCodeInfo(418);
  assert.equal(info.label, '未知状态');
  assert.equal(info.level, 'unknown');
  assert.equal(getStatusCodeInfo(null), null);
});
