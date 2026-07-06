/**
 * Hacker-styled PDF — full breakdown, split tags, session QR.
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

  function safeText(s) {
    return String(s || '')
      .replace(/[^\x00-\x7F]/g, (c) => {
        const map = { '÷': '/', '—': '-', '·': '|', '⚠': '!' };
        return map[c] || '?';
      });
  }

  function getJsPDF() {
    if (global.jspdf && global.jspdf.jsPDF) return global.jspdf.jsPDF;
    if (global.jsPDF) return global.jsPDF;
    throw new Error('jsPDF not loaded');
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
    return (
      ' [' +
      tag +
      ' | ' +
      fmt(split.fullCents) +
      ' / ' +
      split.participants.length +
      ' | ' +
      names +
      ']'
    );
  }

  function buildDoc(state, strings, SplitEngine, shareUrl, qrDataUrl) {
    const JsPDF = getJsPDF();
    const t = strings.pdf || {};
    const labels = strings.labels || {};
    const totals = SplitEngine.computeTotals(state);
    const doc = new JsPDF({ unit: 'mm', format: 'a4' });
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();
    const margin = 14;
    let y = margin;

    function fillPage() {
      doc.setFillColor(5, 8, 5);
      doc.rect(0, 0, pageW, pageH, 'F');
    }

    function setGreen(size, bold) {
      doc.setFont('courier', bold ? 'bold' : 'normal');
      doc.setFontSize(size);
      doc.setTextColor(0, 255, 65);
    }

    function setDim(size) {
      doc.setFont('courier', 'normal');
      doc.setFontSize(size);
      doc.setTextColor(90, 143, 90);
    }

    function setBody(size) {
      doc.setFont('courier', 'normal');
      doc.setFontSize(size);
      doc.setTextColor(184, 255, 184);
    }

    function ensureSpace(need) {
      if (y + need > pageH - margin) {
        doc.addPage();
        fillPage();
        y = margin + 8;
      }
    }

    fillPage();

    setGreen(14, true);
    doc.text(safeText(t.title || 'GROUP PAY - BILL SPLIT'), margin, y);
    y += 8;
    setDim(8);
    doc.text(safeText((t.generated || 'Generated') + ': ' + new Date().toLocaleString()), margin, y);
    y += 10;
    doc.setDrawColor(0, 204, 51);
    doc.line(margin, y, pageW - margin, y);
    y += 8;

    setGreen(11, true);
    doc.text(safeText((t.billTotal || 'BILL TOTAL') + ': ' + fmt(state.billTotalCents)), margin, y);
    y += 6;
    setDim(8);
    doc.text(safeText((t.payersCount || 'People') + ': ' + state.payers.length), margin, y);
    y += 12;

    state.payers.forEach((payer, pi) => {
      ensureSpace(16);
      setGreen(10, true);
      doc.text(
        safeText('> ' + (t.payerSection || 'PAYER') + ' ' + (pi + 1) + ': ' + payer.name.toUpperCase()),
        margin,
        y
      );
      y += 7;

      if (!payer.items.length) {
        setDim(8);
        doc.text(safeText('  (' + (t.noItems || 'no items') + ')'), margin, y);
        y += 8;
      }

      payer.items.forEach((item, ii) => {
        ensureSpace(10);
        setBody(9);
        const detail = splitDetail(item, state, labels);
        const line = safeText('  ' + String(ii + 1).padStart(2, '0') + '. ' + item.name + detail);
        const wrapped = doc.splitTextToSize(line, pageW - margin * 2 - 24);
        wrapped.forEach((ln) => {
          ensureSpace(5);
          doc.text(ln, margin, y);
          y += 4.5;
        });
        setGreen(9, false);
        const price = fmt(item.cents);
        doc.text(price, pageW - margin - doc.getTextWidth(price), y - 4.5);
      });

      setGreen(9, true);
      ensureSpace(8);
      doc.text(
        safeText('  -- ' + (t.subtotal || 'Subtotal') + ': ' + fmt(SplitEngine.payerTotalCents(payer))),
        margin,
        y
      );
      y += 10;
      doc.setDrawColor(0, 102, 40);
      doc.line(margin, y, pageW - margin, y);
      y += 8;
    });

    if (state.splits && state.splits.length) {
      ensureSpace(20);
      setGreen(10, true);
      doc.text(safeText('> ' + (t.splitsSection || 'SHARED ITEMS')), margin, y);
      y += 7;
      state.splits.forEach((sp, i) => {
        ensureSpace(8);
        setDim(8);
        const who = sp.participants
          .map((pid) => {
            const p = state.payers.find((x) => x.id === pid);
            return p ? p.name : pid;
          })
          .join(' + ');
        doc.text(safeText('  ' + (i + 1) + '. ' + sp.name + ' | ' + fmt(sp.fullCents) + ' | ' + who), margin, y);
        y += 5;
      });
      y += 6;
    }

    ensureSpace(28);
    setGreen(11, true);
    doc.text(safeText('> ' + (t.reconcile || 'RECONCILE')), margin, y);
    y += 8;
    setDim(9);
    totals.perPayer.forEach((p) => {
      ensureSpace(5);
      doc.text(safeText('  ' + p.name + ': ' + fmt(p.cents)), margin, y);
      y += 5;
    });
    y += 3;
    doc.text(safeText((t.assigned || 'Assigned') + ': ' + fmt(totals.assignedCents)), margin, y);
    y += 5;
    doc.text(safeText((labels.billTotal || 'BILL') + ': ' + fmt(totals.billTotalCents)), margin, y);
    y += 5;
    if (!totals.balanced) {
      doc.setTextColor(255, 176, 0);
      doc.text(safeText((t.difference || 'Difference') + ': ' + fmt(Math.abs(totals.diffCents))), margin, y);
      y += 5;
    }
    doc.setTextColor(totals.balanced ? 0 : 255, totals.balanced ? 255 : 176, totals.balanced ? 65 : 0);
    doc.text(safeText(totals.balanced ? t.balanced || 'BALANCED' : t.unbalanced || 'UNBALANCED'), margin, y);
    y += 12;

    if (qrDataUrl) {
      ensureSpace(42);
      setGreen(9, true);
      doc.text(safeText(t.qrLabel || 'SESSION QR'), margin, y);
      y += 4;
      try {
        doc.addImage(qrDataUrl, 'PNG', margin, y, 32, 32);
      } catch (_) {
        setDim(7);
        doc.text(safeText(shareUrl || ''), margin, y + 8);
      }
      y += 36;
      if (shareUrl) {
        setDim(6);
        const urlLines = doc.splitTextToSize(safeText(shareUrl), pageW - margin * 2);
        urlLines.slice(0, 3).forEach((ln) => {
          doc.text(ln, margin, y);
          y += 3.5;
        });
      }
    }

    setDim(7);
    doc.text(safeText(t.footer || 'group-pay-split-bill'), margin, pageH - margin);

    return doc;
  }

  async function qrDataUrlFor(url) {
    if (typeof QRCode === 'undefined') return null;
    try {
      return await QRCode.toDataURL(url, {
        width: 256,
        margin: 1,
        color: { dark: '#00ff41', light: '#050805' },
        errorCorrectionLevel: 'M',
      });
    } catch {
      return null;
    }
  }

  async function toBlob(state, strings, SplitEngine, shareUrl) {
    const qr = shareUrl ? await qrDataUrlFor(shareUrl) : null;
    const doc = buildDoc(state, strings, SplitEngine, shareUrl, qr);
    return doc.output('blob');
  }

  async function generate(state, strings, SplitEngine, shareUrl) {
    const qr = shareUrl ? await qrDataUrlFor(shareUrl) : null;
    buildDoc(state, strings, SplitEngine, shareUrl, qr).save(pdfFilename());
  }

  global.GPSPdf = { generate, toBlob, pdfFilename, buildDoc, qrDataUrlFor };
})(window);
