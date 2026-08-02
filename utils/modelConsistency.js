const QUALIFIER_TOKENS = new Set([
  'latest',
  'preview',
  'turbo',
  'mini',
  'nano',
  'pro',
  'fast',
  'thinking',
  'instruct'
]);

function normalizeModelName(model) {
  return String(model || '')
    .trim()
    .toLowerCase()
    .replace(/[_\s]+/g, '-')
    .replace(/-+/g, '-');
}

function parseModelIdentity(model) {
  const normalized = normalizeModelName(model);
  const patterns = [
    { family: 'gpt', regex: /(?:^|\/)gpt-(\d+(?:\.\d+)?)/ },
    { family: 'claude', regex: /(?:^|\/)claude-(\d+(?:[.-]\d+)?)/ },
    { family: 'gemini', regex: /(?:^|\/)gemini-(\d+(?:\.\d+)?)/ },
    { family: 'grok', regex: /(?:^|\/)grok-(\d+(?:\.\d+)?)/ },
    { family: 'o', regex: /(?:^|\/)(o\d+(?:-mini)?)/ }
  ];

  for (const pattern of patterns) {
    const match = normalized.match(pattern.regex);
    if (match) {
      return {
        family: pattern.family,
        version: match[1].replace('-', '.')
      };
    }
  }

  return null;
}

function removeQualifiers(model) {
  return normalizeModelName(model)
    .split('-')
    .filter((token) => !QUALIFIER_TOKENS.has(token))
    .join('-');
}

function detectModelConsistency(requestedModel, returnedModel) {
  const requested = normalizeModelName(requestedModel);
  const returned = normalizeModelName(returnedModel);

  if (!returned) {
    return {
      level: 'unknown',
      label: '❓ 无法判断',
      description: 'API 响应中没有返回 model 字段，无法进行模型一致性检测。'
    };
  }

  if (requested === returned) {
    return {
      level: 'match',
      label: '✅ 模型匹配',
      description: '请求模型与 API 返回的模型名称一致。'
    };
  }

  const requestedIdentity = parseModelIdentity(requested);
  const returnedIdentity = parseModelIdentity(returned);
  const sameKnownIdentity = requestedIdentity
    && returnedIdentity
    && requestedIdentity.family === returnedIdentity.family
    && requestedIdentity.version === returnedIdentity.version;
  const sameNameWithoutQualifier = removeQualifiers(requested) === removeQualifiers(returned);

  if (sameKnownIdentity || sameNameWithoutQualifier) {
    return {
      level: 'mapping',
      label: '⚠️ 可能存在模型映射',
      description: '模型系列和主要版本接近，差异可能来自 latest、turbo、mini 等别名或服务商映射。'
    };
  }

  if (requestedIdentity && returnedIdentity) {
    const reason = requestedIdentity.family !== returnedIdentity.family
      ? '模型系列不同'
      : '模型主要版本不同';

    return {
      level: 'mismatch',
      label: '🚨 模型版本明显不一致',
      description: `${reason}。可能原因包括 API 服务商模型映射、中转修改模型或模型名称与实际路由不一致。`
    };
  }

  return {
    level: 'mapping',
    label: '⚠️ 可能存在模型映射',
    description: '返回名称与请求名称不同，但现有信息不足以确认版本冲突，建议结合输出质量和服务商说明进一步核实。'
  };
}

module.exports = {
  detectModelConsistency,
  normalizeModelName,
  parseModelIdentity
};
