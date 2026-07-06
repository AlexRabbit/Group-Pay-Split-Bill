/**
 * Driver.js — context-aware tour for the current screen only.
 */
(function (global) {
  'use strict';

  let driver = null;
  let tourStrings = null;
  let getUiStep = () => 0;

  const SCREENS = {
    0: [
      { el: '#inputBill', side: 'bottom', key: 0 },
      { el: '#btnAction', side: 'top', key: 1 },
      { el: '#langSelect', side: 'bottom', key: 10 },
      { el: '#btnHowTo', side: 'bottom', key: 11 },
    ],
    1: [
      { el: '#billPill', side: 'bottom', key: 2 },
      { el: '#inputNames', side: 'bottom', key: 2 },
      { el: '#btnAction', side: 'top', key: 1 },
      { el: '#btnBack', side: 'top', key: 12 },
    ],
    2: [
      { el: '#currentPayerName', side: 'bottom', key: 3 },
      { el: '#itemList', side: 'bottom', key: 13 },
      { el: '#inputItemName', side: 'bottom', key: 4 },
      { el: '#inputItemPrice', side: 'bottom', key: 4 },
      { el: '#btnAddItem', side: 'top', key: 5 },
      { el: '#splitPartners', side: 'top', key: 5 },
      { el: '#btnAction', side: 'top', key: 14 },
      { el: '#btnBack', side: 'top', key: 12 },
    ],
    3: [
      { el: '#reconcileBox', side: 'bottom', key: 6 },
      { el: '#summaryRows', side: 'top', key: 15 },
      { el: '#btnCopyLink', side: 'top', key: 7 },
      { el: '#btnShare', side: 'top', key: 16 },
      { el: '#btnCreatePdf', side: 'top', key: 8 },
      { el: '#btnExport', side: 'top', key: 8 },
    ],
  };

  function mobileSide(element, preferred) {
    if (!element) return preferred;
    const rect = element.getBoundingClientRect();
    const vh = window.innerHeight;
    if (rect.top < 100) return 'bottom';
    if (rect.bottom > vh - 140) return 'top';
    if (window.innerWidth < 480) {
      if (rect.left < 40) return 'right';
      if (rect.right > window.innerWidth - 40) return 'left';
    }
    return preferred;
  }

  function scrollToEl(el) {
    if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
  }

  function stepDef(key) {
    const steps = (tourStrings && tourStrings.steps) || [];
    return steps[key] || { title: '', description: '' };
  }

  const GPSTour = {
    setStrings(s) {
      tourStrings = s && s.tour ? s.tour : null;
      if (driver && tourStrings) {
        driver.setConfig({
          nextBtnText: tourStrings.next || 'NEXT →',
          prevBtnText: tourStrings.prev || '← BACK',
          doneBtnText: tourStrings.done || 'DONE',
        });
      }
    },

    setUiStepGetter(fn) {
      getUiStep = fn;
    },

    init() {
      if (typeof window.driver === 'undefined') return;
      const t = tourStrings || {};
      driver = window.driver.js.driver({
        showProgress: true,
        animate: true,
        smoothScroll: true,
        overlayOpacity: 0.82,
        stagePadding: 10,
        stageRadius: 4,
        popoverClass: 'gps-tour',
        nextBtnText: t.next || 'NEXT →',
        prevBtnText: t.prev || '← BACK',
        doneBtnText: t.done || 'DONE',
        onHighlightStarted: (el) => {
          if (el && el.scrollIntoView) scrollToEl(el);
        },
      });
    },

    start() {
      if (!driver) this.init();
      if (!driver) return;

      const screen = getUiStep();
      const defs = SCREENS[screen] || SCREENS[0];
      const seen = new Set();
      const steps = [];

      defs.forEach(({ el, side, key }) => {
        if (seen.has(el)) return;
        const node = document.querySelector(el);
        if (!node) return;
        if (node.offsetParent === null && el !== '#billPill' && el !== '#itemList') return;
        seen.add(el);
        const def = stepDef(key);
        steps.push({
          element: node,
          popover: {
            title: def.title || '',
            description: def.description || '',
            side: mobileSide(node, side),
            align: 'center',
          },
        });
      });

      if (!steps.length) return;
      scrollToEl(steps[0].element);
      setTimeout(() => {
        driver.setSteps(steps);
        driver.drive();
      }, 280);
    },
  };

  global.GPSTour = GPSTour;
})(window);
