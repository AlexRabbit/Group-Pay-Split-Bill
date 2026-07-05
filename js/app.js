/**
 * Group Pay — main application controller
 */
(function () {
  'use strict';

  const SE = SplitEngine;
  const STEPS = ['bill', 'names', 'items', 'summary'];
  const FIRST_VISIT_KEY = 'gps_tour_seen';

  let state = SE.emptyState();
  let uiStep = 0;
  let payerIndex = 0;
  let strings = {};

  const $ = (id) => document.getElementById(id);

  function basePath() {
    const parts = location.pathname.split('/').filter(Boolean);
    if (parts.length && parts[parts.length - 1].includes('.')) parts.pop();
    return parts.length ? '/' + parts.join('/') + '/' : '/';
  }

  function assetUrl(path) {
    const base = basePath();
    return base + path.replace(/^\//, '');
  }

  function formatMoney(cents) {
    return '$' + SE.fromCents(cents).toFixed(2);
  }

  function showError(msg) {
    const el = $('errorToast');
    el.textContent = msg;
    el.classList.remove('hidden');
    $('infoToast').classList.add('hidden');
    GPSLogger.warn('ui', msg);
    clearTimeout(showError._t);
    showError._t = setTimeout(() => el.classList.add('hidden'), 4000);
  }

  function showInfo(msg) {
    const el = $('infoToast');
    el.textContent = msg;
    el.classList.remove('hidden');
    $('errorToast').classList.add('hidden');
    clearTimeout(showInfo._t);
    showInfo._t = setTimeout(() => el.classList.add('hidden'), 3000);
  }

  function setUiStep(step) {
    uiStep = step;
    STEPS.forEach((name, i) => {
      const panel = document.querySelector('[data-step="' + name + '"]');
      if (panel) panel.classList.toggle('active', i === step);
    });

    const topBar = $('topBar');
    topBar.classList.toggle('hidden', step === 0);

    const btnBack = $('btnBack');
    btnBack.classList.toggle('hidden', step === 0 || step === 3);

    updateActionButton();
    syncUrl();
    GPSLogger.debug('nav', 'step ' + step, { payerIndex });
  }

  function updateActionButton() {
    const btn = $('btnAction');
    const labels = strings.steps || {};
    if (uiStep === 0) btn.textContent = (labels.bill && labels.bill.confirm) || 'CONFIRM';
    else if (uiStep === 1) btn.textContent = (labels.names && labels.names.confirm) || 'START SPLIT';
    else if (uiStep === 2) {
      const isLast = payerIndex >= state.payers.length - 1;
      btn.textContent = isLast
        ? ((labels.items && labels.items.finish) || 'VIEW RESULTS')
        : ((labels.items && labels.items.nextPerson) || 'NEXT PERSON');
    } else btn.textContent = (labels.summary && labels.summary.restart) || 'NEW BILL';
  }

  function updateBillPill() {
    $('billPill').textContent = formatMoney(state.billTotalCents);
  }

  function renderProgressDots() {
    const container = $('progressDots');
    container.innerHTML = '';
    state.payers.forEach((p, i) => {
      const dot = document.createElement('span');
      dot.className = 'progress-dot';
      if (i < payerIndex) dot.classList.add('done');
      if (i === payerIndex) dot.classList.add('current');
      dot.title = p.name;
      container.appendChild(dot);
    });
  }

  function renderSplitPartners() {
    const container = $('splitPartners');
    const current = state.payers[payerIndex];
    if (!current) {
      container.innerHTML = '';
      return;
    }

    const label = (strings.labels && strings.labels.splitWith) || 'Split with';
    let html = '<span>' + label + ':</span>';
    state.payers.forEach((p, i) => {
      if (i === payerIndex) return;
      html +=
        '<label><input type="checkbox" name="splitPartner" value="' +
        p.id +
        '"> ' +
        escapeHtml(p.name) +
        '</label>';
    });
    if (state.payers.length <= 1) html = '';
    container.innerHTML = html;
  }

  function escapeHtml(s) {
    const d = document.createElement('div');
    d.textContent = s;
    return d.innerHTML;
  }

  function renderItemList() {
    const list = $('itemList');
    const payer = state.payers[payerIndex];
    if (!payer) {
      list.innerHTML = '';
      return;
    }

    list.innerHTML = payer.items
      .map((item) => {
        const auto = item.autoAdded ? ' auto-split' : '';
        const badge = item.isSplit
          ? '<span class="item-badge">' +
            (item.autoAdded
              ? (strings.labels && strings.labels.autoSplit) || 'auto-split'
              : (strings.labels && strings.labels.split) || 'split') +
            '</span>'
          : '';
        const removeBtn = item.editable !== false
          ? '<button type="button" class="btn-remove" data-id="' +
            item.id +
            '" aria-label="Remove">×</button>'
          : '';
        return (
          '<li class="' +
          auto +
          '"><span class="item-name">' +
          escapeHtml(item.name) +
          '</span> ' +
          badge +
          ' <span class="item-price">' +
          formatMoney(item.cents) +
          '</span>' +
          removeBtn +
          '</li>'
        );
      })
      .join('');

    list.querySelectorAll('.btn-remove').forEach((btn) => {
      btn.addEventListener('click', () => {
        state = SE.removeItem(state, payer.id, btn.dataset.id);
        renderPayerStep();
        syncUrl();
      });
    });
  }

  function renderPayerStep() {
    const payer = state.payers[payerIndex];
    if (!payer) return;

    $('currentPayerName').textContent = payer.name;
    $('currentPayerTotal').textContent = formatMoney(SE.payerTotalCents(payer));
    renderProgressDots();
    renderSplitPartners();
    renderItemList();
    updateActionButton();
  }

  function renderSummary() {
    const totals = SE.computeTotals(state);
    const labels = strings.steps && strings.steps.summary;
    const box = $('reconcileBox');

    if (totals.balanced) {
      box.className = 'reconcile ok';
      box.innerHTML = '✓ ' + ((labels && labels.balanced) || 'Totals match the bill.');
    } else {
      box.className = 'reconcile warn';
      const diff = formatMoney(Math.abs(totals.diffCents));
      const sign = totals.diffCents > 0 ? 'unassigned' : 'over-assigned';
      box.innerHTML =
        '⚠ ' +
        ((labels && labels.unbalanced) || 'Difference detected.') +
        '<div class="diff">' +
        diff +
        ' ' +
        sign +
        '</div>';
    }

    $('labelEachOwes').textContent = (strings.labels && strings.labels.eachOwes) || 'Each person owes';
    $('summaryRows').innerHTML = totals.perPayer
      .map(
        (p) =>
          '<div class="summary-row"><span>' +
          escapeHtml(p.name) +
          '</span><span class="amount">' +
          formatMoney(p.cents) +
          '</span></div>'
      )
      .join('');

    const assignedLabel = (strings.labels && strings.labels.assigned) || 'Assigned';
    const billLabel = (strings.labels && strings.labels.billTotal) || 'Bill';
    $('summaryRows').innerHTML +=
      '<div class="summary-row" style="margin-top:8px;border-top:1px dashed var(--green-border)">' +
      '<span>' +
      assignedLabel +
      '</span><span class="amount">' +
      formatMoney(totals.assignedCents) +
      '</span></div>' +
      '<div class="summary-row"><span>' +
      billLabel +
      '</span><span class="amount">' +
      formatMoney(totals.billTotalCents) +
      '</span></div>';
  }

  function getSelectedSplitPartners() {
    return Array.from(document.querySelectorAll('input[name="splitPartner"]:checked')).map(
      (el) => el.value
    );
  }

  function addCurrentItem() {
    const payer = state.payers[payerIndex];
    if (!payer) return false;

    const name = $('inputItemName').value.trim();
    const price = $('inputItemPrice').value;
    const partners = getSelectedSplitPartners();

    if (!name) {
      showError('Enter an item name');
      return false;
    }
    if (!price || SE.toCents(price) <= 0) {
      showError('Enter a valid price');
      return false;
    }

    try {
      state = SE.addItem(state, payer.id, name, price, partners);
      $('inputItemName').value = '';
      $('inputItemPrice').value = '';
      document.querySelectorAll('input[name="splitPartner"]').forEach((c) => (c.checked = false));
      renderPayerStep();
      syncUrl();
      GPSLogger.info('item', 'added', { payer: payer.name, name, price, partners });
      return true;
    } catch (e) {
      showError(e.message);
      return false;
    }
  }

  function confirmBill() {
    const val = $('inputBill').value;
    const cents = SE.toCents(val);
    if (!Number.isFinite(cents) || cents <= 0) {
      showError('Enter a valid bill total');
      return;
    }
    state.billTotalCents = cents;
    updateBillPill();
    setUiStep(1);
    $('inputNames').focus();
  }

  function confirmNames() {
    const names = SE.parseNames($('inputNames').value);
    if (names.length < 1) {
      showError('Add at least one name');
      return;
    }
    state.payers = SE.initPayers(names);
    state.splits = [];
    payerIndex = 0;
    setUiStep(2);
    renderPayerStep();
    $('inputItemName').focus();
  }

  function nextPayerOrSummary() {
    const isLast = payerIndex >= state.payers.length - 1;
    if (isLast) {
      setUiStep(3);
      renderSummary();
    } else {
      payerIndex++;
      renderPayerStep();
      $('inputItemName').focus();
    }
  }

  function handleAction() {
    if (uiStep === 0) confirmBill();
    else if (uiStep === 1) confirmNames();
    else if (uiStep === 2) nextPayerOrSummary();
    else restart();
  }

  function handleBack() {
    if (uiStep === 2 && payerIndex > 0) {
      payerIndex--;
      renderPayerStep();
    } else if (uiStep === 2) {
      setUiStep(1);
    } else if (uiStep === 1) {
      setUiStep(0);
    }
  }

  function restart() {
    state = SE.emptyState();
    payerIndex = 0;
    $('inputBill').value = '';
    $('inputNames').value = '';
    $('inputItemName').value = '';
    $('inputItemPrice').value = '';
    history.replaceState(null, '', location.pathname);
    setUiStep(0);
    GPSLogger.info('session', 'restarted');
  }

  function syncUrl() {
    if (!state.billTotalCents) return;
    try {
      const encoded = SE.encodeStateUrl(state);
      const url = location.pathname + '#s=' + encoded;
      history.replaceState(null, '', url);
    } catch (e) {
      GPSLogger.warn('url', 'sync failed', e.message);
    }
  }

  function loadFromUrl() {
    const hash = location.hash.slice(1);
    const match = hash.match(/^s=(.+)$/);
    if (!match) return false;
    const decoded = SE.decodeStateUrl(match[1]);
    if (!decoded || !decoded.payers) return false;
    state = decoded;
    updateBillPill();
    payerIndex = 0;
    setUiStep(3);
    renderSummary();
    GPSLogger.info('url', 'restored from hash');
    return true;
  }

  function copyShareLink() {
    syncUrl();
    navigator.clipboard
      .writeText(location.href)
      .then(() => showInfo('Link copied — bookmark to save session'))
      .catch(() => showError('Could not copy link'));
  }

  function exportBackup() {
    const data = SE.exportBackup(state);
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'group-pay-backup-' + Date.now() + '.json';
    a.click();
    URL.revokeObjectURL(a.href);
  }

  function importBackupFile(file) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        state = SE.importBackup(reader.result);
        updateBillPill();
        payerIndex = state.payers.length - 1;
        setUiStep(3);
        renderSummary();
        syncUrl();
        GPSLogger.info('import', 'backup loaded');
      } catch (e) {
        showError(e.message);
      }
    };
    reader.readAsText(file);
  }

  async function loadStrings() {
    try {
      const res = await fetch(assetUrl('i18n/en/strings.json'));
      if (res.ok) strings = await res.json();
    } catch (_) {
      strings = {};
    }
    applyStrings();
  }

  function applyStrings() {
    const s = strings;
    if (s.app) document.title = s.app.title + ' — Split Bill';
    if (s.steps) {
      if (s.steps.bill) {
        $('titleBill').textContent = s.steps.bill.title || $('titleBill').textContent;
        $('hintBill').textContent = s.steps.bill.hint || $('hintBill').textContent;
      }
      if (s.steps.names) {
        $('titleNames').textContent = s.steps.names.title || $('titleNames').textContent;
        $('hintNames').textContent = s.steps.names.hint || $('hintNames').textContent;
      }
      if (s.steps.items) {
        $('hintItems').textContent = s.steps.items.hint || $('hintItems').textContent;
        const addBtn = $('btnAddItem');
        if (addBtn && s.steps.items.addItem) addBtn.textContent = s.steps.items.addItem;
      }
      if (s.steps.summary) {
        $('titleSummary').textContent = s.steps.summary.title || $('titleSummary').textContent;
      }
    }
    if (s.app && s.app.howToUse) {
      $('btnHowTo').textContent = s.app.howToUse.length <= 3 ? '?' : s.app.howToUse;
      $('btnHowTo').setAttribute('aria-label', s.app.howToUse);
    }
  }

  function setupFirstVisitPulse() {
    if (localStorage.getItem(FIRST_VISIT_KEY)) return;
    $('btnHowTo').classList.add('pulse-first');
    $('btnHowTo').addEventListener(
      'click',
      () => {
        localStorage.setItem(FIRST_VISIT_KEY, '1');
        $('btnHowTo').classList.remove('pulse-first');
      },
      { once: true }
    );
  }

  function bindEvents() {
    $('btnAction').addEventListener('click', handleAction);
    $('btnBack').addEventListener('click', handleBack);
    $('btnAddItem').addEventListener('click', addCurrentItem);
    $('btnShare').addEventListener('click', copyShareLink);
    $('btnExport').addEventListener('click', exportBackup);
    $('btnImport').addEventListener('click', () => $('inputImport').click());
    $('inputImport').addEventListener('change', (e) => {
      const f = e.target.files[0];
      if (f) importBackupFile(f);
      e.target.value = '';
    });

    $('inputBill').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') confirmBill();
    });

    $('inputItemName').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') $('inputItemPrice').focus();
    });
    $('inputItemPrice').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') addCurrentItem();
    });

    document.addEventListener('keydown', (e) => {
      if (uiStep === 2 && e.key === 'Enter' && e.target.id === 'inputItemPrice') {
        e.preventDefault();
        addCurrentItem();
      }
    });
  }

  async function init() {
    GPSLogger.info('boot', 'app start', { path: basePath() });
    await loadStrings();
    bindEvents();
    setupFirstVisitPulse();

    if (!loadFromUrl()) {
      setUiStep(0);
      $('inputBill').focus();
    }

    if (typeof GPSTour !== 'undefined') {
      GPSTour.init();
      $('btnHowTo').addEventListener('click', () => GPSTour.start());
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
