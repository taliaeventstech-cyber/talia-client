(function () {
  var script = document.currentScript;
  if (!script) return;

  var tenantId = script.getAttribute('data-tenant');
  if (!tenantId) {
    console.warn('[TALIA] Missing data-tenant attribute');
    return;
  }

  var baseUrl = (script.getAttribute('data-api-base') || new URL(script.src).origin).replace(/\/$/, '');
  var pageUrlOverride = script.getAttribute('data-page-url') || '';
  var siteOriginOverride = script.getAttribute('data-site-origin') || '';
  var sessionKey = 'talia-session-' + tenantId;
  var sessionId = localStorage.getItem(sessionKey);
  if (!sessionId) {
    sessionId = crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + '-' + Math.random().toString(16).slice(2);
    localStorage.setItem(sessionKey, sessionId);
  }

  installNavigationObserver();
  schedulePageContextSync(0);

  fetch(baseUrl + '/api/widget/' + tenantId)
    .then(function (response) { return response.json(); })
    .then(function (config) {
      if (config.error) throw new Error(config.error);
      mountWidget(config);
    })
    .catch(function (error) {
      console.warn('[TALIA] Could not load widget config', error);
    });

  function mountWidget(config) {
    var assistantName = config.assistantName || script.getAttribute('data-name') || 'TALIA';
    var initialMessage = config.initialMessage || script.getAttribute('data-initial-message') || 'Hola, soc TALIA. En què et puc ajudar?';
    var primaryColor = config.primaryColor || script.getAttribute('data-color') || '#000000';
    var position = getPosition(config.position || script.getAttribute('data-position') || 'bottom-right');
    var host = document.createElement('div');
    host.id = 'talia-widget-root';
    document.body.appendChild(host);
    registerFloatingWidget(host, 'chatbot', position);

    var root = host.attachShadow({ mode: 'open' });
    root.innerHTML = getTemplate(assistantName, initialMessage, primaryColor, position);

    var panel = root.querySelector('[data-panel]');
    var toggle = root.querySelector('[data-toggle]');
    var close = root.querySelector('[data-close]');
    var form = root.querySelector('[data-form]');
    var input = root.querySelector('[data-input]');
    var messages = root.querySelector('[data-messages]');

    toggle.setAttribute('aria-expanded', 'false');

    function openPanel() {
      panel.classList.add('panel--open');
      toggle.setAttribute('aria-expanded', 'true');
      setTimeout(function () { input.focus(); }, 280);
    }

    function closePanel() {
      panel.classList.remove('panel--open');
      toggle.setAttribute('aria-expanded', 'false');
    }

    if (config.autoOpen) {
      var delay = typeof config.autoOpenDelay === 'number' ? config.autoOpenDelay : 3;
      setTimeout(openPanel, delay * 1000);
    }

    toggle.addEventListener('click', function () {
      if (panel.classList.contains('panel--open')) {
        closePanel();
        toggle.focus();
      } else {
        openPanel();
      }
    });

    close.addEventListener('click', function () {
      closePanel();
      toggle.focus();
    });

    root.addEventListener('keydown', function (event) {
      if (event.key === 'Escape') {
        closePanel();
        toggle.focus();
      }
    });

    form.addEventListener('submit', function (event) {
      event.preventDefault();
      var text = input.value.trim();
      if (!text) return;
      input.value = '';
      appendMessage(messages, text, 'user');
      sendMessage(text, messages);
    });
  }

  function sendMessage(text, messages) {
    appendMessage(messages, '...', 'assistant', true);
    fetch(baseUrl + '/api/chat/' + tenantId, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        session_id: sessionId,
        message: text,
        page_url: getCurrentPageUrl(),
      }),
    })
      .then(function (response) { return response.json(); })
      .then(function (data) {
        removeTyping(messages);
        appendMessage(messages, data.reply || getChatErrorMessage(data.error) || 'No he podido responder ahora mismo.', 'assistant');
      })
      .catch(function () {
        removeTyping(messages);
        appendMessage(messages, 'No he podido conectar con TALIA ahora mismo.', 'assistant');
      });
  }

  function appendMessage(container, text, role, typing) {
    var item = document.createElement('div');
    item.className = 'message ' + role;
    if (typing) item.setAttribute('data-typing', 'true');
    item.textContent = text;
    container.appendChild(item);
    container.scrollTop = container.scrollHeight;
  }

  function removeTyping(container) {
    var typing = container.querySelector('[data-typing]');
    if (typing) typing.remove();
  }

  function getChatErrorMessage(error) {
    if (error === 'domain_not_allowed') return 'Este dominio no está autorizado para usar este asistente de TALIA.';
    return error || null;
  }

  function installNavigationObserver() {
    if (window.__taliaNavigationObserverInstalled) return;
    window.__taliaNavigationObserverInstalled = true;

    var originalPushState = history.pushState;
    var originalReplaceState = history.replaceState;

    history.pushState = function () {
      var result = originalPushState.apply(this, arguments);
      schedulePageContextSync(450);
      schedulePageContextSync(1400);
      return result;
    };

    history.replaceState = function () {
      var result = originalReplaceState.apply(this, arguments);
      schedulePageContextSync(450);
      return result;
    };

    window.addEventListener('popstate', function () {
      schedulePageContextSync(450);
      schedulePageContextSync(1400);
    });

    window.addEventListener('hashchange', function () {
      schedulePageContextSync(250);
      schedulePageContextSync(1000);
    });
  }

  function schedulePageContextSync(delay) {
    window.setTimeout(function () {
      registerInstalledPage();
      maybeCaptureInstalledPage();
    }, delay);
  }

  function registerInstalledPage() {
    var pageUrl = getCurrentPageUrl();
    var key = 'talia-installed-page-' + tenantId + '-' + pageUrl;
    var lastSeen = Number(localStorage.getItem(key) || '0');
    if (Date.now() - lastSeen < 10 * 60 * 1000) return;

    fetch(baseUrl + '/api/widget/' + tenantId + '/installed-page', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url: pageUrl,
        title: document.title || '',
      }),
    })
      .then(function (response) {
        if (response.ok) localStorage.setItem(key, String(Date.now()));
      })
      .catch(function (error) {
        console.warn('[TALIA] Could not register installed page', error);
      });
  }

  function maybeCaptureInstalledPage() {
    var params = getCaptureParams();
    if (params.get('talia_capture') !== '1') return;

    var token = params.get('talia_capture_token');
    if (!token) return;
    var batchToken = params.get('talia_capture_batch');
    var batchIndex = Number(params.get('talia_capture_index') || '0');
    var batchTotal = Number(params.get('talia_capture_total') || '0');
    var captureApiBase = (params.get('talia_capture_api_base') || baseUrl).replace(/\/$/, '');
    var batchPosition = batchToken && batchTotal > 1
      ? ' (' + Math.min(batchIndex + 1, batchTotal) + '/' + batchTotal + ')'
      : '';

    notifyCapture('TALIA está capturando el contenido visible de esta página' + batchPosition + '...');
    waitForCapturableText()
      .then(function (pageText) {
        if (!pageText || pageText.length < 40) {
          cleanCaptureParams();
          notifyCapture('TALIA no ha encontrado contenido visible suficiente en esta página.');
          return;
        }

        return fetch(captureApiBase + '/api/widget/' + tenantId + '/capture', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            token: token,
            url: getCurrentPageUrl(),
            title: document.title || '',
            text: pageText,
          }),
        });
      })
      .then(function (response) {
        if (!response) return null;
        return response.json().then(function (body) { return { response: response, body: body }; });
      })
      .then(function (result) {
        if (!result) return;
        if (!result.response.ok || result.body.error) {
          cleanCaptureParams();
          notifyCapture(getCaptureErrorMessage(result.body.error));
          return;
        }
        if (batchToken) {
          continueCaptureBatch(captureApiBase, batchToken, batchIndex, batchTotal);
          return;
        }
        notifyCapture('Contenido capturado. Ya puedes volver a Ágora.');
      })
      .catch(function () {
        cleanCaptureParams();
        notifyCapture('TALIA no ha podido capturar esta página. Revisa la fuente en Ágora.');
      });
  }

  function waitForCapturableText() {
    var startedAt = Date.now();
    var timeoutMs = 10000;
    var intervalMs = 300;
    var bestText = '';

    return new Promise(function (resolve) {
      function tick() {
        var text = extractVisiblePageText();
        if (text.length > bestText.length) bestText = text;
        if (text.length >= 120 && document.readyState === 'complete') {
          resolve(text);
          return;
        }
        if (text.length >= 240) {
          resolve(text);
          return;
        }
        if (Date.now() - startedAt >= timeoutMs) {
          resolve(bestText || text);
          return;
        }
        window.setTimeout(tick, intervalMs);
      }

      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function () {
          window.setTimeout(tick, 250);
        }, { once: true });
      } else {
        window.setTimeout(tick, 250);
      }
    });
  }

  function getCaptureErrorMessage(error) {
    if (error === 'origin_mismatch') return 'TALIA no ha podido validar el dominio de esta página.';
    if (error === 'domain_not_allowed') return 'Este dominio no está autorizado para capturar contenido con TALIA.';
    if (error === 'capture_token_mismatch') return 'La URL de captura ya no coincide con esta página. Vuelve a abrir la captura desde Ágora.';
    if (error === 'expired_capture_token') return 'La captura ha caducado. Vuelve a abrirla desde Ágora.';
    if (error === 'La página no contiene texto suficiente para indexar.') return error;
    return 'TALIA no ha podido capturar esta página. Revisa la fuente en Ágora.';
  }

  function continueCaptureBatch(captureApiBase, batchToken, batchIndex, batchTotal) {
    notifyCapture('Página capturada. Preparando la siguiente...');
    fetch(captureApiBase + '/api/widget/' + tenantId + '/capture-next', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        batchToken: batchToken,
        currentIndex: batchIndex,
      }),
    })
      .then(function (response) { return response.json().then(function (body) { return { response: response, body: body }; }); })
      .then(function (result) {
        if (!result.response.ok || result.body.error) {
          cleanCaptureParams();
          notifyCapture('Captura parcial completada. Revisa la fuente en Ágora.');
          return;
        }
        if (result.body.done) {
          notifyCapture('Captura completada. TALIA ya está preparando el contenido.');
          cleanCaptureParams();
          return;
        }
        notifyCapture('Abriendo página ' + (Number(result.body.nextIndex || 0) + 1) + '/' + (result.body.total || batchTotal) + '...');
        window.location.href = result.body.captureUrl;
      })
      .catch(function () {
        cleanCaptureParams();
        notifyCapture('Captura parcial completada. Revisa la fuente en Ágora.');
      });
  }

  function getCurrentPageUrl() {
    var resolvedUrl = getCanonicalPageUrl();
    if (resolvedUrl) return resolvedUrl;

    var url = new URL(window.location.href);
    url.hash = '';
    url.searchParams.delete('talia_capture');
    url.searchParams.delete('talia_capture_token');
    url.searchParams.delete('talia_capture_api_base');
    url.searchParams.delete('talia_capture_batch');
    url.searchParams.delete('talia_capture_index');
    url.searchParams.delete('talia_capture_total');
    return url.toString();
  }

  function getCanonicalPageUrl() {
    var explicitUrl = normalizePublicPageUrl(pageUrlOverride);
    if (explicitUrl) return explicitUrl;

    var mappedUrl = getMappedSiteOriginUrl(siteOriginOverride);
    if (mappedUrl) return mappedUrl;

    var canonical = document.querySelector('link[rel="canonical"]');
    var canonicalUrl = canonical ? normalizePublicPageUrl(canonical.getAttribute('href')) : null;
    if (canonicalUrl) return canonicalUrl;

    var ogUrl = document.querySelector('meta[property="og:url"], meta[name="og:url"]');
    var openGraphUrl = ogUrl ? normalizePublicPageUrl(ogUrl.getAttribute('content')) : null;
    if (openGraphUrl) return openGraphUrl;

    return null;
  }

  function getMappedSiteOriginUrl(originValue) {
    if (!originValue) return null;
    try {
      var origin = new URL(originValue);
      var current = new URL(window.location.href);
      var url = new URL(origin.origin);
      url.pathname = current.pathname;
      url.search = current.search;
      url.searchParams.delete('talia_capture');
      url.searchParams.delete('talia_capture_token');
      url.searchParams.delete('talia_capture_api_base');
      url.searchParams.delete('talia_capture_batch');
      url.searchParams.delete('talia_capture_index');
      url.searchParams.delete('talia_capture_total');
      url.hash = '';
      return url.toString();
    } catch {
      return null;
    }
  }

  function normalizePublicPageUrl(value) {
    if (!value) return null;
    try {
      var url = new URL(value, window.location.href);
      if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
      url.hash = '';
      url.searchParams.delete('talia_capture');
      url.searchParams.delete('talia_capture_token');
      url.searchParams.delete('talia_capture_api_base');
      url.searchParams.delete('talia_capture_batch');
      url.searchParams.delete('talia_capture_index');
      url.searchParams.delete('talia_capture_total');
      return url.toString();
    } catch {
      return null;
    }
  }

  function cleanCaptureParams() {
    try {
      var url = new URL(window.location.href);
      url.searchParams.delete('talia_capture');
      url.searchParams.delete('talia_capture_token');
      url.searchParams.delete('talia_capture_api_base');
      url.searchParams.delete('talia_capture_batch');
      url.searchParams.delete('talia_capture_index');
      url.searchParams.delete('talia_capture_total');
      if (url.hash) {
        var hashParams = getHashSearchParams(url.hash);
        if (hashParams.get('talia_capture') === '1') {
          hashParams.delete('talia_capture');
          hashParams.delete('talia_capture_token');
          hashParams.delete('talia_capture_api_base');
          hashParams.delete('talia_capture_batch');
          hashParams.delete('talia_capture_index');
          hashParams.delete('talia_capture_total');
          var nextHash = hashParams.toString();
          url.hash = nextHash ? nextHash : '';
        }
      }
      window.history.replaceState({}, document.title, url.toString());
    } catch {}
  }

  function getCaptureParams() {
    var hashParams = getHashSearchParams(window.location.hash);
    if (hashParams.get('talia_capture') === '1') return hashParams;
    return new URLSearchParams(window.location.search);
  }

  function getHashSearchParams(hash) {
    var value = hash || '';
    if (value.charAt(0) === '#') value = value.slice(1);
    if (value.charAt(0) === '?') value = value.slice(1);
    if (value.indexOf('talia_capture=') === -1) return new URLSearchParams();
    return new URLSearchParams(value);
  }

  function extractVisiblePageText() {
    var clone = document.body.cloneNode(true);
    clone.querySelectorAll('script, style, noscript, svg, iframe, canvas, nav, footer, form, input, textarea, select, button, [aria-hidden="true"], #talia-widget-root, #talia-capture-notice').forEach(function (node) {
      node.remove();
    });

    var text = clone.innerText || clone.textContent || '';
    return text
      .replace(/\r/g, '\n')
      .replace(/[ \t]+/g, ' ')
      .replace(/\n{3,}/g, '\n\n')
      .trim()
      .slice(0, 200000);
  }

  function notifyCapture(message) {
    var id = 'talia-capture-notice';
    var notice = document.getElementById(id);
    if (!notice) {
      notice = document.createElement('div');
      notice.id = id;
      notice.style.position = 'fixed';
      notice.style.left = '50%';
      notice.style.bottom = '24px';
      notice.style.transform = 'translateX(-50%)';
      notice.style.zIndex = '2147483647';
      notice.style.maxWidth = 'min(520px, calc(100vw - 32px))';
      notice.style.borderRadius = '999px';
      notice.style.background = '#111827';
      notice.style.color = '#fff';
      notice.style.boxShadow = '0 10px 30px rgba(0,0,0,.22)';
      notice.style.font = '600 14px system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
      notice.style.padding = '12px 16px';
      document.body.appendChild(notice);
    }
    notice.textContent = message;
  }

  function getTemplate(assistantName, initialMessage, primaryColor, position) {
    var togglePosition = getTogglePositionCss(position);
    var panelPosition = getPanelPositionCss(position);
    var transformOrigin = position.indexOf('left') >= 0
      ? (position.indexOf('top') >= 0 ? 'top left' : 'bottom left')
      : (position.indexOf('top') >= 0 ? 'top right' : 'bottom right');

    return '\
      <style>\
        :host { all: initial; font-family: "Space Grotesk", ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }\
        .toggle { position: fixed; ' + togglePosition + ' z-index: 2147483647; width: 64px; height: 64px; border: 0; border-radius: 999px; background: ' + primaryColor + '; color: white; cursor: pointer; display: grid; place-items: center; box-shadow: 0 4px 16px rgba(0,0,0,.18); transition: transform 150ms ease, box-shadow 150ms ease; }\
        .toggle:hover { transform: scale(1.08); box-shadow: 0 6px 20px rgba(0,0,0,.22); }\
        .toggle:active { transform: scale(0.94); }\
        .toggle svg { width: 31px; height: 31px; display: block; }\
        .panel { position: fixed; ' + panelPosition + ' z-index: 2147483647; width: min(400px, calc(100vw - 32px)); height: min(580px, calc(100vh - 112px)); max-height: calc(100vh - 112px); background: white; color: #1A1A2E; border: .5px solid rgba(26,26,46,.12); border-radius: 12px; overflow: hidden; display: grid; grid-template-rows: auto 1fr auto; opacity: 0; transform: translateY(14px) scale(0.97); transform-origin: ' + transformOrigin + '; pointer-events: none; transition: opacity 280ms cubic-bezier(0.16,1,0.3,1), transform 280ms cubic-bezier(0.16,1,0.3,1), box-shadow 280ms cubic-bezier(0.16,1,0.3,1); box-shadow: 0 0 0 rgba(0,0,0,0); }\
        .panel--open { opacity: 1 !important; transform: translateY(0) scale(1) !important; pointer-events: auto !important; box-shadow: 0 12px 40px rgba(0,0,0,.16) !important; }\
        .header { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 15px 18px; background: ' + primaryColor + '; color: white; font: 600 17px "Space Grotesk", system-ui; }\
        .close { border: 0; background: transparent; color: white; font-size: 22px; cursor: pointer; line-height: 1; }\
        .messages { padding: 16px; overflow: auto; display: flex; flex-direction: column; gap: 11px; background: #F5F2EC; }\
        .message { max-width: 84%; border-radius: 13px; padding: 11px 13px; font: 15px/1.45 "Space Grotesk", system-ui; white-space: pre-wrap; }\
        .assistant { align-self: flex-start; background: #fff; color: #1A1A2E; }\
        .user { align-self: flex-end; background: ' + primaryColor + '; color: white; }\
        .form { display: flex; gap: 9px; padding: 13px; border-top: .5px solid rgba(26,26,46,.12); }\
        .input { min-width: 0; flex: 1; border: .5px solid rgba(26,26,46,.25); border-radius: 7px; padding: 11px; font: 15px "Space Grotesk", system-ui; }\
        .send { border: 0; border-radius: 7px; padding: 0 14px; background: ' + primaryColor + '; color: white; font: 600 14px "Space Grotesk", system-ui; cursor: pointer; }\
      </style>\
      <section class="panel" data-panel>\
        <div class="header"><span>' + escapeHtml(assistantName) + '</span><button class="close" data-close aria-label="Cerrar">×</button></div>\
        <div class="messages" data-messages><div class="message assistant">' + escapeHtml(initialMessage) + '</div></div>\
        <form class="form" data-form><input class="input" data-input placeholder="Escribe tu mensaje..." autocomplete="off" /><button class="send" type="submit">Enviar</button></form>\
      </section>\
      <button class="toggle" data-toggle aria-label="Abrir asistente virtual">\
        <svg viewBox="0 0 28 28" aria-hidden="true" focusable="false" fill="none" xmlns="http://www.w3.org/2000/svg">\
          <path d="M5.25 6.8C5.25 4.98 6.73 3.5 8.55 3.5h10.9c1.82 0 3.3 1.48 3.3 3.3v7.7c0 1.82-1.48 3.3-3.3 3.3h-6.17l-5.1 4.2v-4.2h.37c-1.82 0-3.3-1.48-3.3-3.3V6.8Z" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round"/>\
          <path d="M10 10.5h7.2M10 14h4.8" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>\
        </svg>\
      </button>';
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, function (char) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char];
    });
  }

  function getPosition(value) {
    return value === 'bottom-left' || value === 'top-right' || value === 'top-left'
      ? value
      : 'bottom-right';
  }

  function getTogglePositionCss(position) {
    if (position === 'bottom-left') return 'left: var(--talia-floating-inline-offset, 20px); bottom: var(--talia-floating-toggle-offset, 20px);';
    if (position === 'top-right') return 'right: var(--talia-floating-inline-offset, 20px); top: var(--talia-floating-toggle-offset, 20px);';
    if (position === 'top-left') return 'left: var(--talia-floating-inline-offset, 20px); top: var(--talia-floating-toggle-offset, 20px);';
    return 'right: var(--talia-floating-inline-offset, 20px); bottom: var(--talia-floating-toggle-offset, 20px);';
  }

  function getPanelPositionCss(position) {
    if (position === 'bottom-left') return 'left: var(--talia-floating-inline-offset, 20px); bottom: var(--talia-floating-panel-offset, 88px);';
    if (position === 'top-right') return 'right: var(--talia-floating-inline-offset, 20px); top: var(--talia-floating-panel-offset, 88px);';
    if (position === 'top-left') return 'left: var(--talia-floating-inline-offset, 20px); top: var(--talia-floating-panel-offset, 88px);';
    return 'right: var(--talia-floating-inline-offset, 20px); bottom: var(--talia-floating-panel-offset, 88px);';
  }

  function registerFloatingWidget(host, type, position) {
    var registry = getFloatingRegistry();
    registry.items = registry.items.filter(function (item) {
      return item.host && item.host.isConnected && item.type !== type;
    });
    registry.items.push({ host: host, type: type, position: position });
    updateFloatingWidgets(registry);
  }

  function getFloatingRegistry() {
    var key = '__taliaFloatingWidgets';
    window[key] = window[key] || { items: [] };
    return window[key];
  }

  function updateFloatingWidgets(registry) {
    var baseOffset = 20;
    var widgetSize = 64;
    var gap = 12;
    var panelGap = 12;
    var priority = { chatbot: 0, accessibility: 1 };
    var groups = {};

    registry.items = registry.items.filter(function (item) {
      return item.host && item.host.isConnected;
    });

    registry.items.forEach(function (item) {
      groups[item.position] = groups[item.position] || [];
      groups[item.position].push(item);
    });

    Object.keys(groups).forEach(function (position) {
      groups[position]
        .sort(function (a, b) { return (priority[a.type] || 9) - (priority[b.type] || 9); })
        .forEach(function (item, index) {
          var toggleOffset = baseOffset + (index * (widgetSize + gap));
          var panelOffset = toggleOffset + widgetSize + panelGap;
          item.host.style.setProperty('--talia-floating-inline-offset', baseOffset + 'px');
          item.host.style.setProperty('--talia-floating-toggle-offset', toggleOffset + 'px');
          item.host.style.setProperty('--talia-floating-panel-offset', panelOffset + 'px');
        });
    });
  }
})();
