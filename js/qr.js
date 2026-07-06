/**
 * Session QR display helper.
 */
(function (global) {
  'use strict';

  async function render(canvas, url) {
    if (typeof QRCode === 'undefined') throw new Error('QRCode library not loaded');
    await QRCode.toCanvas(canvas, url, {
      width: 220,
      margin: 2,
      color: { dark: '#00ff41', light: '#050805' },
      errorCorrectionLevel: 'M',
    });
  }

  global.GPSQr = { render };
})(window);
