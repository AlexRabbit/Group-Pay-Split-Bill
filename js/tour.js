/**
 * Driver.js guided tour — manual trigger only, i18n-aware.
 */
(function (global) {
  'use strict';

  let driver = null;
  let tourStrings = null;

  const STEP_ELEMENTS = [
    '#inputBill',
    '#btnAction',
    '#inputNames',
    '#currentPayerName',
    '#inputItemName',
    '#splitPartners',
    '#billPill',
    '#btnCopyLink',
    '#btnCreatePdf',
  ];

  function mobileSide(element, preferred) {
    if (window.innerWidth < 480) {
      const rect = element.getBoundingClientRect();
      if (rect.top < 120) return 'bottom';
      if (rect.bottom > window.innerHeight - 160) return 'top';
    }
    return preferred;
  }

  const SIDES = ['bottom', 'top', 'bottom', 'bottom', 'bottom', 'top', 'bottom', 'top', 'top'];

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

    init() {
      if (typeof window.driver === 'undefined') return;
      const t = tourStrings || {};
      driver = window.driver.js.driver({
        showProgress: true,
        animate: true,
        overlayOpacity: 0.75,
        stagePadding: 8,
        stageRadius: 4,
        popoverClass: 'gps-tour',
        nextBtnText: t.next || 'NEXT →',
        prevBtnText: t.prev || '← BACK',
        doneBtnText: t.done || 'DONE',
      });
    },

    start() {
      if (!driver) this.init();
      if (!driver) return;

      const stepsDef = (tourStrings && tourStrings.steps) || [];
      const steps = STEP_ELEMENTS.map((sel, i) => {
        const el = document.querySelector(sel);
        if (!el) return null;
        if (el.offsetParent === null && sel !== '#inputNames' && sel !== '#btnCopyLink' && sel !== '#btnCreatePdf') {
          return null;
        }
        const def = stepsDef[i] || {};
        return {
          element: sel,
          popover: {
            title: def.title || '',
            description: def.description || '',
            side: el ? mobileSide(el, SIDES[i] || 'bottom') : 'bottom',
            align: 'start',
          },
        };
      }).filter(Boolean);

      if (!steps.length) return;
      driver.setSteps(steps);
      driver.drive();
    },
  };

  global.GPSTour = GPSTour;
})(window);
