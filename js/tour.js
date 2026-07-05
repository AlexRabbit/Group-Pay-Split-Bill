/**
 * Driver.js guided tour — manual trigger only, evolves with app steps.
 */
(function (global) {
  'use strict';

  let driver = null;

  function getSteps() {
    return [
      {
        element: '#inputBill',
        popover: {
          title: '① Bill total',
          description: 'Type the full receipt amount. This stays pinned at the top.',
          side: 'bottom',
          align: 'center',
        },
      },
      {
        element: '#btnAction',
        popover: {
          title: '② Confirm',
          description: 'Lock in the total and move to the next step.',
          side: 'top',
          align: 'center',
        },
      },
      {
        element: '#inputNames',
        popover: {
          title: '③ Who ate?',
          description: 'Comma-separated names. Everyone who shares the bill.',
          side: 'bottom',
          align: 'start',
        },
      },
      {
        element: '#currentPayerName',
        popover: {
          title: '④ One person at a time',
          description: 'Each payer logs their items. Running total shows on the right.',
          side: 'bottom',
          align: 'start',
        },
      },
      {
        element: '#inputItemName',
        popover: {
          title: '⑤ Add items',
          description: 'Name + price. Tap ADD or press Enter on the price field.',
          side: 'bottom',
          align: 'start',
        },
      },
      {
        element: '#splitPartners',
        popover: {
          title: '⑥ Split shared food',
          description:
            'Check who shares an item. Enter the FULL price — we split it automatically. The other person gets their half on their turn.',
          side: 'top',
          align: 'start',
        },
      },
      {
        element: '#billPill',
        popover: {
          title: '⑦ Reconcile',
          description:
            'At the end, assigned totals must match the bill. Green = good. Amber = fix items or check the receipt.',
          side: 'bottom',
          align: 'end',
        },
      },
      {
        element: '#btnShare',
        popover: {
          title: '⑧ Save via URL',
          description: 'Copy the link anytime — your whole session lives in the URL bookmark.',
          side: 'bottom',
          align: 'end',
        },
      },
      {
        element: '#btnExport',
        popover: {
          title: '⑨ Backup file',
          description: 'Export JSON to share with friends or import later. Works across versions.',
          side: 'top',
          align: 'center',
        },
      },
    ];
  }

  function mobileSide(element, preferred) {
    if (window.innerWidth < 480) {
      const rect = element.getBoundingClientRect();
      if (rect.top < 120) return 'bottom';
      if (rect.bottom > window.innerHeight - 160) return 'top';
    }
    return preferred;
  }

  const GPSTour = {
    init() {
      if (typeof window.driver === 'undefined') return;
      driver = window.driver.js.driver({
        showProgress: true,
        animate: true,
        overlayOpacity: 0.75,
        stagePadding: 8,
        stageRadius: 4,
        popoverClass: 'gps-tour',
        nextBtnText: 'NEXT →',
        prevBtnText: '← BACK',
        doneBtnText: 'DONE',
        onPopoverRender: (popover, opts) => {
          const el = opts.element;
          if (el && opts.state.activeIndex != null) {
            const steps = getSteps();
            const step = steps[opts.state.activeIndex];
            if (step && step.popover.side) {
              popover.wrapper.style.maxWidth = 'min(340px, calc(100vw - 32px))';
            }
          }
        },
      });
    },

    start() {
      if (!driver) this.init();
      if (!driver) return;

      const steps = getSteps().map((s) => {
        const el = document.querySelector(s.element);
        if (!el || el.offsetParent === null && s.element !== '#inputNames') {
          return null;
        }
        return {
          ...s,
          popover: {
            ...s.popover,
            side: el ? mobileSide(el, s.popover.side) : s.popover.side,
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
