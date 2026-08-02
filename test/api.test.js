const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const express = require('express');
const apiRouter = require('../routes/api');

function listen(server) {
  return new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
}

function close(server) {
  return new Promise((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
  });
}

test('模型列表去重，聊天测试发送 temperature 0 并返回一致性结果', async () => {
  let receivedBody;
  const upstream = http.createServer((request, response) => {
    response.setHeader('Content-Type', 'application/json');

    if (request.url === '/v1/models') {
      response.end(JSON.stringify({
        data: [{ id: 'gpt-5.6' }, { id: 'gpt-5.6' }, { id: 'gpt-4.1' }]
      }));
      return;
    }

    if (request.url === '/v1/chat/completions' && request.method === 'POST') {
      let body = '';
      request.on('data', (chunk) => { body += chunk; });
      request.on('end', () => {
        receivedBody = JSON.parse(body);
        response.end(JSON.stringify({
          model: 'gpt-5.6-turbo',
          choices: [{ message: { content: 'Hello!' } }]
        }));
      });
      return;
    }

    response.statusCode = 404;
    response.end(JSON.stringify({ error: { message: 'Not found' } }));
  });

  const app = express();
  app.use(express.json());
  app.use('/api', apiRouter);
  const local = http.createServer(app);

  await listen(upstream);
  await listen(local);

  try {
    const upstreamPort = upstream.address().port;
    const localPort = local.address().port;
    const credentials = {
      endpoint: `http://127.0.0.1:${upstreamPort}/v1`,
      apiKey: 'test-key'
    };

    const modelsResponse = await fetch(`http://127.0.0.1:${localPort}/api/models`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(credentials)
    });
    const models = await modelsResponse.json();
    assert.deepEqual(models.models, ['gpt-4.1', 'gpt-5.6']);

    const testResponse = await fetch(`http://127.0.0.1:${localPort}/api/test-model`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...credentials, model: 'gpt-5.6' })
    });
    const result = await testResponse.json();

    assert.equal(testResponse.status, 200);
    assert.equal(receivedBody.temperature, 0);
    assert.deepEqual(receivedBody.messages, [{ role: 'user', content: 'Hello' }]);
    assert.equal(result.returnedModel, 'gpt-5.6-turbo');
    assert.equal(result.consistency.level, 'mapping');
    assert.equal(result.content, 'Hello!');
  } finally {
    await Promise.all([close(local), close(upstream)]);
  }
});
