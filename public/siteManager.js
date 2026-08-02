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
    parseImportConfig,
    saveSites
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  } else {
    globalScope.SiteManager = api;
  }
}(typeof globalThis !== 'undefined' ? globalThis : this));
