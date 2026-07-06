/**
 * Hacker-styled PDF export — full itemized breakdown with split tags.
 */
(function (global) {
  'use strict';

  function pad(n) {
    return String(n).padStart(2, '0');
  }

  function pdfFilename() {
    const d = new Date();
    return (
      d.getFullYear() +
      '-' +
      pad(d.getMonth() + 1) +
      '-' +
      pad(d.getDate()) +
      ' - ' +
      pad(d.getHours()) +
      ':' +
      pad(d.getMinutes()) +
      ':' +
      pad(d.getSeconds()) +
      '.pdf'
    );
  }

  function fmt(cents) {
    return '$' + (Math.round(cents) / 100).toFixed(2);
  }

  function splitDetail(item, state, labels) {
    if (!item.isSplit || !item.splitId) return '';
    const split = (state.splits || []).find((s) => s.id === item.splitId);
    if (!split) return '';
    const names = split.participants
      .map((pid) => {
        const p = state.payers.find((x) => x.id === pid);
        return p ? p.name : pid;
      })
      .join(', ');
    const tag = item.autoAdded ? labels.autoSplit : labels.split;
    return ' [' + tag + ' · ' + fmt(split.fullCents) + ' ÷ ' + split.participants.length + ' · ' + names + ']';
  }

  function buildDoc(state, strings, SplitEngine) {
    if (typeof window.jspdf === 'undefined') throw new Error('jsPDF not loaded');

    const t = strings.pdf || {};
    const labels = strings.labels || {};
    const totals = SplitEngine.computeTotals(state);
    const doc = new window.jspdf.jsPDF({ unit: 'mm', format: 'a4' });
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();
    const margin = 14;
    let y = margin;

    function fillPage() {
      doc.setFillColor(5, 8, 5);
      doc.rect(0, 0, pageW, pageH, 'F');
    }

    function greenText(size) {
      doc.setFont('courier', 'bold');
      doc.setFontSize(size);
      doc.setTextColor(0, 255, 65);
    }

    function dimText(size) {
      doc.setFont('courier', 'normal');
      doc.setFontSize(size);
      doc.setTextColor(90, 143, 90);
    }

    function bodyText(size, color) {
      doc.setFont('courier', 'normal');
      doc.setFontSize(size);
      doc.setTextColor(color || [184, 255, 184]);
    }

    function ensureSpace(need) {
      if (y + need > pageH - margin) {
        doc.addPage();
        fillPage();
        y = margin + 8;
      }
    }

    fillPage();

    greenText(14);
    doc.text(t.title || 'GROUP PAY — BILL SPLIT', margin, y);
    y += 8;
    dimText(8);
    doc.text((t.generated || 'Generated') + ': ' + new Date().toLocaleString(), margin, y);
    y += 10;
    doc.setDrawColor(0, 204, 51);
    doc.line(margin, y, pageW - margin, y);
    y += 8;

    greenText(11);
    doc.text((t.billTotal || 'BILL TOTAL') + ': ' + fmt(state.billTotalCents), margin, y);
    y += 6;
    dimText(8);
    doc.text((t.payersCount || 'People') + ': ' + state.payers.length, margin, y);
    y += 12;

    state.payers.forEach((payer, pi) => {
      ensureSpace(16);
      greenText(10);
      doc.text('> ' + (t.payerSection || 'PAYER') + ' ' + (pi + 1) + ': ' + payer.name.toUpperCase(), margin, y);
      y += 7;

      if (!payer.items.length) {
        dimText(8);
        doc.text('  (' + (t.noItems || 'no items') + ')', margin, y);
        y += 8;
      }

      payer.items.forEach((item, ii) => {
        ensureSpace(12);
        bodyText(9);
        const detail = splitDetail(item, state, labels);
        const prefix = '  ' + String(ii + 1).padStart(2, '0') + '. ';
        const nameLine = prefix + item.name + detail;
        const wrapped = doc.splitTextToSize(nameLine, pageW - margin * 2 - 28);
        wrapped.forEach((line) => {
          ensureSpace(5);
          doc.text(line, margin, y);
          y += 4.5;
        });
        doc.setTextColor(0, 255, 65);
        doc.text(fmt(item.cents), pageW - margin - 18, y - 4.5);
        bodyText(9);
      });

      greenText(9);
      ensureSpace(8);
      doc.text('  ── ' + (t.subtotal || 'Subtotal') + ': ' + fmt(SplitEngine.payerTotalCents(payer)), margin, y);
      y += 10;
      doc.setDrawColor(0, 102, 40);
      doc.setLineDashPattern([1, 1], 0);
      doc.line(margin, y, pageW - margin, y);
      doc.setLineDashPattern([], 0);
      y += 8;
    });

    if (state.splits && state.splits.length) {
      ensureSpace(20);
      greenText(10);
      doc.text('> ' + (t.splitsSection || 'SHARED ITEMS'), margin, y);
      y += 7;
      state.splits.forEach((sp, i) => {
        ensureSpace(8);
        dimText(8);
        const who = sp.participants
          .map((pid) => state.payers.find((p) => p.id === pid)?.name || pid)
          .join(' + ');
        doc.text(
          '  ' + (i + 1) + '. ' + sp.name + ' · ' + fmt(sp.fullCents) + ' · ' + who,
          margin,
          y
        );
        y += 5;
      });
      y += 6;
    }

    ensureSpace(28);
    greenText(11);
    doc.text('> ' + (t.reconcile || 'RECONCILE'), margin, y);
    y += 8;
    dimText(9);
    totals.perPayer.forEach((p) => {
      ensureSpace(5);
      doc.text('  ' + p.name + ': ' + fmt(p.cents), margin, y);
      y += 5;
    });
    y += 3;
    doc.text((t.assigned || 'Assigned') + ': ' + fmt(totals.assignedCents), margin, y);
    y += 5;
    doc.text((labels.billTotal || 'BILL') + ': ' + fmt(totals.billTotalCents), margin, y);
    y += 5;
    if (!totals.balanced) {
      doc.setTextColor(255, 176, 0);
      doc.text((t.difference || 'Difference') + ': ' + fmt(Math.abs(totals.diffCents)), margin, y);
      y += 5;
    }
    doc.setTextColor(totals.balanced ? 0 : 255, totals.balanced ? 255 : 176, totals.balanced ? 65 : 0);
    doc.text(totals.balanced ? (t.balanced || 'BALANCED') : (t.unbalanced || 'UNBALANCED'), margin, y);

    dimText(7);
    doc.setTextColor(90, 143, 90);
    doc.text(t.footer || 'group-pay-split-bill', margin, pageH - margin);

    return doc;
  }

  function toBlob(state, strings, SplitEngine) {
    const doc = buildDoc(state, strings, SplitEngine);
    return doc.output('blob');
  }

  function generate(state, strings, SplitEngine) {
    buildDoc(state, strings, SplitEngine).save(pdfFilename());
  }

  global.GPSPdf = { generate, toBlob, pdfFilename, buildDoc };
})(window);
