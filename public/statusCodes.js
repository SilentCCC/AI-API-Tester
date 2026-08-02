(function exposeStatusCodes(globalScope) {
  const STATUS_CODES = Object.freeze({
    200: {
      icon: '✅',
      label: '请求成功',
      level: 'success',
      description: 'API 请求成功。'
    },
    201: {
      icon: '✅',
      label: '已创建',
      level: 'success',
      description: '请求成功并创建资源。'
    },
    400: {
      icon: '❌',
      label: '请求错误',
      level: 'error',
      description: '参数错误、模型名称错误或请求格式错误。',
      suggestion: '请检查请求参数、模型名称和请求格式。'
    },
    401: {
      icon: '❌',
      label: '未授权',
      level: 'error',
      description: 'API Key 错误、Key 无效或已经过期。',
      suggestion: '请检查 API Key。'
    },
    402: {
      icon: '⚠️',
      label: '需要付费',
      level: 'warning',
      description: '余额不足或账户需要充值。',
      suggestion: '请检查账户余额和付费状态。'
    },
    403: {
      icon: '❌',
      label: '禁止访问',
      level: 'error',
      description: 'API Key 有效，但没有当前接口或模型的调用权限。',
      suggestion: '请检查 Key 权限和模型授权。'
    },
    404: {
      icon: '❌',
      label: '不存在',
      level: 'error',
      description: 'Endpoint 错误或模型不存在。',
      suggestion: '请检查 Endpoint 和模型名称。'
    },
    408: {
      icon: '⚠️',
      label: '请求超时',
      level: 'warning',
      description: '服务器响应超时。',
      suggestion: '请稍后重试或检查 API 服务状态。'
    },
    413: {
      icon: '⚠️',
      label: '内容过大',
      level: 'warning',
      description: '输入内容超过接口限制。',
      suggestion: '请缩短输入内容或减少请求数据。'
    },
    422: {
      icon: '⚠️',
      label: '参数无法处理',
      level: 'warning',
      description: '请求格式正确，但参数无法执行。',
      suggestion: '请检查模型支持的参数范围。'
    },
    429: {
      icon: '⚠️',
      label: '请求过多',
      level: 'warning',
      description: '触发 API 限流或额度不足。',
      suggestion: '请降低请求频率，并检查额度和余额。'
    },
    500: {
      icon: '❌',
      label: '服务器错误',
      level: 'error',
      description: 'API 服务内部错误。',
      suggestion: '请稍后重试或联系 API 服务商。'
    },
    502: {
      icon: '❌',
      label: '网关错误',
      level: 'error',
      description: '中转服务器或上游网关异常。',
      suggestion: '请检查中转服务状态或稍后重试。'
    },
    503: {
      icon: '⚠️',
      label: '服务不可用',
      level: 'warning',
      description: '服务器暂时不可用。',
      suggestion: '请稍后重试。'
    },
    504: {
      icon: '⚠️',
      label: '网关超时',
      level: 'warning',
      description: '上游服务响应超时。',
      suggestion: '请稍后重试或检查上游服务状态。'
    }
  });

  function getStatusCodeInfo(statusCode) {
    if (statusCode === null || statusCode === undefined || statusCode === '') {
      return null;
    }

    const code = Number(statusCode);
    if (!Number.isInteger(code)) {
      return null;
    }

    return STATUS_CODES[code] || {
      icon: '•',
      label: '未知状态',
      level: 'unknown',
      description: '当前状态码尚未配置详细说明。'
    };
  }

  const api = { STATUS_CODES, getStatusCodeInfo };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  } else {
    globalScope.StatusCodes = api;
  }
}(typeof globalThis !== 'undefined' ? globalThis : this));
