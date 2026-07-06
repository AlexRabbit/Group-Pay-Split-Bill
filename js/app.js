/**
 * Group Pay — main application controller
 */
(function () {
  'use strict';

  const SE = SplitEngine;
  const STEPS = ['bill', 'names', 'items', 'summary'];
  const FIRST_VISIT_KEY = 'gps_tour_seen';
  const LANG_KEY = 'gps_lang';

  let state = SE.emptyState();
  let uiStep = 0;
  let payerIndex = 0;
  let strings = {};
  let currentLang = 'en';

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
    hapticError();
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

  function hapticError() {
    if (navigator.vibrate) navigator.vibrate([40, 35, 40]);
  }

  function t(path, fallback) {
    const parts = path.split('.');
    let o = strings;
    for (const p of parts) {
      if (!o || o[p] === undefined) return fallback !== undefined ? fallback : path;
      o = o[p];
    }
    return o;
  }

  function setUiStep(step) {
    uiStep = step;
    STEPS.forEach((name, i) => {
      const panel = document.querySelector('[data-step="' + name + '"]');
      if (panel) panel.classList.toggle('active', i === step);
    });

    $('billPill').classList.toggle('hidden', step === 0 || !state.billTotalCents);

    const btnBack = $('btnBack');
    btnBack.classList.toggle('hidden', step === 0);

    updateActionButton();
    syncUrl();
    GPSLogger.debug('nav', 'step ' + step, { payerIndex });
  }

  function updateActionButton() {
    const btn = $('btnAction');
    const labels = strings.steps || {};
    if (uiStep === 0) btn.textContent = t('steps.bill.confirm', 'CONFIRM');
    else if (uiStep === 1) btn.textContent = t('steps.names.confirm', 'START SPLIT');
    else if (uiStep === 2) {
      const isLast = payerIndex >= state.payers.length - 1;
      btn.textContent = isLast
        ? t('steps.items.finish', 'VIEW RESULTS')
        : t('steps.items.nextPerson', 'NEXT PERSON');
    } else btn.textContent = t('steps.summary.restart', 'NEW BILL');

    $('btnBack').textContent = t('labels.back', 'BACK');
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

    const label = t('labels.splitWith', 'Split with');
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
            (item.autoAdded ? t('labels.autoSplit', 'auto-split') : t('labels.split', 'split')) +
            '</span>'
          : '';
        const removeBtn = item.editable !== false
          ? '<button type="button" class="btn-remove" data-id="' +
            item.id +
            '" aria-label="' +
            escapeHtml(t('labels.remove', 'Remove')) +
            '">×</button>'
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

  function splitItemLabel(item) {
    if (!item.isSplit) return '';
    const tag = item.autoAdded ? t('labels.autoSplit', 'auto-split') : t('labels.split', 'split');
    if (item.splitId) {
      const split = (state.splits || []).find((s) => s.id === item.splitId);
      if (split) {
        const names = split.participants
          .map((pid) => state.payers.find((p) => p.id === pid)?.name || pid)
          .join(', ');
        return (
          ' <span class="item-badge">' +
          escapeHtml(tag) +
          '</span> <span class="item-badge split-meta">' +
          escapeHtml(formatMoney(split.fullCents) + ' ÷ ' + split.participants.length) +
          '</span>'
        );
      }
    }
    return ' <span class="item-badge">' + escapeHtml(tag) + '</span>';
  }

  function renderSummary() {
    const totals = SE.computeTotals(state);
    const box = $('reconcileBox');

    if (totals.balanced) {
      box.className = 'reconcile ok';
      box.innerHTML = '✓ ' + t('steps.summary.balanced', 'Totals match the bill.');
    } else {
      box.className = 'reconcile warn';
      const diff = formatMoney(Math.abs(totals.diffCents));
      const sign =
        totals.diffCents > 0
          ? t('labels.unassigned', 'unassigned')
          : t('labels.overAssigned', 'over-assigned');
      box.innerHTML =
        '⚠ ' +
        t('steps.summary.unbalanced', 'Difference detected.') +
        '<div class="diff">' +
        diff +
        ' ' +
        sign +
        '</div>';
    }

    $('labelEachOwes').textContent = t('labels.eachOwes', 'Each person owes');
    $('hintSummaryEdit').textContent = t(
      'steps.summary.tapNameToEdit',
      'Tap name to edit · tap amount to see items'
    );

    let html = '';
    totals.perPayer.forEach((p, idx) => {
      const payer = state.payers.find((x) => x.id === p.id);
      const items = payer ? payer.items : [];
      html += '<div class="payer-row" data-payer-idx="' + idx + '">';
      html += '<div class="summary-row payer-head">';
      html +=
        '<button type="button" class="payer-edit-btn" data-payer-idx="' +
        idx +
        '" title="' +
        escapeHtml(t('steps.summary.editPayer', 'Edit items')) +
        '">' +
        escapeHtml(p.name) +
        '</button>';
      html +=
        '<button type="button" class="payer-amount-btn amount" data-payer-idx="' +
        idx +
        '" aria-expanded="false" title="' +
        escapeHtml(t('labels.expand', 'Show items')) +
        '">' +
        formatMoney(p.cents) +
        '</button>';
      html += '</div>';
      html += '<ul class="breakdown-list hidden" data-breakdown="' + idx + '">';
      if (!items.length) {
        html +=
          '<li><span class="item-name">' +
          escapeHtml(t('steps.summary.noItemsListed', 'No items')) +
          '</span></li>';
      } else {
        items.forEach((item) => {
          html +=
            '<li class="' +
            (item.autoAdded ? 'auto-split' : '') +
            '"><span class="item-name">' +
            escapeHtml(item.name) +
            splitItemLabel(item) +
            '</span><span class="item-price">' +
            formatMoney(item.cents) +
            '</span></li>';
        });
      }
      html += '</ul></div>';
    });

    const assignedLabel = t('labels.assigned', 'Assigned');
    const billLabel = t('labels.billTotal', 'BILL');
    html +=
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

    $('summaryRows').innerHTML = html;

    $('summaryRows').querySelectorAll('.payer-edit-btn').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        editPayer(parseInt(btn.dataset.payerIdx, 10));
      });
    });

    $('summaryRows').querySelectorAll('.payer-amount-btn').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const idx = btn.dataset.payerIdx;
        const list = $('summaryRows').querySelector('[data-breakdown="' + idx + '"]');
        if (!list) return;
        list.classList.toggle('hidden');
        const isOpen = !list.classList.contains('hidden');
        btn.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
        btn.classList.toggle('amount-open', isOpen);
      });
    });

    $('qrPanel').classList.add('hidden');
    $('btnShowQr').textContent = t('steps.summary.showQr', 'Show QR');
  }

  function editPayer(index) {
    if (index < 0 || index >= state.payers.length) return;
    payerIndex = index;
    $('inputItemName').value = '';
    $('inputItemPrice').value = '';
    setUiStep(2);
    renderPayerStep();
    $('inputItemName').focus();
    GPSLogger.info('nav', 'edit payer', { index, name: state.payers[index].name });
  }

  function hasPendingItemDraft() {
    return $('inputItemName').value.trim() !== '' || $('inputItemPrice').value.trim() !== '';
  }

  function validateBeforeLeavePayer() {
    if (hasPendingItemDraft()) {
      showError(t('errors.pendingItem', 'Tap ADD ITEM first'));
      $('btnAddItem').focus();
      return false;
    }
    const payer = state.payers[payerIndex];
    const total = payer ? SE.payerTotalCents(payer) : 0;
    if (!payer || payer.items.length < 1 || total <= 0) {
      showError(
        t('errors.noItemsForPayer', '{name} needs at least one item with a price').replace(
          '{name}',
          payer ? payer.name : '?'
        )
      );
      return false;
    }
    return true;
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
      showError(t('errors.itemName', 'Enter an item name'));
      return false;
    }
    if (!price || SE.toCents(price) <= 0) {
      showError(t('errors.itemPrice', 'Enter a valid price'));
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
      showError(t('errors.billTotal', 'Enter a valid bill total'));
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
      showError(t('errors.names', 'Add at least one name'));
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
    if (!validateBeforeLeavePayer()) return;

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
    if (uiStep === 3) {
      payerIndex = Math.max(0, state.payers.length - 1);
      $('inputItemName').value = '';
      $('inputItemPrice').value = '';
      setUiStep(2);
      renderPayerStep();
      return;
    }
    if (uiStep === 2 && payerIndex > 0) {
      if (hasPendingItemDraft()) {
        showError(t('errors.pendingItem', 'Tap ADD ITEM first'));
        return;
      }
      payerIndex--;
      renderPayerStep();
      return;
    }
    if (uiStep === 2) {
      if (hasPendingItemDraft()) {
        showError(t('errors.pendingItem', 'Tap ADD ITEM first'));
        return;
      }
      $('inputNames').value = state.payers.map((p) => p.name).join(', ');
      setUiStep(1);
      return;
    }
    if (uiStep === 1) {
      $('inputBill').value = state.billTotalCents ? SE.fromCents(state.billTotalCents).toFixed(2) : '';
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
    history.replaceState(null, '', location.pathname + (currentLang !== 'en' ? '?lang=' + currentLang : ''));
    setUiStep(0);
    GPSLogger.info('session', 'restarted');
  }

  function getShareUrl() {
    const LZ = typeof LZString !== 'undefined' ? LZString : null;
    const token = GPSUrlState.encode(state, LZ);
    return location.origin + GPSUrlState.buildUrl(location.pathname, currentLang, token);
  }

  function syncUrl() {
    if (!state.billTotalCents) return;
    try {
      const LZ = typeof LZString !== 'undefined' ? LZString : null;
      const token = GPSUrlState.encode(state, LZ);
      const path = location.pathname;
      history.replaceState(null, '', GPSUrlState.buildUrl(path, currentLang, token));
    } catch (e) {
      GPSLogger.warn('url', 'sync failed', e.message);
    }
  }

  function loadFromUrl() {
    const tokenRaw = GPSUrlState.parseHash(location.hash);
    if (!tokenRaw) return false;
    const LZ = typeof LZString !== 'undefined' ? LZString : null;
    const decoded = GPSUrlState.decode(tokenRaw, LZ);
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
    const url = getShareUrl();
    navigator.clipboard
      .writeText(url)
      .then(() => showInfo(t('toasts.linkCopied', 'Link copied')))
      .catch(() => showError(t('errors.copyLink', 'Could not copy link')));
  }

  async function shareSession() {
    syncUrl();
    const url = getShareUrl();
    const shareData = {
      title: strings.app ? strings.app.title : 'Group Pay',
      text: strings.app ? strings.app.subtitle : 'Split the bill',
      url,
    };

    try {
      if (navigator.share && typeof GPSPdf !== 'undefined') {
        const url = getShareUrl();
        const blob = await GPSPdf.toBlob(state, strings, SE, url);
        const file = new File([blob], GPSPdf.pdfFilename(), { type: 'application/pdf' });
        if (navigator.canShare && navigator.canShare({ files: [file] })) {
          await navigator.share({ ...shareData, files: [file] });
        } else {
          await navigator.share(shareData);
        }
        showInfo(t('toasts.shared', 'Shared'));
        return;
      }
      if (navigator.share) {
        await navigator.share(shareData);
        showInfo(t('toasts.shared', 'Shared'));
        return;
      }
      copyShareLink();
    } catch (e) {
      if (e.name !== 'AbortError') {
        showError(t('errors.shareFailed', 'Could not share'));
        GPSLogger.warn('share', e.message);
      }
    }
  }

  function createPdf() {
    const url = getShareUrl();
    GPSPdf.generate(state, strings, SE, url).catch((e) => {
      showError(t('errors.pdfFailed', 'Could not create PDF'));
      GPSLogger.error('pdf', e.message || String(e));
    });
    GPSLogger.info('pdf', 'generated');
  }

  async function toggleQrPanel() {
    const panel = $('qrPanel');
    const btn = $('btnShowQr');
    const visible = !panel.classList.contains('hidden');
    if (visible) {
      panel.classList.add('hidden');
      btn.textContent = t('steps.summary.showQr', 'Show QR');
      return;
    }
    try {
      syncUrl();
      const url = getShareUrl();
      await GPSQr.render($('qrHost'), url);
      panel.classList.remove('hidden');
      btn.textContent = t('steps.summary.hideQr', 'Hide QR');
      panel.scrollIntoView({ behavior: 'smooth', block: 'center' });
    } catch (e) {
      showError(t('errors.qrFailed', 'Could not generate QR'));
      GPSLogger.error('qr', e.message);
    }
  }

  async function loadStrings(lang) {
    const code = lang === 'es' ? 'es' : 'en';
    currentLang = code;
    try {
      const res = await fetch(assetUrl('i18n/' + code + '/strings.json'));
      if (res.ok) strings = await res.json();
      else strings = {};
    } catch (_) {
      strings = {};
    }
    document.documentElement.lang = code;
    localStorage.setItem(LANG_KEY, code);
    applyStrings();
    if (typeof GPSTour !== 'undefined') GPSTour.setStrings(strings);
  }

  async function setLanguage(lang) {
    await loadStrings(lang);
    $('langSelect').value = currentLang;
    updateActionButton();
    if (uiStep === 2) renderPayerStep();
    if (uiStep === 3) renderSummary();
    syncUrl();
  }

  function applyStrings() {
    const s = strings;
    if (s.app) {
      document.title = s.app.title + ' — Split Bill';
      const url = s.app.logoUrl || 'https://github.com/AlexRabbit/Group-Pay-Split-Bill';
      const author = s.app.logoAuthor || 'AlexRabbit';
      const before = s.app.logoBefore || 'Group Pay by';
      $('logoText').innerHTML =
        escapeHtml(before) +
        ' <a href="' +
        escapeHtml(url) +
        '" target="_blank" rel="noopener noreferrer">' +
        escapeHtml(author) +
        '</a>';
    }
    if (s.steps) {
      if (s.steps.bill) {
        $('titleBill').textContent = s.steps.bill.title || $('titleBill').textContent;
        $('hintBill').textContent = s.steps.bill.hint || $('hintBill').textContent;
        if (s.steps.bill.placeholder) $('inputBill').placeholder = s.steps.bill.placeholder;
      }
      if (s.steps.names) {
        $('titleNames').textContent = s.steps.names.title || $('titleNames').textContent;
        $('hintNames').textContent = s.steps.names.hint || $('hintNames').textContent;
        if (s.steps.names.placeholder) $('inputNames').placeholder = s.steps.names.placeholder;
      }
      if (s.steps.items) {
        $('hintItems').textContent = s.steps.items.hint || $('hintItems').textContent;
        if (s.steps.items.itemNamePlaceholder)
          $('inputItemName').placeholder = s.steps.items.itemNamePlaceholder;
        if (s.steps.items.itemPricePlaceholder)
          $('inputItemPrice').placeholder = s.steps.items.itemPricePlaceholder;
        if (s.steps.items.addItem) $('btnAddItem').textContent = s.steps.items.addItem;
      }
      if (s.steps.summary) {
        $('titleSummary').textContent = s.steps.summary.title || $('titleSummary').textContent;
        if (s.steps.summary.copyLink) $('btnCopyLink').textContent = s.steps.summary.copyLink;
        if (s.steps.summary.share) $('btnShare').textContent = s.steps.summary.share;
        if (s.steps.summary.createPdf) $('btnCreatePdf').textContent = s.steps.summary.createPdf;
        if (s.steps.summary.showQr && !$('qrPanel').classList.contains('hidden')) {
          $('btnShowQr').textContent = s.steps.summary.hideQr || 'Hide QR';
        } else if (s.steps.summary.showQr) {
          $('btnShowQr').textContent = s.steps.summary.showQr;
        }
        if (s.steps.summary.qrHint) $('hintQr').textContent = s.steps.summary.qrHint;
      }
    }
    if (s.app) {
      const guide = s.app.howToUseShort || s.app.howToUse || 'GUIDE';
      $('btnHowTo').textContent = guide;
      $('btnHowTo').setAttribute('aria-label', s.app.howToUse || guide);
      $('btnHowTo').setAttribute('title', s.app.howToUse || guide);
    }
    if (s.lang) {
      $('langSelect').setAttribute('aria-label', s.lang.label || 'Language');
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
    $('btnCopyLink').addEventListener('click', copyShareLink);
    $('btnShare').addEventListener('click', shareSession);
    $('btnShowQr').addEventListener('click', toggleQrPanel);
    $('btnCreatePdf').addEventListener('click', createPdf);
    $('langSelect').addEventListener('change', (e) => setLanguage(e.target.value));

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
    const params = new URLSearchParams(location.search);
    const urlLang = params.get('lang');
    const savedLang = urlLang || localStorage.getItem(LANG_KEY) || 'en';
    $('langSelect').value = savedLang === 'es' ? 'es' : 'en';
    await loadStrings(savedLang);
    bindEvents();
    setupFirstVisitPulse();

    if (!loadFromUrl()) {
      setUiStep(0);
      $('inputBill').focus();
    } else {
      $('billPill').classList.remove('hidden');
    }

    if (typeof GPSTour !== 'undefined') {
      GPSTour.setUiStepGetter(() => uiStep);
      GPSTour.init();
      GPSTour.setStrings(strings);
      $('btnHowTo').addEventListener('click', () => GPSTour.start());
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
