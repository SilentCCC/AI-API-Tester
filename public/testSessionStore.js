(function exposeTestSessionStore(globalScope) {
  const STORAGE_KEY = 'ai-api-tester.test-session.v1';
  const EMPTY_STATE = Object.freeze({
    selectedSiteIds: [],
    aggregatedSiteModels: [],
    selectedSiteModels: [],
    siteModelSummaries: [],
    independentSelections: {},
    resultRecords: [],
    independentResultRecords: [],
    testPrompt: 'Hello',
    batchStartedAt: null,
    progressText: '等待测试',
    badgeText: '等待测试',
    badgeClass: 'badge badge-pending'
  });

  function stringArray(value) {
    return Array.isArray(value)
      ? [...new Set(value.filter((item) => typeof item === 'string' && item))]
      : [];
  }

  function normalizeState(value) {
    const state = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
    return {
      selectedSiteIds: stringArray(state.selectedSiteIds),
      aggregatedSiteModels: stringArray(state.aggregatedSiteModels),
      selectedSiteModels: stringArray(state.selectedSiteModels),
      siteModelSummaries: Array.isArray(state.siteModelSummaries) ? state.siteModelSummaries : [],
      independentSelections: state.independentSelections && typeof state.independentSelections === 'object' && !Array.isArray(state.independentSelections)
        ? state.independentSelections
        : {},
      resultRecords: Array.isArray(state.resultRecords) ? state.resultRecords : [],
      independentResultRecords: Array.isArray(state.independentResultRecords) ? state.independentResultRecords : [],
      testPrompt: typeof state.testPrompt === 'string' && state.testPrompt.trim() ? state.testPrompt : EMPTY_STATE.testPrompt,
      batchStartedAt: typeof state.batchStartedAt === 'string' ? state.batchStartedAt : null,
      progressText: typeof state.progressText === 'string' ? state.progressText : EMPTY_STATE.progressText,
      badgeText: typeof state.badgeText === 'string' ? state.badgeText : EMPTY_STATE.badgeText,
      badgeClass: typeof state.badgeClass === 'string' ? state.badgeClass : EMPTY_STATE.badgeClass
    };
  }

  function load(storage = globalScope.localStorage) {
    try {
      return normalizeState(JSON.parse(storage.getItem(STORAGE_KEY) || '{}'));
    } catch {
      return normalizeState();
    }
  }

  function save(state, storage = globalScope.localStorage) {
    try {
      storage.setItem(STORAGE_KEY, JSON.stringify(normalizeState(state)));
      return true;
    } catch {
      return false;
    }
  }

  const api = { STORAGE_KEY, load, normalizeState, save };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  } else {
    globalScope.TestSessionStore = api;
  }
}(typeof globalThis !== 'undefined' ? globalThis : this));
