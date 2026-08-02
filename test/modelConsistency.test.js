const test = require('node:test');
const assert = require('node:assert/strict');
const { detectModelConsistency } = require('../utils/modelConsistency');

test('完全相同的模型名称判定为匹配', () => {
  assert.equal(detectModelConsistency('gpt-5.6', 'gpt-5.6').level, 'match');
});

test('latest 和 turbo 等同版本名称判定为可能映射', () => {
  assert.equal(detectModelConsistency('gpt-5.6-latest', 'gpt-5.6').level, 'mapping');
  assert.equal(detectModelConsistency('gpt-5.6', 'gpt-5.6-turbo').level, 'mapping');
  assert.equal(detectModelConsistency('gpt-5.6', 'gpt-5.6-mini').level, 'mapping');
});

test('可明确解析的不同版本判定为明显不一致', () => {
  assert.equal(detectModelConsistency('gpt-5.6', 'gpt-4.1').level, 'mismatch');
  assert.equal(detectModelConsistency('gpt-5.6', 'gpt-3.5-turbo').level, 'mismatch');
  assert.equal(detectModelConsistency('gpt-5.6', 'claude-4').level, 'mismatch');
});

test('缺少返回模型字段时无法判断', () => {
  assert.equal(detectModelConsistency('gpt-5.6', null).level, 'unknown');
});

test('无法明确解析的不同名称采用保守映射提示', () => {
  assert.equal(detectModelConsistency('company-chat-latest', 'backend-chat-v2').level, 'mapping');
});
