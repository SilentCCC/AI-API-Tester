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
    createSite,
    loadSites,
    normalizeEndpoint,
    saveSites
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  } else {
    globalScope.SiteManager = api;
  }
}(typeof globalThis !== 'undefined' ? globalThis : this));
