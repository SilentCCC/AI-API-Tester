(function exposeSiteManager(globalScope) {
  const STORAGE_KEY = 'ai-api-tester.sites.v1';

  function normalizeEndpoint(endpoint) {
    const value = String(endpoint || '').trim().replace(/\/+$/, '');
    const url = new URL(value);
    if (!['http:', 'https:'].includes(url.protocol)) {
      throw new Error('Endpoint 仅支持 HTTP 或 HTTPS。');
    }
    return value;
  }

  function parseQuickFillInput(input) {
    const value = String(input || '').trim();
    if (!value) throw new Error('请粘贴包含 API Key 和 URL 的内容。');

    const markdownUrlMatch = value.match(/\]\(\s*(https?:\/\/[^)\s]+)\s*\)/i);
    const urlMatch = markdownUrlMatch || value.match(/https?:\/\/[^\s)]+/i);
    if (!urlMatch) throw new Error('未识别到 HTTP 或 HTTPS URL。');
    const rawUrl = markdownUrlMatch ? markdownUrlMatch[1] : urlMatch[0];

    const apiKeyMatch = value
      .replace(rawUrl, ' ')
      .match(/sk-[^\s\]})>,，。！？；："'“”‘’]+/i);
    const apiKey = apiKeyMatch?.[0]?.replace(/[.,;，。！？；：]+$/, '');
    if (!apiKey) throw new Error('未识别到以 sk- 开头的 API Key。');

    let url;
    try {
      url = new URL(rawUrl.replace(/[.,;]+$/, ''));
    } catch {
      throw new Error('URL 格式无效。');
    }
    if (!['http:', 'https:'].includes(url.protocol)) {
      throw new Error('URL 仅支持 HTTP 或 HTTPS。');
    }

    const hostnameParts = url.hostname.split('.').filter(Boolean);
    const name = hostnameParts.length >= 2
      ? hostnameParts[hostnameParts.length - 2]
      : hostnameParts[0];
    if (!name) throw new Error('无法从 URL 识别站点名称。');

    const basePath = url.pathname.replace(/\/+$/, '');
    const endpoint = `${url.origin}${basePath && /\/v1$/i.test(basePath) ? basePath : `${basePath}/v1`}`;
    return { name, endpoint, apiKey };
  }

  function createSite(input, idFactory = () => globalScope.crypto.randomUUID()) {
    const name = String(input.name || '').trim();
    const apiKey = String(input.apiKey || '').trim();

    if (!name || !apiKey) {
      throw new Error('请填写站点名称、Endpoint 和 API Key。');
    }

    return {
      id: input.id || idFactory(),
      name,
      endpoint: normalizeEndpoint(input.endpoint),
      apiKey
    };
  }

  function loadSites(storage = globalScope.localStorage) {
    try {
      const sites = JSON.parse(storage.getItem(STORAGE_KEY) || '[]');
      return Array.isArray(sites) ? sites : [];
    } catch {
      return [];
    }
  }

  function saveSites(sites, storage = globalScope.localStorage) {
    storage.setItem(STORAGE_KEY, JSON.stringify(sites));
  }

  function createExportConfig(sites) {
    return {
      apis: sites.map((site) => ({
        name: String(site.name || '').trim(),
        endpoint: normalizeEndpoint(site.endpoint),
        apiKey: String(site.apiKey || '').trim()
      }))
    };
  }

  function parseImportConfig(config, idFactory = () => globalScope.crypto.randomUUID()) {
    if (!config || typeof config !== 'object' || Array.isArray(config) || !Array.isArray(config.apis)) {
      throw new Error('配置文件格式错误：根对象必须包含 apis 数组。');
    }

    return config.apis.map((api, index) => {
      if (!api || typeof api !== 'object' || Array.isArray(api)) {
        throw new Error(`配置文件格式错误：第 ${index + 1} 个 API 配置不是有效对象。`);
      }

      try {
        return createSite(api, idFactory);
      } catch (error) {
        throw new Error(`第 ${index + 1} 个 API 配置无效：${error.message}`);
      }
    });
  }

  function findDuplicateEndpoints(existingSites, importedSites) {
    const existingEndpoints = new Set(existingSites.map((site) => normalizeEndpoint(site.endpoint)));
    return [...new Set(importedSites
      .map((site) => normalizeEndpoint(site.endpoint))
      .filter((endpoint) => existingEndpoints.has(endpoint)))];
  }

  function mergeImportedSites(existingSites, importedSites, overwriteDuplicates = false) {
    if (!overwriteDuplicates) return [...existingSites, ...importedSites];

    const importedEndpoints = new Set(importedSites.map((site) => normalizeEndpoint(site.endpoint)));
    const retainedSites = existingSites.filter((site) => !importedEndpoints.has(normalizeEndpoint(site.endpoint)));
    return [...retainedSites, ...importedSites];
  }

  function moveSite(sites, siteId, offset) {
    const currentIndex = sites.findIndex((site) => site.id === siteId);
    const targetIndex = currentIndex + offset;
    if (currentIndex < 0 || targetIndex < 0 || targetIndex >= sites.length) return [...sites];

    const reordered = [...sites];
    [reordered[currentIndex], reordered[targetIndex]] = [reordered[targetIndex], reordered[currentIndex]];
    return reordered;
  }

  function reorderSite(sites, sourceId, targetId, placement = 'before') {
    if (sourceId === targetId) return [...sites];

    const sourceIndex = sites.findIndex((site) => site.id === sourceId);
    const targetIndex = sites.findIndex((site) => site.id === targetId);
    if (sourceIndex < 0 || targetIndex < 0) return [...sites];

    const reordered = [...sites];
    const [sourceSite] = reordered.splice(sourceIndex, 1);
    const adjustedTargetIndex = reordered.findIndex((site) => site.id === targetId);
    const insertIndex = placement === 'after' ? adjustedTargetIndex + 1 : adjustedTargetIndex;
    reordered.splice(insertIndex, 0, sourceSite);
    return reordered;
  }

  function buildSiteModelTasks(sites, models) {
    return sites.flatMap((site) => models.map((model) => ({
      id: `${site.id}::${model}`,
      site,
      model
    })));
  }

  const api = {
    STORAGE_KEY,
    buildSiteModelTasks,
    createExportConfig,
    createSite,
    findDuplicateEndpoints,
    loadSites,
    mergeImportedSites,
    moveSite,
    normalizeEndpoint,
    parseQuickFillInput,
    parseImportConfig,
    reorderSite,
    saveSites
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  } else {
    globalScope.SiteManager = api;
  }
}(typeof globalThis !== 'undefined' ? globalThis : this));
