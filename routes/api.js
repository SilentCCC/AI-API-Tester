const express = require('express');
const { detectModelConsistency } = require('../utils/modelConsistency');

const router = express.Router();
const REQUEST_TIMEOUT_MS = 30000;
const CONVERSATION_TIMEOUT_MS = 300000;

const ERROR_MESSAGES = {
  400: '请求参数不正确。',
  401: 'API Key 错误或已失效。',
  403: '当前 API Key 没有访问权限。',
  404: '接口不存在，请检查 Endpoint 是否包含正确的 API 版本路径。',
  429: '请求次数达到限制，请稍后重试。',
  500: '上游 API 服务器发生错误。',
  502: '上游 API 网关响应异常。',
  503: '上游 API 服务暂时不可用。'
};

function normalizeEndpoint(endpoint) {
  const value = String(endpoint || '').trim().replace(/\/+$/, '');
  const url = new URL(value);

  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new Error('Endpoint 仅支持 HTTP 或 HTTPS。');
  }

  return value;
}

function getErrorMessage(status, payload) {
  return payload?.error?.message
    || payload?.message
    || ERROR_MESSAGES[status]
    || `API 请求失败（HTTP ${status}）。`;
}

async function parseResponse(response) {
  const text = await response.text();
  if (!text) {
    return {};
  }

  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
}

async function requestUpstream(url, options, externalSignal, timeoutMs = REQUEST_TIMEOUT_MS) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const abortFromExternal = () => controller.abort();

  if (externalSignal?.aborted) {
    controller.abort();
  } else {
    externalSignal?.addEventListener('abort', abortFromExternal, { once: true });
  }

  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
    externalSignal?.removeEventListener('abort', abortFromExternal);
  }
}

function validateCredentials(request, response) {
  const { endpoint, apiKey } = request.body;

  if (!endpoint || !apiKey) {
    response.status(400).json({
      success: false,
      message: '请填写 API Endpoint 和 API Key。'
    });
    return null;
  }

  try {
    return {
      endpoint: normalizeEndpoint(endpoint),
      apiKey: String(apiKey).trim()
    };
  } catch (error) {
    response.status(400).json({ success: false, message: error.message || 'Endpoint 格式不正确。' });
    return null;
  }
}

function extractContent(payload) {
  const content = payload?.choices?.[0]?.message?.content;

  if (typeof content === 'string') {
    return content;
  }

  if (Array.isArray(content)) {
    return content
      .map((item) => item?.text || item?.content || '')
      .filter(Boolean)
      .join('\n');
  }

  return content == null ? '' : JSON.stringify(content, null, 2);
}

// 基础探针用于确认前端与 Express 服务连接正常。
router.get('/health', (request, response) => {
  response.json({
    success: true,
    service: 'AI API Tester',
    version: '0.4.20'
  });
});

router.post('/models', async (request, response) => {
  const credentials = validateCredentials(request, response);
  if (!credentials) return;

  try {
    const upstream = await requestUpstream(`${credentials.endpoint}/models`, {
      headers: { Authorization: `Bearer ${credentials.apiKey}` }
    });
    const payload = await parseResponse(upstream);

    if (!upstream.ok) {
      response.status(upstream.status).json({
        success: false,
        httpStatus: upstream.status,
        message: getErrorMessage(upstream.status, payload)
      });
      return;
    }

    const source = Array.isArray(payload) ? payload : payload.data;
    const models = [...new Set((Array.isArray(source) ? source : [])
      .map((item) => typeof item === 'string' ? item : item?.id)
      .filter(Boolean))]
      .sort((left, right) => left.localeCompare(right));

    response.json({ success: true, count: models.length, models });
  } catch (error) {
    const isTimeout = error.name === 'AbortError';
    response.status(isTimeout ? 504 : 502).json({
      success: false,
      message: isTimeout ? '请求超时，上游 API 在 30 秒内没有响应。' : `无法连接 API：${error.message}`
    });
  }
});

router.post('/test-model', async (request, response) => {
  const credentials = validateCredentials(request, response);
  if (!credentials) return;

  const requestedModel = String(request.body.model || '').trim();
  if (!requestedModel) {
    response.status(400).json({ success: false, message: '请先从模型列表中选择一个模型。' });
    return;
  }

  const testPrompt = typeof request.body.prompt === 'string' && request.body.prompt.trim()
    ? request.body.prompt
    : 'Hello';

  const startedAt = performance.now();
  const clientController = new AbortController();
  const abortOnDisconnect = () => {
    if (!response.writableEnded) {
      clientController.abort();
    }
  };
  response.once('close', abortOnDisconnect);

  try {
    const upstream = await requestUpstream(`${credentials.endpoint}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${credentials.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: requestedModel,
        messages: [{ role: 'user', content: testPrompt }],
        temperature: 0
      })
    }, clientController.signal, request.body.longWait ? CONVERSATION_TIMEOUT_MS : REQUEST_TIMEOUT_MS);
    const responseTime = Math.round(performance.now() - startedAt);
    const payload = await parseResponse(upstream);

    if (!upstream.ok) {
      const returnedModel = typeof payload?.model === 'string' ? payload.model : null;
      response.status(upstream.status).json({
        success: false,
        requestedModel,
        returnedModel,
        consistency: detectModelConsistency(requestedModel, returnedModel),
        httpStatus: upstream.status,
        responseTime,
        message: getErrorMessage(upstream.status, payload)
      });
      return;
    }

    const returnedModel = typeof payload?.model === 'string' ? payload.model : null;
    response.json({
      success: true,
      requestedModel,
      returnedModel,
      consistency: detectModelConsistency(requestedModel, returnedModel),
      httpStatus: upstream.status,
      responseTime,
      content: extractContent(payload),
      rawResponse: payload
    });
  } catch (error) {
    if (clientController.signal.aborted && response.destroyed) {
      return;
    }

    const responseTime = Math.round(performance.now() - startedAt);
    const isTimeout = error.name === 'AbortError';
    response.status(isTimeout ? 504 : 502).json({
      success: false,
      requestedModel,
      returnedModel: null,
      httpStatus: isTimeout ? 504 : 502,
      responseTime,
      message: isTimeout ? '请求超时，上游 API 在 30 秒内没有响应。' : `无法连接 API：${error.message}`
    });
  } finally {
    response.removeListener('close', abortOnDisconnect);
  }
});

router.post('/conversation', async (request, response) => {
  const credentials = validateCredentials(request, response);
  if (!credentials) return;

  const requestedModel = String(request.body.model || '').trim();
  const messages = Array.isArray(request.body.messages)
    ? request.body.messages
      .filter((message) => message && ['user', 'assistant', 'system'].includes(message.role) && typeof message.content === 'string')
      .map((message) => ({ role: message.role, content: message.content }))
    : [];
  if (!requestedModel) {
    response.status(400).json({ success: false, message: '请选择一个模型。' });
    return;
  }
  if (!messages.length || !messages.some((message) => message.role === 'user' && message.content.trim())) {
    response.status(400).json({ success: false, message: '请输入对话内容。' });
    return;
  }

  const startedAt = performance.now();
  const clientController = new AbortController();
  const abortOnDisconnect = () => { if (!response.writableEnded) clientController.abort(); };
  response.once('close', abortOnDisconnect);
  try {
    const upstream = await requestUpstream(`${credentials.endpoint}/chat/completions`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${credentials.apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: requestedModel, messages, temperature: 0 })
    }, clientController.signal, CONVERSATION_TIMEOUT_MS);
    const responseTime = Math.round(performance.now() - startedAt);
    const payload = await parseResponse(upstream);
    if (!upstream.ok) {
      response.status(upstream.status).json({ success: false, requestedModel, returnedModel: payload?.model || null, httpStatus: upstream.status, responseTime, message: getErrorMessage(upstream.status, payload) });
      return;
    }
    response.json({ success: true, requestedModel, returnedModel: typeof payload?.model === 'string' ? payload.model : null, httpStatus: upstream.status, responseTime, content: extractContent(payload), rawResponse: payload });
  } catch (error) {
    if (clientController.signal.aborted && response.destroyed) return;
    const responseTime = Math.round(performance.now() - startedAt);
    const isTimeout = error.name === 'AbortError';
    response.status(isTimeout ? 504 : 502).json({ success: false, requestedModel, returnedModel: null, httpStatus: isTimeout ? 504 : 502, responseTime, message: isTimeout ? '对话请求超时，上游 API 在 5 分钟内没有响应。' : `无法连接 API：${error.message}` });
  } finally {
    response.removeListener('close', abortOnDisconnect);
  }
});

module.exports = router;
