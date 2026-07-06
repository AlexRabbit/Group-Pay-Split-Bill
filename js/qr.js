/**
 * Session QR — uses qrcodejs (global QRCode constructor).
 */
(function (global) {
  'use strict';

  function correctLevel() {
    if (typeof QRCode !== 'undefined' && QRCode.CorrectLevel) {
      return QRCode.CorrectLevel.L;
    }
    return 1;
  }

  function makeQr(host, url) {
    host.innerHTML = '';
    new QRCode(host, {
      text: url,
      width: 220,
      height: 220,
      colorDark: '#00ff41',
      colorLight: '#050805',
      correctLevel: correctLevel(),
    });
  }

  function render(host, url) {
    if (typeof QRCode === 'undefined') throw new Error('QRCode library not loaded');
    if (!url) throw new Error('No URL for QR');
    makeQr(host, url);
  }

  function toDataUrl(url) {
    return new Promise((resolve, reject) => {
      if (typeof QRCode === 'undefined') {
        reject(new Error('QRCode library not loaded'));
        return;
      }
      if (!url) {
        reject(new Error('No URL for QR'));
        return;
      }
      const tmp = document.createElement('div');
      tmp.style.cssText = 'position:fixed;left:-9999px;top:0;opacity:0;pointer-events:none;';
      document.body.appendChild(tmp);
      try {
        makeQr(tmp, url);
        const done = (src) => {
          document.body.removeChild(tmp);
          resolve(src);
        };
        const fail = (msg) => {
          document.body.removeChild(tmp);
          reject(new Error(msg));
        };
        const img = tmp.querySelector('img');
        if (img) {
          if (img.src && img.complete && img.naturalWidth) done(img.src);
          else {
            img.onload = () => done(img.src);
            img.onerror = () => fail('QR image failed');
          }
          return;
        }
        const canvas = tmp.querySelector('canvas');
        if (canvas) {
          done(canvas.toDataURL('image/png'));
          return;
        }
        fail('QR render produced no output');
      } catch (e) {
        if (tmp.parentNode) document.body.removeChild(tmp);
        reject(e);
      }
    });
  }

  global.GPSQr = { render, toDataUrl };
})(window);
