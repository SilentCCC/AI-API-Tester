const multiSiteElements = {
  serviceBadge: document.querySelector('#service-badge'),
  serviceMessage: document.querySelector('#service-message'),
  siteForm: document.querySelector('#site-form'),
  editingSiteId: document.querySelector('#editing-site-id'),
  siteName: document.querySelector('#site-name'),
  siteEndpoint: document.querySelector('#site-endpoint'),
  siteApiKey: document.querySelector('#site-api-key'),
  siteNote: document.querySelector('#site-note'),
  siteEnabled: document.querySelector('#site-enabled'),
  saveSite: document.querySelector('#save-site'),
  cancelSiteEdit: document.querySelector('#cancel-site-edit'),
  siteMessage: document.querySelector('#site-message'),
  importConfig: document.querySelector('#import-config'),
  exportConfig: document.querySelector('#export-config'),
  configImportFile: document.querySelector('#config-import-file'),
  configDialog: document.querySelector('#config-dialog'),
  configDialogTitle: document.querySelector('#config-dialog-title'),
  configDialogMessage: document.querySelector('#config-dialog-message'),
  configDialogDetails: document.querySelector('#config-dialog-details'),
  configDialogCancel: document.querySelector('#config-dialog-cancel'),
  configDialogConfirm: document.querySelector('#config-dialog-confirm'),
  selectedSiteCount: document.querySelector('#selected-site-count'),
  selectAllSites: document.querySelector('#select-all-sites'),
  clearSites: document.querySelector('#clear-sites'),
  siteList: document.querySelector('#site-list'),
  loadSiteModels: document.querySelector('#load-site-models'),
  selectAllSiteModels: document.querySelector('#select-all-site-models'),
  clearSiteModels: document.querySelector('#clear-site-models'),
  multiSiteModelCount: document.querySelector('#multi-site-model-count'),
  multiSiteModelSearch: document.querySelector('#multi-site-model-search'),
  multiSiteModelList: document.querySelector('#multi-site-model-list'),
  siteModelLoadSummary: document.querySelector('#site-model-load-summary'),
  startMultiSiteTest: document.querySelector('#start-multi-site-test'),
  stopMultiSiteTest: document.querySelector('#stop-multi-site-test'),
  multiSiteProgress: document.querySelector('#multi-site-progress'),
  multiSiteResultBadge: document.querySelector('#multi-site-result-badge'),
  multiSiteResultEmpty: document.querySelector('#multi-site-result-empty'),
  multiSiteResultContent: document.querySelector('#multi-site-result-content'),
  multiSiteResultBody: document.querySelector('#multi-site-result-body')
};

const MULTI_SITE_CONCURRENCY = 3;
let apiSites = SiteManager.loadSites();
let selectedSiteIds = new Set();
let aggregatedSiteModels = [];
let selectedSiteModels = new Set();
let multiSiteController = null;
let multiSiteRunning = false;
let siteModelsLoading = false;
let httpTooltipHideTimer = null;
let configDialogResolver = null;

async function checkLocalService() {
  try {
    const response = await fetch('/api/health');
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const result = await response.json();
    multiSiteElements.serviceBadge.textContent = '服务正常';
    multiSiteElements.serviceBadge.className = 'badge badge-success';
    multiSiteElements.serviceMessage.textContent = `${result.service} v${result.version} · 配置保存在当前浏览器本地`;
  } catch {
    multiSiteElements.serviceBadge.textContent = '连接失败';
    multiSiteElements.serviceBadge.className = 'badge badge-error';
    multiSiteElements.serviceMessage.textContent = '本地服务连接失败';
  }
}

async function multiSitePostJson(path, body, signal) {
  const response = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal
  });
  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    const error = new Error(payload.message || `请求失败（HTTP ${response.status}）`);
    error.payload = payload;
    error.status = response.status;
    throw error;
  }

  return payload;
}

function getSelectedSites() {
  return apiSites.filter((site) => selectedSiteIds.has(site.id));
}

function getFilteredAggregatedModels() {
  const keyword = multiSiteElements.multiSiteModelSearch.value.trim().toLowerCase();
  return aggregatedSiteModels.filter((model) => model.toLowerCase().includes(keyword));
}

function maskApiKey(apiKey) {
  if (apiKey.length <= 8) return '••••••••';
  return `${apiKey.slice(0, 4)}••••${apiKey.slice(-4)}`;
}

function setSiteMessage(message, type = '') {
  multiSiteElements.siteMessage.textContent = message;
  multiSiteElements.siteMessage.className = `form-message${type ? ` message-${type}` : ''}`;
}

function resetSiteForm() {
  multiSiteElements.siteForm.reset();
  multiSiteElements.editingSiteId.value = '';
  multiSiteElements.siteEnabled.checked = true;
  multiSiteElements.saveSite.textContent = '保存站点';
  multiSiteElements.cancelSiteEdit.hidden = true;
}

function closeConfigDialog(confirmed) {
  if (multiSiteElements.configDialog.hidden) return;
  multiSiteElements.configDialog.hidden = true;
  const resolver = configDialogResolver;
  configDialogResolver = null;
  resolver?.(confirmed);
}

function showConfigDialog({ title, message, details = '', confirmText = '确认', showCancel = true }) {
  if (configDialogResolver) closeConfigDialog(false);
  multiSiteElements.configDialogTitle.textContent = title;
  multiSiteElements.configDialogMessage.textContent = message;
  multiSiteElements.configDialogDetails.textContent = details;
  multiSiteElements.configDialogDetails.hidden = !details;
  multiSiteElements.configDialogConfirm.textContent = confirmText;
  multiSiteElements.configDialogCancel.hidden = !showCancel;
  multiSiteElements.configDialog.hidden = false;
  multiSiteElements.configDialogConfirm.focus();
  return new Promise((resolve) => {
    configDialogResolver = resolve;
  });
}

function downloadJsonFile(filename, data) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json;charset=utf-8' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(link.href), 0);
}

async function exportSiteConfig() {
  if (!apiSites.length) {
    await showConfigDialog({
      title: '没有可导出的配置',
      message: '请先保存至少一个 API 站点。',
      confirmText: '知道了',
      showCancel: false
    });
    return;
  }

  const confirmed = await showConfigDialog({
    title: '导出配置',
    message: '导出的文件包含 API Key，请妥善保管。\n请勿将配置文件上传到公开位置或发送给不可信的人员。',
    confirmText: '继续导出'
  });
  if (!confirmed) return;

  const config = SiteManager.createExportConfig(apiSites);
  const date = new Date().toISOString().slice(0, 10);
  downloadJsonFile(`ai-api-tester-config-${date}.json`, config);
  setSiteMessage(`已导出 ${apiSites.length} 个 API 站点配置。`, 'success');
}

async function importSiteConfig(file) {
  let importedSites;
  try {
    const content = await file.text();
    importedSites = SiteManager.parseImportConfig(JSON.parse(content));
  } catch (error) {
    await showConfigDialog({
      title: '导入失败',
      message: error instanceof SyntaxError ? 'JSON 格式错误，请检查文件内容。' : error.message,
      confirmText: '知道了',
      showCancel: false
    });
    return;
  }

  const duplicateEndpoints = SiteManager.findDuplicateEndpoints(apiSites, importedSites);
  let overwriteDuplicates = false;
  if (duplicateEndpoints.length) {
    overwriteDuplicates = await showConfigDialog({
      title: '检测到重复 API 地址',
      message: '检测到相同 API 地址，是否覆盖？\n选择“覆盖”将使用导入文件中的配置替换现有配置。',
      details: duplicateEndpoints.join('\n'),
      confirmText: '覆盖'
    });
    if (!overwriteDuplicates) {
      setSiteMessage('已取消导入，现有配置未修改。');
      return;
    }
  }

  apiSites = SiteManager.mergeImportedSites(apiSites, importedSites, overwriteDuplicates);
  SiteManager.saveSites(apiSites);
  selectedSiteIds = new Set([...selectedSiteIds].filter((id) => apiSites.some((site) => site.id === id)));
  invalidateAggregatedModels();
  resetSiteForm();
  renderSites();
  setSiteMessage(`已导入 ${importedSites.length} 个 API 站点配置。`, 'success');
}

function invalidateAggregatedModels() {
  aggregatedSiteModels = [];
  selectedSiteModels.clear();
  multiSiteElements.multiSiteModelSearch.value = '';
  multiSiteElements.multiSiteModelSearch.disabled = true;
  multiSiteElements.siteModelLoadSummary.hidden = true;
  renderAggregatedModels([]);
}

function updateSiteControls() {
  const siteCount = apiSites.length;
  const selectedCount = selectedSiteIds.size;
  multiSiteElements.selectedSiteCount.textContent = selectedCount;
  const siteControlsLocked = multiSiteRunning || siteModelsLoading;
  multiSiteElements.selectAllSites.disabled = siteCount === 0 || siteControlsLocked;
  multiSiteElements.clearSites.disabled = selectedCount === 0 || siteControlsLocked;
  multiSiteElements.loadSiteModels.disabled = selectedCount === 0 || siteControlsLocked;
  multiSiteElements.saveSite.disabled = siteControlsLocked;
  multiSiteElements.importConfig.disabled = siteControlsLocked;
  multiSiteElements.exportConfig.disabled = siteCount === 0 || siteControlsLocked;
  updateMultiSiteModelControls();
}

function renderSites() {
  multiSiteElements.siteList.replaceChildren();

  if (!apiSites.length) {
    const empty = document.createElement('div');
    empty.className = 'list-empty';
    empty.textContent = '还没有保存 API 站点。';
    multiSiteElements.siteList.append(empty);
    updateSiteControls();
    return;
  }

  const fragment = document.createDocumentFragment();
  for (const site of apiSites) {
    const card = document.createElement('article');
    card.className = 'site-card';

    const selectLabel = document.createElement('label');
    selectLabel.className = 'site-select';
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = selectedSiteIds.has(site.id);
    checkbox.disabled = multiSiteRunning || siteModelsLoading;
    checkbox.addEventListener('change', () => {
      if (checkbox.checked) selectedSiteIds.add(site.id);
      else selectedSiteIds.delete(site.id);
      invalidateAggregatedModels();
      updateSiteControls();
    });
    const name = document.createElement('strong');
    name.textContent = site.name;
    selectLabel.append(checkbox, name);

    const endpoint = document.createElement('span');
    endpoint.className = 'site-endpoint';
    endpoint.textContent = site.endpoint;
    endpoint.title = site.endpoint;

    const key = document.createElement('span');
    key.className = 'site-key';
    key.textContent = `API Key：${maskApiKey(site.apiKey)}`;

    const note = document.createElement('span');
    note.className = 'site-note';
    note.textContent = site.note || '无备注';

    const meta = document.createElement('div');
    meta.className = 'site-meta';
    const status = document.createElement('span');
    status.className = `site-status site-status-${site.enabled === false ? 'disabled' : 'enabled'}`;
    status.textContent = site.enabled === false ? '已停用' : '已启用';
    const createdAt = document.createElement('span');
    createdAt.textContent = `创建：${new Date(site.createdAt).toLocaleString()}`;
    meta.append(status, createdAt);

    const actions = document.createElement('div');
    actions.className = 'site-card-actions';
    const editButton = document.createElement('button');
    editButton.className = 'button button-secondary button-small';
    editButton.type = 'button';
    editButton.textContent = '编辑';
    editButton.disabled = multiSiteRunning || siteModelsLoading;
    editButton.addEventListener('click', () => editSite(site));
    const deleteButton = document.createElement('button');
    deleteButton.className = 'button button-danger button-small';
    deleteButton.type = 'button';
    deleteButton.textContent = '删除';
    deleteButton.disabled = multiSiteRunning || siteModelsLoading;
    deleteButton.addEventListener('click', () => deleteSite(site.id));
    actions.append(editButton, deleteButton);

    card.append(selectLabel, endpoint, key, note, meta, actions);
    fragment.append(card);
  }

  multiSiteElements.siteList.append(fragment);
  updateSiteControls();
}

function editSite(site) {
  multiSiteElements.editingSiteId.value = site.id;
  multiSiteElements.siteName.value = site.name;
  multiSiteElements.siteEndpoint.value = site.endpoint;
  multiSiteElements.siteApiKey.value = site.apiKey;
  multiSiteElements.siteNote.value = site.note || '';
  multiSiteElements.siteEnabled.checked = site.enabled !== false;
  multiSiteElements.saveSite.textContent = '更新站点';
  multiSiteElements.cancelSiteEdit.hidden = false;
  setSiteMessage(`正在编辑：${site.name}`);
}

function deleteSite(siteId) {
  apiSites = apiSites.filter((site) => site.id !== siteId);
  selectedSiteIds.delete(siteId);
  SiteManager.saveSites(apiSites);
  invalidateAggregatedModels();
  resetSiteForm();
  renderSites();
  setSiteMessage('站点已删除。', 'success');
}

function updateMultiSiteModelControls() {
  const selectedModelCount = selectedSiteModels.size;
  multiSiteElements.multiSiteModelCount.textContent = selectedModelCount;
  multiSiteElements.selectAllSiteModels.disabled = aggregatedSiteModels.length === 0 || multiSiteRunning;
  multiSiteElements.clearSiteModels.disabled = selectedModelCount === 0 || multiSiteRunning;
  multiSiteElements.startMultiSiteTest.disabled = selectedSiteIds.size === 0
    || selectedModelCount === 0
    || multiSiteRunning;
}

function renderAggregatedModels(models) {
  multiSiteElements.multiSiteModelList.replaceChildren();

  if (!models.length) {
    const empty = document.createElement('div');
    empty.className = 'list-empty';
    empty.textContent = aggregatedSiteModels.length ? '没有匹配的模型。' : '请选择站点并获取模型。';
    multiSiteElements.multiSiteModelList.append(empty);
    updateMultiSiteModelControls();
    return;
  }

  const fragment = document.createDocumentFragment();
  for (const model of models) {
    const label = document.createElement('label');
    label.className = 'model-check-item';
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.value = model;
    checkbox.checked = selectedSiteModels.has(model);
    checkbox.disabled = multiSiteRunning;
    checkbox.addEventListener('change', () => {
      if (checkbox.checked) selectedSiteModels.add(model);
      else selectedSiteModels.delete(model);
      updateMultiSiteModelControls();
    });
    const name = document.createElement('span');
    name.textContent = model;
    label.append(checkbox, name);
    fragment.append(label);
  }

  multiSiteElements.multiSiteModelList.append(fragment);
  updateMultiSiteModelControls();
}

async function loadSelectedSiteModels() {
  const sites = getSelectedSites();
  if (!sites.length || multiSiteRunning) return;

  siteModelsLoading = true;
  renderSites();
  multiSiteElements.loadSiteModels.textContent = '获取中...';
  multiSiteElements.siteModelLoadSummary.hidden = false;
  multiSiteElements.siteModelLoadSummary.textContent = `正在获取 0/${sites.length} 个站点的模型...`;
  const modelSet = new Set();
  const summaries = [];
  let completed = 0;

  await BatchRunner.runWithConcurrency(sites, async (site) => {
    return multiSitePostJson('/api/models', {
      endpoint: site.endpoint,
      apiKey: site.apiKey
    });
  }, {
    concurrency: MULTI_SITE_CONCURRENCY,
    onItemFinish(error, result, site) {
      completed += 1;
      if (error) {
        summaries.push({ success: false, site: site.name, message: error.message });
      } else {
        result.models.forEach((model) => modelSet.add(model));
        summaries.push({
          success: true,
          site: site.name,
          count: result.count,
          models: result.models
        });
      }
      multiSiteElements.siteModelLoadSummary.textContent = `正在获取 ${completed}/${sites.length} 个站点的模型...`;
    }
  });

  aggregatedSiteModels = [...modelSet].sort((left, right) => left.localeCompare(right));
  selectedSiteModels = new Set([...selectedSiteModels].filter((model) => modelSet.has(model)));
  multiSiteElements.multiSiteModelSearch.disabled = aggregatedSiteModels.length === 0;
  multiSiteElements.multiSiteModelSearch.value = '';
  renderAggregatedModels(aggregatedSiteModels);

  multiSiteElements.siteModelLoadSummary.replaceChildren();
  for (const summary of summaries) {
    const item = summary.success
      ? createSiteModelSummary(summary)
      : createSiteModelLoadError(summary);
    multiSiteElements.siteModelLoadSummary.append(item);
  }
  multiSiteElements.loadSiteModels.textContent = '获取所选站点模型';
  siteModelsLoading = false;
  renderSites();
  updateSiteControls();
}

function createSiteModelLoadError(summary) {
  const item = document.createElement('span');
  item.className = 'load-error';
  item.textContent = `${summary.site}：${summary.message}`;
  return item;
}

function createSiteModelSummary(summary) {
  const wrapper = document.createElement('span');
  wrapper.className = 'site-model-summary';

  const trigger = document.createElement('button');
  trigger.className = 'site-model-summary-trigger';
  trigger.type = 'button';
  trigger.textContent = `${summary.site}：${summary.count} 个模型`;
  trigger.setAttribute('aria-label', `查看 ${summary.site} 的模型列表`);

  const tooltip = document.createElement('span');
  tooltip.className = 'site-model-tooltip';
  tooltip.setAttribute('role', 'tooltip');

  const title = document.createElement('strong');
  title.textContent = summary.site;
  const count = document.createElement('span');
  count.className = 'site-model-tooltip-count';
  count.textContent = `已获取模型（${summary.count}）`;
  const list = document.createElement('ul');
  list.className = 'site-model-tooltip-list';
  tooltip.append(title, count, list);

  list.replaceChildren(...summary.models.map((model) => {
    const item = document.createElement('li');
    item.textContent = model;
    return item;
  }));

  wrapper.append(trigger, tooltip);
  return wrapper;
}

function normalizeMultiSiteError(error, task) {
  return {
    success: false,
    requestedModel: error.payload?.requestedModel || task.model,
    returnedModel: error.payload?.returnedModel || null,
    consistency: error.payload?.consistency || {
      level: 'unknown',
      label: '❓ 无法判断',
      description: '测试失败，返回信息不足以判断模型一致性。'
    },
    httpStatus: error.payload?.httpStatus || error.status,
    responseTime: error.payload?.responseTime,
    content: error.payload?.content || '',
    message: error.message
  };
}

function createMultiSiteResultRow(task) {
  const row = document.createElement('tr');
  const cells = {
    site: document.createElement('td'),
    endpoint: document.createElement('td'),
    requested: document.createElement('td'),
    returned: document.createElement('td'),
    consistency: document.createElement('td'),
    status: document.createElement('td'),
    time: document.createElement('td'),
    http: document.createElement('td'),
    content: document.createElement('td'),
    error: document.createElement('td')
  };
  cells.site.textContent = task.site.name;
  cells.endpoint.textContent = task.site.endpoint;
  cells.endpoint.title = task.site.endpoint;
  cells.endpoint.className = 'endpoint-cell';
  cells.requested.textContent = task.model;
  cells.returned.textContent = '—';
  cells.consistency.textContent = '等待测试';
  cells.status.textContent = '排队中';
  cells.time.textContent = '—';
  cells.http.textContent = '—';
  cells.content.textContent = '等待测试';
  cells.error.textContent = '—';
  row.append(...Object.values(cells));
  multiSiteElements.multiSiteResultBody.append(row);
  return { row, cells };
}

function setMultiSiteRowRunning(rowState) {
  rowState.row.className = 'row-running';
  rowState.cells.status.textContent = '测试中';
}

function setMultiSiteRowStopped(rowState) {
  rowState.row.className = 'row-stopped';
  rowState.cells.consistency.textContent = '❓ 无法判断';
  rowState.cells.status.textContent = '已停止';
  rowState.cells.content.textContent = '测试未完成';
  rowState.cells.error.textContent = '测试已由用户停止';
}

function renderResponseContent(cell, content) {
  const value = content || '无返回内容';
  const details = document.createElement('details');
  details.className = 'response-details';
  const summary = document.createElement('summary');
  summary.textContent = '查看内容';
  const output = document.createElement('pre');
  output.className = 'batch-response';
  output.textContent = value;
  details.append(summary, output);
  cell.replaceChildren(details);
}

function getHttpStatusTooltip() {
  let tooltip = document.querySelector('#http-status-tooltip');
  if (tooltip) return tooltip;

  tooltip = document.createElement('div');
  tooltip.id = 'http-status-tooltip';
  tooltip.className = 'http-status-tooltip';
  tooltip.setAttribute('role', 'tooltip');
  tooltip.hidden = true;
  tooltip.addEventListener('mouseenter', () => clearTimeout(httpTooltipHideTimer));
  tooltip.addEventListener('mouseleave', hideHttpStatusTooltip);
  document.body.append(tooltip);
  return tooltip;
}

function showHttpStatusTooltip(trigger, statusCode, info) {
  clearTimeout(httpTooltipHideTimer);
  const tooltip = getHttpStatusTooltip();
  const title = document.createElement('strong');
  title.textContent = `HTTP ${statusCode} ${info.label}`;
  const description = document.createElement('span');
  description.textContent = `说明：${info.description}`;
  tooltip.replaceChildren(title, description);

  if (info.suggestion) {
    const suggestion = document.createElement('span');
    suggestion.className = 'http-status-suggestion';
    suggestion.textContent = `建议：${info.suggestion}`;
    tooltip.append(suggestion);
  }

  tooltip.hidden = false;
  tooltip.dataset.placement = 'top';
  tooltip.classList.add('is-visible');

  const triggerRect = trigger.getBoundingClientRect();
  const tooltipRect = tooltip.getBoundingClientRect();
  const viewportPadding = 12;
  let left = triggerRect.left + (triggerRect.width - tooltipRect.width) / 2;
  left = Math.max(viewportPadding, Math.min(left, window.innerWidth - tooltipRect.width - viewportPadding));
  let top = triggerRect.top - tooltipRect.height - 10;

  if (top < viewportPadding) {
    top = triggerRect.bottom + 10;
    tooltip.dataset.placement = 'bottom';
  }

  tooltip.style.left = `${left}px`;
  tooltip.style.top = `${top}px`;
  tooltip.style.setProperty('--http-tooltip-arrow-left', `${triggerRect.left + triggerRect.width / 2 - left}px`);
}

function hideHttpStatusTooltip() {
  clearTimeout(httpTooltipHideTimer);
  httpTooltipHideTimer = setTimeout(() => {
    const tooltip = document.querySelector('#http-status-tooltip');
    if (!tooltip) return;
    tooltip.classList.remove('is-visible');
    setTimeout(() => {
      if (!tooltip.classList.contains('is-visible')) tooltip.hidden = true;
    }, 140);
  }, 80);
}

function renderHttpStatus(cell, statusCode) {
  const info = StatusCodes.getStatusCodeInfo(statusCode);
  if (!info) {
    cell.textContent = '未知';
    return;
  }

  const trigger = document.createElement('button');
  trigger.className = `http-status-trigger http-status-${info.level}`;
  trigger.type = 'button';
  trigger.textContent = `${info.icon} ${statusCode} ${info.label}`;
  trigger.setAttribute('aria-label', `查看 HTTP ${statusCode} ${info.label} 的说明`);
  trigger.addEventListener('mouseenter', () => showHttpStatusTooltip(trigger, statusCode, info));
  trigger.addEventListener('mouseleave', hideHttpStatusTooltip);
  trigger.addEventListener('focus', () => showHttpStatusTooltip(trigger, statusCode, info));
  trigger.addEventListener('blur', hideHttpStatusTooltip);
  cell.replaceChildren(trigger);
}

function renderMultiSiteResultRow(rowState, result) {
  const consistency = result.consistency;
  rowState.row.className = result.success ? 'row-success' : 'row-error';
  rowState.cells.returned.textContent = result.returnedModel || '未知';
  const consistencyElement = document.createElement('span');
  consistencyElement.className = `consistency consistency-${consistency.level}`;
  consistencyElement.textContent = consistency.label;
  consistencyElement.title = consistency.description;
  rowState.cells.consistency.replaceChildren(consistencyElement);
  rowState.cells.status.textContent = result.success ? '✅ 可用' : '❌ 失败';
  renderHttpStatus(rowState.cells.http, result.httpStatus);
  rowState.cells.time.textContent = Number.isFinite(result.responseTime) ? `${result.responseTime} ms` : '未知';
  renderResponseContent(rowState.cells.content, result.content);
  rowState.cells.error.textContent = result.success ? '无' : (result.message || '未知错误');
}

function setMultiSiteRunning(running) {
  multiSiteRunning = running;
  multiSiteElements.stopMultiSiteTest.disabled = !running;
  renderSites();
  renderAggregatedModels(getFilteredAggregatedModels());
  updateSiteControls();
}

async function startMultiSiteTest() {
  const sites = getSelectedSites();
  const models = [...selectedSiteModels];
  if (!sites.length || !models.length || multiSiteRunning) return;

  const tasks = SiteManager.buildSiteModelTasks(sites, models);
  multiSiteController = new AbortController();
  setMultiSiteRunning(true);
  multiSiteElements.multiSiteResultEmpty.hidden = true;
  multiSiteElements.multiSiteResultContent.hidden = false;
  multiSiteElements.multiSiteResultBody.replaceChildren();
  multiSiteElements.multiSiteResultBadge.textContent = '测试中';
  multiSiteElements.multiSiteResultBadge.className = 'badge badge-pending';
  const rows = new Map(tasks.map((task) => [task.id, createMultiSiteResultRow(task)]));
  let started = 0;
  let completed = 0;
  multiSiteElements.multiSiteProgress.textContent = `正在测试 0/${tasks.length}`;

  await BatchRunner.runWithConcurrency(tasks, async (task) => {
    return multiSitePostJson('/api/test-model', {
      endpoint: task.site.endpoint,
      apiKey: task.site.apiKey,
      model: task.model
    }, multiSiteController.signal);
  }, {
    concurrency: MULTI_SITE_CONCURRENCY,
    signal: multiSiteController.signal,
    onItemStart(task) {
      started += 1;
      setMultiSiteRowRunning(rows.get(task.id));
      multiSiteElements.multiSiteProgress.textContent = `正在测试 ${started}/${tasks.length}（已完成 ${completed}）`;
    },
    onItemFinish(error, result, task) {
      if (error?.name === 'AbortError') {
        setMultiSiteRowStopped(rows.get(task.id));
        return;
      }
      renderMultiSiteResultRow(rows.get(task.id), error ? normalizeMultiSiteError(error, task) : result);
      completed += 1;
      multiSiteElements.multiSiteProgress.textContent = `正在测试 ${started}/${tasks.length}（已完成 ${completed}）`;
    }
  });

  const stopped = multiSiteController.signal.aborted;
  for (const rowState of rows.values()) {
    if (!rowState.row.className) setMultiSiteRowStopped(rowState);
  }
  multiSiteElements.multiSiteProgress.textContent = stopped
    ? `测试已停止，完成 ${completed}/${tasks.length}`
    : `测试完成 ${completed}/${tasks.length}`;
  multiSiteElements.multiSiteResultBadge.textContent = stopped ? '已停止' : '测试完成';
  multiSiteElements.multiSiteResultBadge.className = `badge ${stopped ? 'badge-warning' : 'badge-success'}`;
  multiSiteController = null;
  setMultiSiteRunning(false);
}

function stopMultiSiteTest() {
  if (!multiSiteController || multiSiteController.signal.aborted) return;
  multiSiteElements.stopMultiSiteTest.disabled = true;
  multiSiteElements.multiSiteProgress.textContent = '正在停止测试...';
  multiSiteController.abort();
}

multiSiteElements.siteForm.addEventListener('submit', (event) => {
  event.preventDefault();
  try {
    const editingId = multiSiteElements.editingSiteId.value;
    const existingSite = apiSites.find((item) => item.id === editingId);
    const site = SiteManager.createSite({
      id: editingId || undefined,
      name: multiSiteElements.siteName.value,
      endpoint: multiSiteElements.siteEndpoint.value,
      apiKey: multiSiteElements.siteApiKey.value,
      note: multiSiteElements.siteNote.value,
      enabled: multiSiteElements.siteEnabled.checked,
      createdAt: existingSite?.createdAt
    });
    if (editingId) {
      apiSites = apiSites.map((item) => item.id === editingId ? site : item);
    } else {
      apiSites.push(site);
    }
    SiteManager.saveSites(apiSites);
    invalidateAggregatedModels();
    resetSiteForm();
    renderSites();
    setSiteMessage(editingId ? '站点已更新。' : '站点已保存。', 'success');
  } catch (error) {
    setSiteMessage(error.message, 'error');
  }
});

multiSiteElements.cancelSiteEdit.addEventListener('click', () => {
  resetSiteForm();
  setSiteMessage('已取消编辑。');
});

multiSiteElements.selectAllSites.addEventListener('click', () => {
  selectedSiteIds = new Set(apiSites.map((site) => site.id));
  invalidateAggregatedModels();
  renderSites();
});

multiSiteElements.clearSites.addEventListener('click', () => {
  selectedSiteIds.clear();
  invalidateAggregatedModels();
  renderSites();
});

multiSiteElements.importConfig.addEventListener('click', () => {
  multiSiteElements.configImportFile.value = '';
  multiSiteElements.configImportFile.click();
});
multiSiteElements.exportConfig.addEventListener('click', exportSiteConfig);
multiSiteElements.configImportFile.addEventListener('change', () => {
  const [file] = multiSiteElements.configImportFile.files;
  if (file) importSiteConfig(file);
});
multiSiteElements.configDialogCancel.addEventListener('click', () => closeConfigDialog(false));
multiSiteElements.configDialogConfirm.addEventListener('click', () => closeConfigDialog(true));
multiSiteElements.configDialog.addEventListener('click', (event) => {
  if (event.target === multiSiteElements.configDialog) closeConfigDialog(false);
});
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && !multiSiteElements.configDialog.hidden) closeConfigDialog(false);
});

multiSiteElements.loadSiteModels.addEventListener('click', loadSelectedSiteModels);
multiSiteElements.startMultiSiteTest.addEventListener('click', startMultiSiteTest);
multiSiteElements.stopMultiSiteTest.addEventListener('click', stopMultiSiteTest);
multiSiteElements.multiSiteModelSearch.addEventListener('input', () => {
  renderAggregatedModels(getFilteredAggregatedModels());
});
multiSiteElements.selectAllSiteModels.addEventListener('click', () => {
  selectedSiteModels = new Set(aggregatedSiteModels);
  renderAggregatedModels(getFilteredAggregatedModels());
});
multiSiteElements.clearSiteModels.addEventListener('click', () => {
  selectedSiteModels.clear();
  renderAggregatedModels(getFilteredAggregatedModels());
});

renderSites();
renderAggregatedModels([]);
checkLocalService();
