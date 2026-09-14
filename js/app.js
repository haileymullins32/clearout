// Clearout — all state lives in this browser's localStorage. Nothing here
// makes a network request except the initial fetch of data/brokers.json,
// which is bundled with the app itself.
'use strict';

const PROFILE_KEY = 'clearout_profile_v1';
const STATUS_KEY = 'clearout_status_v1';
const WELCOME_DISMISSED_KEY = 'clearout_welcome_dismissed_v1';

const PRIORITY_LABELS = { crucial: 'Crucial', high: 'High priority', normal: 'Normal' };
const PRIORITY_ORDER = ['crucial', 'high', 'normal'];

const STATUS_LABELS = {
  not_started: 'Not started',
  no_hit: 'No hit',
  found: 'Found',
  opt_out_requested: 'Opt-out requested',
  removed: 'Removed',
  needs_followup: 'Needs follow-up',
};
const STATUS_ORDER = Object.keys(STATUS_LABELS);

const CATEGORY_LABELS = {
  public_people_search: 'People search',
  non_public_broker: 'Data broker',
  search_engine: 'Search engine',
  other: 'Other',
};

const METHOD_LABELS = {
  form: 'Online form',
  email: 'Email',
  phone: 'Phone',
  mail: 'Physical mail',
  'form+email_confirm': 'Online form + email confirmation',
};

const PRIORITY_RANK = { crucial: 0, high: 1, normal: 2 };

const SORT_COMPARATORS = {
  priority: (a, b) => PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] || a.name.localeCompare(b.name),
  name: (a, b) => a.name.localeCompare(b.name),
  category: (a, b) =>
    (CATEGORY_LABELS[a.category] || a.category).localeCompare(CATEGORY_LABELS[b.category] || b.category) ||
    a.name.localeCompare(b.name),
  cost: (a, b) => Number(a.costs_money) - Number(b.costs_money) || a.name.localeCompare(b.name),
  requires_id: (a, b) => Number(a.requires_id) - Number(b.requires_id) || a.name.localeCompare(b.name),
};

const SIMPLE_PROFILE_FIELDS = ['full_name', 'other_names'];

const DEFAULT_RECHECK_DAYS = 90;
const MS_PER_DAY = 86400000;

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

// Recheck timer starts the day a broker is marked "Removed" (confirmed
// removed) and is null whenever that isn't the current status.
function getRecheckInfo(entry) {
  if (!entry || entry.status !== 'removed' || !entry.removed_date) return null;
  const days = entry.recheck_days || DEFAULT_RECHECK_DAYS;
  const removedDate = new Date(`${entry.removed_date}T00:00:00`);
  if (Number.isNaN(removedDate.getTime())) return null;
  const dueDate = new Date(removedDate.getTime() + days * MS_PER_DAY);
  const today = new Date(`${todayISO()}T00:00:00`);
  const daysUntilDue = Math.round((dueDate - today) / MS_PER_DAY);
  return {
    dueDateISO: dueDate.toISOString().slice(0, 10),
    daysUntilDue,
    isDue: daysUntilDue <= 0,
  };
}

let brokers = [];
let statusMap = {};

function loadProfile() {
  try {
    return JSON.parse(localStorage.getItem(PROFILE_KEY)) || {};
  } catch {
    return {};
  }
}

function saveProfile(profile) {
  localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
}

function loadStatusMap() {
  try {
    return JSON.parse(localStorage.getItem(STATUS_KEY)) || {};
  } catch {
    return {};
  }
}

function saveStatusMap() {
  localStorage.setItem(STATUS_KEY, JSON.stringify(statusMap));
}

function getEntry(brokerId) {
  return statusMap[brokerId] || { status: 'not_started', notes: '' };
}

function setEntry(brokerId, patch) {
  const current = getEntry(brokerId);
  statusMap[brokerId] = { ...current, ...patch, updated: new Date().toISOString().slice(0, 10) };
  saveStatusMap();
  updateWelcomePanel();
}

function fillTemplate(template, profile) {
  if (!template) return template;
  const nameParts = (profile.full_name || '').trim().split(/\s+/).filter(Boolean);
  const first = nameParts[0] || '';
  const last = nameParts.length > 1 ? nameParts[nameParts.length - 1] : '';
  const addresses = profile.addresses || [];
  const primaryAddress = addresses.find((a) => a.type === 'current') || addresses[0] || {};
  const state = (primaryAddress.state || '').trim();
  return template
    .replace(/\{first\}/gi, encodeURIComponent(first.toLowerCase()))
    .replace(/\{last\}/gi, encodeURIComponent(last.toLowerCase()))
    .replace(/\{state\}/gi, encodeURIComponent(state.toLowerCase()));
}

function createAddressRow(data = {}) {
  const tpl = document.getElementById('address-row-template');
  const row = tpl.content.firstElementChild.cloneNode(true);
  row.querySelector('.address-type').value = data.type || 'current';
  row.querySelector('.address-street').value = data.street || '';
  row.querySelector('.address-city').value = data.city || '';
  row.querySelector('.address-state').value = data.state || '';
  row.querySelector('.remove-row-btn').addEventListener('click', () => row.remove());
  return row;
}

function createSimpleRow(templateId, inputSelector, value = '') {
  const tpl = document.getElementById(templateId);
  const row = tpl.content.firstElementChild.cloneNode(true);
  row.querySelector(inputSelector).value = value;
  row.querySelector('.remove-row-btn').addEventListener('click', () => row.remove());
  return row;
}

function renderAddresses(addresses) {
  const container = document.getElementById('addresses-list');
  container.innerHTML = '';
  const list = addresses && addresses.length ? addresses : [{ type: 'current' }];
  for (const addr of list) container.appendChild(createAddressRow(addr));
}

function renderPhones(phones) {
  const container = document.getElementById('phones-list');
  container.innerHTML = '';
  const list = phones && phones.length ? phones : [''];
  for (const p of list) container.appendChild(createSimpleRow('phone-row-template', '.phone-input', p));
}

function renderEmails(emails) {
  const container = document.getElementById('emails-list');
  container.innerHTML = '';
  const list = emails && emails.length ? emails : [''];
  for (const e of list) container.appendChild(createSimpleRow('email-row-template', '.email-input', e));
}

function readAddresses() {
  const rows = document.querySelectorAll('#addresses-list .address-row');
  const result = [];
  for (const row of rows) {
    const type = row.querySelector('.address-type').value;
    const street = row.querySelector('.address-street').value.trim();
    const city = row.querySelector('.address-city').value.trim();
    const state = row.querySelector('.address-state').value.trim().toUpperCase();
    if (!street && !city && !state) continue;
    result.push({ type, street, city, state });
  }
  return result;
}

function readSimpleList(containerId, inputSelector) {
  const rows = document.querySelectorAll(`#${containerId} .simple-row`);
  const result = [];
  for (const row of rows) {
    const val = row.querySelector(inputSelector).value.trim();
    if (val) result.push(val);
  }
  return result;
}

function profileHasName(profile) {
  return !!(profile && profile.full_name && profile.full_name.trim());
}

function summarizeProfile(profile) {
  const parts = [];
  const addrCount = (profile.addresses || []).length;
  const phoneCount = (profile.phones || []).length;
  const emailCount = (profile.emails || []).length;
  if (addrCount) parts.push(`${addrCount} address${addrCount > 1 ? 'es' : ''}`);
  if (phoneCount) parts.push(`${phoneCount} phone${phoneCount > 1 ? 's' : ''}`);
  if (emailCount) parts.push(`${emailCount} email${emailCount > 1 ? 's' : ''}`);
  return parts.join(' · ');
}

// Once a name is saved, the profile collapses to a quiet summary line so it
// doesn't dominate the page on repeat visits. `forceExpanded` reopens it.
function syncProfilePanel(profile, { forceExpanded = false } = {}) {
  const hasName = profileHasName(profile);
  const expanded = forceExpanded || !hasName;
  document.getElementById('profile-summary').hidden = expanded;
  document.getElementById('profile-form-wrap').hidden = !expanded;
  if (!expanded) {
    const extra = summarizeProfile(profile);
    const summaryEl = document.getElementById('profile-summary-text');
    summaryEl.textContent = '';
    const strong = document.createElement('strong');
    strong.textContent = profile.full_name;
    summaryEl.appendChild(strong);
    if (extra) {
      const span = document.createElement('span');
      span.className = 'muted-part';
      span.textContent = ` · ${extra}`;
      summaryEl.appendChild(span);
    }
  }
}

function updateCaCallout(profile) {
  const isCurrentlyCA = (profile.addresses || []).some(
    (a) => a.type === 'current' && (a.state || '').toUpperCase() === 'CA'
  );
  document.getElementById('ca-callout').hidden = !isCurrentlyCA;
}

function updateWelcomePanel() {
  const dismissed = localStorage.getItem(WELCOME_DISMISSED_KEY) === '1';
  const hasName = profileHasName(loadProfile());
  const hasAnyStatus = Object.keys(statusMap).length > 0;
  document.getElementById('welcome-panel').hidden = dismissed || hasName || hasAnyStatus;
}

function dismissWelcome() {
  localStorage.setItem(WELCOME_DISMISSED_KEY, '1');
  document.getElementById('welcome-panel').hidden = true;
}

function populateProfileForm(profile) {
  for (const field of SIMPLE_PROFILE_FIELDS) {
    const el = document.getElementById(field);
    if (el) el.value = profile[field] || '';
  }
  renderAddresses(profile.addresses);
  renderPhones(profile.phones);
  renderEmails(profile.emails);
}

function readProfileForm() {
  const profile = {};
  for (const field of SIMPLE_PROFILE_FIELDS) {
    const el = document.getElementById(field);
    profile[field] = el ? el.value.trim() : '';
  }
  profile.addresses = readAddresses();
  profile.phones = readSimpleList('phones-list', '.phone-input');
  profile.emails = readSimpleList('emails-list', '.email-input');
  return profile;
}

function renderSummary() {
  const counts = {};
  for (const s of STATUS_ORDER) counts[s] = 0;
  for (const b of brokers) {
    const status = getEntry(b.id).status;
    counts[status] = (counts[status] || 0) + 1;
  }
  const total = brokers.length;
  const reviewed = total - counts.not_started;

  const sentence = document.getElementById('progress-sentence');
  if (reviewed === 0) {
    sentence.innerHTML = `<strong>0 of ${total}</strong> sites reviewed yet.`;
  } else {
    const parts = [];
    if (counts.removed) parts.push(`${counts.removed} confirmed removed`);
    if (counts.no_hit) parts.push(`${counts.no_hit} no hit`);
    if (counts.opt_out_requested) parts.push(`${counts.opt_out_requested} opt-out pending`);
    if (counts.found) parts.push(`${counts.found} found, not yet opted out`);
    if (counts.needs_followup) parts.push(`${counts.needs_followup} need follow-up`);
    sentence.innerHTML = `<strong>${reviewed} of ${total}</strong> sites reviewed — ${parts.join(', ')}.`;
  }

  const bar = document.getElementById('progress-bar');
  bar.innerHTML = STATUS_ORDER.filter((s) => s !== 'not_started')
    .map((s) => `<span class="progress-segment" data-status="${s}" style="width:${(counts[s] / total) * 100}%"></span>`)
    .join('');

  const legend = document.getElementById('progress-legend');
  legend.innerHTML = STATUS_ORDER.map(
    (s) => `<span class="legend-item"><span class="legend-dot" data-status="${s}"></span>${STATUS_LABELS[s]}: ${counts[s]}</span>`
  ).join('');

  renderAllClear(counts, total);
}

function renderAllClear(counts, total) {
  const panel = document.getElementById('all-clear-panel');
  const outstanding = counts.not_started + counts.found + counts.opt_out_requested + counts.needs_followup;
  if (total === 0 || outstanding > 0) {
    panel.hidden = true;
    return;
  }
  panel.hidden = false;
  const text = document.getElementById('all-clear-text');
  const bits = [`${total} of ${total} sites reviewed`];
  if (counts.removed) bits.push(`${counts.removed} confirmed removed`);
  if (counts.no_hit) bits.push(`${counts.no_hit} had no hit`);

  let nextRecheck = null;
  for (const b of brokers) {
    const info = getRecheckInfo(getEntry(b.id));
    if (info && (!nextRecheck || info.dueDateISO < nextRecheck)) nextRecheck = info.dueDateISO;
  }
  const recheckNote = nextRecheck
    ? ` Clearout will flag sites again as they come due for a recheck — the earliest is ${nextRecheck}.`
    : '';
  text.textContent = `${bits.join(', ')}. Nothing needs your attention right now.${recheckNote}`;
}

function matchesFilters(broker, filters) {
  if (filters.priority && broker.priority !== filters.priority) return false;
  if (filters.category && broker.category !== filters.category) return false;
  if (filters.status) {
    const status = getEntry(broker.id).status;
    if (status !== filters.status) return false;
  }
  if (filters.cost === 'free' && broker.costs_money) return false;
  if (filters.cost === 'paid' && !broker.costs_money) return false;
  if (filters.requiresId === 'no' && broker.requires_id) return false;
  if (filters.requiresId === 'yes' && !broker.requires_id) return false;
  if (filters.dueOnly) {
    const info = getRecheckInfo(getEntry(broker.id));
    if (!info || !info.isDue) return false;
  }
  if (filters.query) {
    const q = filters.query.toLowerCase();
    if (!broker.name.toLowerCase().includes(q)) return false;
  }
  return true;
}

function currentFilters() {
  return {
    priority: document.getElementById('filter-priority').value,
    status: document.getElementById('filter-status').value,
    category: document.getElementById('filter-category').value,
    cost: document.getElementById('filter-cost').value,
    requiresId: document.getElementById('filter-requires-id').value,
    dueOnly: document.getElementById('filter-due').checked,
    sortBy: document.getElementById('sort-by').value,
    query: document.getElementById('search-box').value.trim(),
  };
}

function buildStatusSelect(select, brokerId) {
  select.innerHTML = STATUS_ORDER.map(
    (s) => `<option value="${s}">${STATUS_LABELS[s]}</option>`
  ).join('');
  select.value = getEntry(brokerId).status;
  select.addEventListener('change', () => {
    const patch = { status: select.value };
    // Starts (or restarts, on re-confirmation) the recheck timer.
    if (select.value === 'removed') patch.removed_date = todayISO();
    setEntry(brokerId, patch);
    renderCard(select.closest('.broker-card'), brokerId);
    renderSummary();
  });
}

function renderCard(card, brokerId) {
  const broker = brokers.find((b) => b.id === brokerId);
  const entry = getEntry(brokerId);
  const profile = loadProfile();

  card.dataset.priority = broker.priority;
  card.querySelector('.broker-name').textContent = broker.name;

  const metaParts = [CATEGORY_LABELS[broker.category] || broker.category];
  if (broker.requires_id) metaParts.push('ID required');
  if (broker.costs_money) metaParts.push('May cost money');
  card.querySelector('.broker-meta').textContent = metaParts.join(' · ');

  const pill = card.querySelector('.status-pill');
  pill.dataset.status = entry.status;
  pill.textContent = STATUS_LABELS[entry.status];

  const recheckInfo = getRecheckInfo(entry);
  card.querySelector('.due-badge').hidden = !(recheckInfo && recheckInfo.isDue);

  card.querySelector('.method-value').textContent = METHOD_LABELS[broker.method] || broker.method;
  card.querySelector('.broker-notes').textContent = broker.notes || '';

  const recheckDaysInput = card.querySelector('.recheck-days-input');
  recheckDaysInput.value = entry.recheck_days || DEFAULT_RECHECK_DAYS;
  const recheckStatus = card.querySelector('.recheck-status');
  if (!recheckInfo) {
    recheckStatus.dataset.due = 'false';
    recheckStatus.textContent = 'Timer starts once this site is marked Removed.';
  } else if (recheckInfo.isDue) {
    recheckStatus.dataset.due = 'true';
    recheckStatus.textContent = `Due for recheck (was due ${recheckInfo.dueDateISO}).`;
  } else {
    recheckStatus.dataset.due = 'false';
    recheckStatus.textContent = `Next recheck ${recheckInfo.dueDateISO} (in ${recheckInfo.daysUntilDue} days).`;
  }

  const searchLink = card.querySelector('.search-link');
  searchLink.href = fillTemplate(broker.search_url, profile);

  const optOutLink = card.querySelector('.optout-link');
  optOutLink.href = broker.opt_out_url;

  const notesInput = card.querySelector('.notes-input');
  notesInput.value = entry.notes || '';
}

function createCard(broker) {
  const template = document.getElementById('broker-card-template');
  const card = template.content.firstElementChild.cloneNode(true);
  card.dataset.id = broker.id;

  const select = card.querySelector('.status-select');
  buildStatusSelect(select, broker.id);

  const toggle = card.querySelector('.details-toggle');
  const details = card.querySelector('.broker-details');
  toggle.addEventListener('click', () => {
    details.hidden = !details.hidden;
    toggle.setAttribute('aria-expanded', String(!details.hidden));
    toggle.textContent = details.hidden ? 'Details' : 'Hide details';
  });

  const notesInput = card.querySelector('.notes-input');
  let notesTimer = null;
  notesInput.addEventListener('input', () => {
    clearTimeout(notesTimer);
    notesTimer = setTimeout(() => setEntry(broker.id, { notes: notesInput.value }), 400);
  });

  const recheckDaysInput = card.querySelector('.recheck-days-input');
  recheckDaysInput.addEventListener('change', () => {
    const days = parseInt(recheckDaysInput.value, 10);
    setEntry(broker.id, { recheck_days: days > 0 ? days : DEFAULT_RECHECK_DAYS });
    renderCard(card, broker.id);
  });

  renderCard(card, broker.id);
  return card;
}

function clearAllFilters() {
  document.getElementById('filter-priority').value = '';
  document.getElementById('filter-status').value = '';
  document.getElementById('filter-category').value = '';
  document.getElementById('filter-cost').value = '';
  document.getElementById('filter-requires-id').value = '';
  document.getElementById('filter-due').checked = false;
  document.getElementById('search-box').value = '';
  renderList();
}

function renderList() {
  const container = document.getElementById('broker-list');
  const filters = currentFilters();
  const visible = brokers.filter((b) => matchesFilters(b, filters));
  visible.sort(SORT_COMPARATORS[filters.sortBy] || SORT_COMPARATORS.priority);

  container.innerHTML = '';
  if (visible.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'no-results';
    empty.innerHTML = '<p>No sites match these filters.</p>';
    const clearBtn = document.createElement('button');
    clearBtn.type = 'button';
    clearBtn.className = 'secondary small';
    clearBtn.textContent = 'Clear filters';
    clearBtn.addEventListener('click', clearAllFilters);
    empty.appendChild(clearBtn);
    container.appendChild(empty);
    return;
  }

  const frag = document.createDocumentFragment();
  if (filters.sortBy === 'priority') {
    for (const key of PRIORITY_ORDER) {
      const groupItems = visible.filter((b) => b.priority === key);
      if (!groupItems.length) continue;
      const heading = document.createElement('h3');
      heading.className = 'group-heading';
      heading.textContent = `${PRIORITY_LABELS[key]} (${groupItems.length})`;
      frag.appendChild(heading);
      for (const broker of groupItems) frag.appendChild(createCard(broker));
    }
  } else {
    for (const broker of visible) frag.appendChild(createCard(broker));
  }
  container.appendChild(frag);
}

function refreshAllCards() {
  for (const card of document.querySelectorAll('.broker-card')) {
    renderCard(card, card.dataset.id);
  }
}

function wireProfileForm() {
  const initialProfile = loadProfile();
  populateProfileForm(initialProfile);
  syncProfilePanel(initialProfile);
  updateCaCallout(initialProfile);

  document.getElementById('edit-profile').addEventListener('click', () => {
    syncProfilePanel(loadProfile(), { forceExpanded: true });
  });

  document.getElementById('welcome-start').addEventListener('click', () => {
    dismissWelcome();
    syncProfilePanel(loadProfile(), { forceExpanded: true });
    const input = document.getElementById('full_name');
    input.scrollIntoView({ behavior: 'smooth', block: 'center' });
    input.focus();
  });

  document.getElementById('welcome-skip').addEventListener('click', () => {
    dismissWelcome();
    document.getElementById('controls-panel').scrollIntoView({ behavior: 'smooth', block: 'start' });
  });

  document.getElementById('add-address').addEventListener('click', () => {
    document.getElementById('addresses-list').appendChild(createAddressRow());
  });
  document.getElementById('add-phone').addEventListener('click', () => {
    document.getElementById('phones-list').appendChild(createSimpleRow('phone-row-template', '.phone-input'));
  });
  document.getElementById('add-email').addEventListener('click', () => {
    document.getElementById('emails-list').appendChild(createSimpleRow('email-row-template', '.email-input'));
  });

  document.getElementById('save-profile').addEventListener('click', () => {
    const profile = readProfileForm();
    saveProfile(profile);
    populateProfileForm(profile);
    syncProfilePanel(profile);
    updateWelcomePanel();
    updateCaCallout(profile);
    refreshAllCards();
    const msg = document.getElementById('profile-saved-msg');
    msg.hidden = false;
    clearTimeout(wireProfileForm._t);
    wireProfileForm._t = setTimeout(() => { msg.hidden = true; }, 1800);
  });

  document.getElementById('export-data').addEventListener('click', () => {
    const payload = {
      exported: new Date().toISOString(),
      profile: loadProfile(),
      status: statusMap,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'clearout-backup.json';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  });

  document.getElementById('import-data').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      if (data.profile) {
        saveProfile(data.profile);
        populateProfileForm(data.profile);
        syncProfilePanel(data.profile);
        updateCaCallout(data.profile);
      }
      if (data.status) {
        statusMap = data.status;
        saveStatusMap();
      }
      updateWelcomePanel();
      renderSummary();
      renderList();
    } catch (err) {
      alert('Could not read that file — is it a Clearout export?');
    } finally {
      e.target.value = '';
    }
  });
}

function wireControls() {
  const controlIds = [
    'filter-priority', 'filter-status', 'filter-category',
    'filter-cost', 'filter-requires-id', 'filter-due', 'sort-by',
  ];
  for (const id of controlIds) {
    document.getElementById(id).addEventListener('change', renderList);
  }
  let searchTimer = null;
  document.getElementById('search-box').addEventListener('input', () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(renderList, 150);
  });
}

async function init() {
  statusMap = loadStatusMap();
  wireProfileForm();
  wireControls();
  updateWelcomePanel();

  try {
    const res = await fetch('data/brokers.json');
    const data = await res.json();
    brokers = data.brokers || [];
  } catch (err) {
    document.getElementById('broker-list').innerHTML =
      '<p class="no-results">Could not load data/brokers.json. If you opened this file directly (file://), ' +
      'serve it instead with <code>python -m http.server</code> and open the printed localhost URL.</p>';
    return;
  }

  renderSummary();
  renderList();
}

init();
