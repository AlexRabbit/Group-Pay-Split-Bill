/**
 * Hacker-styled PDF export for Group Pay sessions.
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

  function ensureSpace(doc, y, need, pageH, margin) {
    if (y + need > pageH - margin) {
      doc.addPage();
      doc.setFillColor(5, 8, 5);
      doc.rect(0, 0, doc.internal.pageSize.getWidth(), doc.internal.pageSize.getHeight(), 'F');
      return margin + 8;
    }
    return y;
  }

  function generate(state, strings, SplitEngine) {
    if (typeof window.jspdf === 'undefined') {
      throw new Error('jsPDF not loaded');
    }

    const t = strings.pdf || {};
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
      doc.setFont('courier', 'normal');
      doc.setFontSize(size);
      doc.setTextColor(0, 255, 65);
    }

    function dimText(size) {
      doc.setFont('courier', 'normal');
      doc.setFontSize(size);
      doc.setTextColor(90, 143, 90);
    }

    fillPage();

    greenText(14);
    doc.text(t.title || 'GROUP PAY — BILL SPLIT', margin, y);
    y += 8;

    dimText(8);
    doc.text(
      (t.generated || 'Generated') + ': ' + new Date().toLocaleString(),
      margin,
      y
    );
    y += 10;

    doc.setDrawColor(0, 204, 51);
    doc.line(margin, y, pageW - margin, y);
    y += 8;

    greenText(11);
    doc.text((t.billTotal || 'BILL TOTAL') + ': ' + fmt(state.billTotalCents), margin, y);
    y += 12;

    state.payers.forEach((payer) => {
      y = ensureSpace(doc, y, 20, pageH, margin);
      fillPage();

      greenText(10);
      doc.text('> ' + (t.payerSection || 'PAYER') + ': ' + payer.name.toUpperCase(), margin, y);
      y += 7;

      dimText(9);
      payer.items.forEach((item) => {
        y = ensureSpace(doc, y, 6, pageH, margin);
        fillPage();
        let line = '  ' + item.name;
        if (item.isSplit) {
          const splitLabel = item.autoAdded
            ? t('labels.autoSplit', 'auto-split')
            : t('labels.split', 'split');
          line += ' [' + splitLabel + ']';
        }
        const price = fmt(item.cents);
        doc.text(line, margin, y);
        doc.text(price, pageW - margin - doc.getTextWidth(price), y);
        y += 5;
      });

      greenText(9);
      const sub = (t.subtotal || 'Subtotal') + ': ' + fmt(SplitEngine.payerTotalCents(payer));
      y = ensureSpace(doc, y, 8, pageH, margin);
      fillPage();
      doc.text(sub, margin, y);
      y += 10;

      doc.setDrawColor(0, 102, 40);
      doc.setLineDashPattern([1, 1], 0);
      doc.line(margin, y, pageW - margin, y);
      doc.setLineDashPattern([], 0);
      y += 8;
    });

    y = ensureSpace(doc, y, 30, pageH, margin);
    fillPage();

    greenText(11);
    doc.text('> ' + (t.reconcile || 'RECONCILE'), margin, y);
    y += 8;

    dimText(9);
    doc.text((t.assigned || 'Assigned') + ': ' + fmt(totals.assignedCents), margin, y);
    y += 5;
    doc.text(((strings.labels && strings.labels.billTotal) || 'BILL') + ': ' + fmt(totals.billTotalCents), margin, y);
    y += 5;

    if (!totals.balanced) {
      doc.setTextColor(255, 176, 0);
      doc.text(
        (t.difference || 'Difference') + ': ' + fmt(Math.abs(totals.diffCents)),
        margin,
        y
      );
      y += 5;
    }

    greenText(10);
    doc.setTextColor(totals.balanced ? 0 : 255, totals.balanced ? 255 : 176, totals.balanced ? 65 : 0);
    doc.text(
      totals.balanced ? (t.balanced || 'BALANCED') : (t.unbalanced || 'UNBALANCED'),
      margin,
      y
    );

    dimText(7);
    doc.setTextColor(90, 143, 90);
    doc.text(t.footer || 'group-pay-split-bill', margin, pageH - margin);

    doc.save(pdfFilename());
  }

  global.GPSPdf = { generate, pdfFilename };
})(window);
