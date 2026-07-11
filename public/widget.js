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
    var widgetSize = getWidgetSize(config.widgetSize || config.size || script.getAttribute('data-size'));
    var inlineOffset = getPixelOffset(config.inlineOffset || script.getAttribute('data-inline-offset'), 20);
    var blockOffset = getPixelOffset(config.blockOffset || script.getAttribute('data-block-offset'), 20);
    var collisionStrategy = getCollisionStrategy(config.collisionStrategy || script.getAttribute('data-collision-strategy'));
    var widgetTheme = getWidgetTheme(config.widgetTheme || script.getAttribute('data-theme'));
    var glassBackground = getGlassBackground(config.glassBackground || script.getAttribute('data-glass-background'));
    var glassBlur = getGlassBlur(config.glassBlur != null ? config.glassBlur : script.getAttribute('data-glass-blur'));
    var glassTranslucency = getGlassTranslucency(config.glassTranslucency != null ? config.glassTranslucency : script.getAttribute('data-glass-translucency'));
    var host = document.createElement('div');
    host.id = 'talia-widget-root';
    document.body.appendChild(host);
    registerFloatingWidget(host, 'chatbot', position, {
      widgetSize: widgetSize,
      inlineOffset: inlineOffset,
      blockOffset: blockOffset,
      collisionStrategy: collisionStrategy
    });

    var root = host.attachShadow({ mode: 'open' });
    root.innerHTML = getTemplate(assistantName, initialMessage, primaryColor, position, widgetSize, widgetTheme, glassBackground, glassBlur, glassTranslucency);

    var panel = root.querySelector('[data-panel]');
    var toggle = root.querySelector('[data-toggle]');
    var close = root.querySelector('[data-close]');
    var form = root.querySelector('[data-form]');
    var input = root.querySelector('[data-input]');
    var messages = root.querySelector('[data-messages]');

    toggle.setAttribute('aria-expanded', 'false');

    // Liquid-glass pointer highlight on the floating toggle only (never the open panel).
    var prefersReducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (widgetTheme === 'glass' && !prefersReducedMotion) {
      toggle.addEventListener('pointermove', function (event) {
        var rect = toggle.getBoundingClientRect();
        toggle.style.setProperty('--tmx', ((event.clientX - rect.left) / rect.width * 100) + '%');
        toggle.style.setProperty('--tmy', ((event.clientY - rect.top) / rect.height * 100) + '%');
      });
      toggle.addEventListener('pointerleave', function () {
        toggle.style.setProperty('--tmx', '50%');
        toggle.style.setProperty('--tmy', '12%');
      });
    }

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
        appendMessage(messages, data.reply || getChatErrorMessage(data.error) || 'No he podido responder ahora mismo.', 'assistant', false, data.actions);
      })
      .catch(function () {
        removeTyping(messages);
        appendMessage(messages, 'No he podido conectar con TALIA ahora mismo.', 'assistant');
      });
  }

  function appendMessage(container, text, role, typing, actions) {
    var item = document.createElement('div');
    item.className = 'message ' + role;
    if (typing) item.setAttribute('data-typing', 'true');
    appendMessageContent(item, text, actions);
    container.appendChild(item);
    container.scrollTop = container.scrollHeight;
  }

  function appendMessageContent(container, text, actions) {
    var value = String(text || '');
    var urlPattern = /https?:\/\/[^\s]+/g;
    var safeActions = normalizeMessageActions(actions);
    var cursor = 0;
    while (cursor < value.length) {
      urlPattern.lastIndex = cursor;
      var urlMatch = urlPattern.exec(value);
      var actionMatch = findNextActionMatch(value, cursor, safeActions);
      var useAction = actionMatch && (!urlMatch || actionMatch.index <= urlMatch.index);
      var match = useAction ? actionMatch : urlMatch;
      if (!match) break;

      if (match.index > cursor) container.appendChild(document.createTextNode(value.slice(cursor, match.index)));
      var link = document.createElement('a');
      link.href = useAction ? match.action.href : match[0];
      link.textContent = useAction ? match.action.label : match[0];
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      container.appendChild(link);
      cursor = match.index + (useAction ? match.action.label.length : match[0].length);
    }

    if (cursor < value.length) container.appendChild(document.createTextNode(value.slice(cursor)));
  }

  function normalizeMessageActions(actions) {
    if (!Array.isArray(actions)) return [];
    return actions.filter(function (action) {
      if (!action || action.type !== 'whatsapp' || typeof action.label !== 'string' || typeof action.href !== 'string') return false;
      if (!action.label || action.label.length > 100) return false;
      try {
        var url = new URL(action.href);
        return url.protocol === 'https:' && url.hostname === 'wa.me' && /^\/\d{8,15}$/.test(url.pathname);
      } catch {
        return false;
      }
    });
  }

  function findNextActionMatch(value, cursor, actions) {
    var best = null;
    actions.forEach(function (action) {
      var prefix = 'WhatsApp: ';
      var tokenIndex = value.indexOf(prefix + action.label, cursor);
      if (tokenIndex === -1) return;
      var labelIndex = tokenIndex + prefix.length;
      if (!best || labelIndex < best.index) best = { index: labelIndex, action: action };
    });
    return best;
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
        title: getSafeDocumentTitle(),
      }),
    })
      .then(function (response) {
        if (response.ok) localStorage.setItem(key, String(Date.now()));
        if (!response.ok) {
          response.json()
            .then(function (data) {
              console.warn('[TALIA] Could not register installed page', data);
            })
            .catch(function () {
              console.warn('[TALIA] Could not register installed page', response.status);
            });
        }
      })
      .catch(function (error) {
        console.warn('[TALIA] Could not register installed page', error);
      });
  }

  function getSafeDocumentTitle() {
    var title = (document.title || '').trim();
    return title.length > 200 ? title.slice(0, 200) : title;
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

  function getTemplate(assistantName, initialMessage, primaryColor, position, widgetSize, widgetTheme, glassBackground, glassBlur, glassTranslucency) {
    var togglePosition = getTogglePositionCss(position);
    var panelPosition = getPanelPositionCss(position);
    var toggleSize = getWidgetSizePixels(widgetSize);
    var toggleIconSize = Math.round(toggleSize * 0.48);
    var transformOrigin = position.indexOf('left') >= 0
      ? (position.indexOf('top') >= 0 ? 'top left' : 'bottom left')
      : (position.indexOf('top') >= 0 ? 'top right' : 'bottom right');

    // Glass ("liquid glass") material: translucent, frosted chrome that blends with
    // the host site. The reading zone stays on a solid, legible surface (only the
    // chrome is translucent). The look mirrors the Agora preview (getGlassSkin in
    // settings-form.tsx). Falls back to opaque under reduced transparency.
    var glass = widgetTheme === 'glass';
    var skin = getGlassSkin(primaryColor, glassBackground, glassTranslucency);
    var filter = 'blur(' + glassBlur + 'px) saturate(200%) brightness(' + skin.bright + ')';
    var glassFilter = glass ? 'backdrop-filter: ' + filter + '; -webkit-backdrop-filter: ' + filter + ';' : '';

    var panelBackground = glass ? skin.panelFill : 'white';
    var panelBorder = glass ? 'border: 0;' : 'border: .5px solid rgba(26,26,46,.12);';
    var panelInset = glass ? ', inset 0 1.5px 0 ' + skin.spec + ', inset 0 -1px 0 ' + skin.spec2 + ', inset 0 0 0 1px ' + skin.hairline : '';
    var panelShadow = glass ? skin.shadow : '0 0 0 rgba(0,0,0,0)';
    var panelOpenShadow = glass ? skin.shadow : '0 12px 40px rgba(0,0,0,.16)';
    var headerBackground = glass ? skin.chromeFill : primaryColor;
    var headerFilter = glass ? glassFilter + ' box-shadow: inset 0 1px 0 ' + skin.spec + ';' : '';
    var messagesBackground = glass ? skin.msgSurface : '#F5F2EC';
    var botBubbleBackground = glass ? skin.botBubble : '#fff';
    var botBubbleColor = glass ? skin.botText : '#1A1A2E';
    var formBackground = glass ? skin.chromeFill : 'transparent';
    var formFilter = glass ? glassFilter : '';
    var formBorder = glass ? 'box-shadow: inset 0 1px 0 ' + skin.spec + ';' : 'border-top: .5px solid rgba(26,26,46,.12);';
    var inputBackground = glass ? 'rgba(255,255,255,.82)' : '#fff';
    var toggleBackground = glass ? skin.toggleFill : primaryColor;
    var toggleFilter = glass ? glassFilter : '';
    var toggleShadow = glass
      ? skin.shadow + ', inset 0 1.5px 0 ' + skin.spec + ', inset 0 0 0 1px ' + skin.hairline
      : '0 4px 16px rgba(0,0,0,.18)';
    var specularBand = glass
      ? '.panel::before { content: ""; position: absolute; inset: 0 0 auto 0; height: 45%; border-radius: inherit; background: linear-gradient(180deg, rgba(255,255,255,.22), rgba(255,255,255,0) 90%); pointer-events: none; }'
      : '';
    // Pointer-following specular highlight — only on the floating toggle, never on
    // the open chat panel. --tmx/--tmy are updated on pointermove (see mountWidget).
    var sheenRadius = Math.round(toggleSize * 0.7);
    var toggleSheen = glass
      ? '.toggle::after { content: ""; position: absolute; inset: 0; border-radius: inherit; background: radial-gradient(circle ' + sheenRadius + 'px at var(--tmx, 50%) var(--tmy, 12%), rgba(255,255,255,.55), rgba(255,255,255,0) 70%); mix-blend-mode: screen; pointer-events: none; }'
      : '';
    var reducedTransparencyFallback = glass
      ? '@media (prefers-reduced-transparency: reduce) {'
        + ' .panel { background: ' + (glassBackground === 'dark' ? '#1b1622' : '#fff') + '; backdrop-filter: none; -webkit-backdrop-filter: none; }'
        + ' .panel::before { display: none; }'
        + ' .header { background: ' + primaryColor + '; backdrop-filter: none; -webkit-backdrop-filter: none; }'
        + ' .messages { background: ' + (glassBackground === 'dark' ? '#161019' : '#F5F2EC') + '; }'
        + ' .form { background: ' + (glassBackground === 'dark' ? '#1b1622' : '#fff') + '; backdrop-filter: none; -webkit-backdrop-filter: none; }'
        + ' .toggle { background: ' + primaryColor + '; backdrop-filter: none; -webkit-backdrop-filter: none; }'
        + ' .toggle::after { display: none; }'
        + ' }'
      : '';

    return '\
      <style>\
        :host { all: initial; font-family: "Space Grotesk", ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }\
        .toggle { position: fixed; ' + togglePosition + ' z-index: 2147483647; width: ' + toggleSize + 'px; height: ' + toggleSize + 'px; border: 0; border-radius: 999px; background: ' + toggleBackground + '; ' + toggleFilter + ' color: white; cursor: pointer; display: grid; place-items: center; box-shadow: ' + toggleShadow + '; transition: transform 150ms ease, box-shadow 150ms ease; }\
        .toggle:hover { transform: scale(1.08); }\
        .toggle:active { transform: scale(0.94); }\
        .toggle svg { position: relative; z-index: 1; width: ' + toggleIconSize + 'px; height: ' + toggleIconSize + 'px; display: block; }\
        ' + toggleSheen + '\
        .panel { position: fixed; ' + panelPosition + ' z-index: 2147483647; width: min(400px, calc(100vw - 32px)); height: min(580px, calc(100vh - 112px)); max-height: calc(100vh - 112px); background: ' + panelBackground + '; ' + glassFilter + ' color: #1A1A2E; ' + panelBorder + ' border-radius: 14px; overflow: hidden; display: grid; grid-template-rows: auto 1fr auto; opacity: 0; transform: translateY(14px) scale(0.97); transform-origin: ' + transformOrigin + '; pointer-events: none; transition: opacity 280ms cubic-bezier(0.16,1,0.3,1), transform 280ms cubic-bezier(0.16,1,0.3,1), box-shadow 280ms cubic-bezier(0.16,1,0.3,1); box-shadow: ' + panelShadow + panelInset + '; }\
        .panel--open { opacity: 1 !important; transform: translateY(0) scale(1) !important; pointer-events: auto !important; box-shadow: ' + panelOpenShadow + panelInset + ' !important; }\
        ' + specularBand + '\
        .header { position: relative; display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 15px 18px; background: ' + headerBackground + '; ' + headerFilter + ' color: white; font: 600 17px "Space Grotesk", system-ui; }\
        .close { border: 0; background: transparent; color: white; font-size: 22px; cursor: pointer; line-height: 1; }\
        .messages { position: relative; padding: 16px; overflow: auto; display: flex; flex-direction: column; gap: 11px; background: ' + messagesBackground + '; }\
        .message { max-width: 84%; border-radius: 13px; padding: 11px 13px; font: 15px/1.45 "Space Grotesk", system-ui; white-space: pre-wrap; }\
        .message a { color: inherit; text-decoration: underline; overflow-wrap: anywhere; }\
        .assistant { align-self: flex-start; background: ' + botBubbleBackground + '; color: ' + botBubbleColor + '; box-shadow: 0 1px 2px rgba(0,0,0,.06); }\
        .user { align-self: flex-end; background: ' + primaryColor + '; color: white; }\
        .form { display: flex; gap: 9px; padding: 13px; background: ' + formBackground + '; ' + formFilter + ' ' + formBorder + ' }\
        .input { min-width: 0; flex: 1; border: .5px solid rgba(26,26,46,.25); border-radius: 7px; padding: 11px; font: 15px "Space Grotesk", system-ui; background: ' + inputBackground + '; }\
        .send { border: 0; border-radius: 7px; padding: 0 14px; background: ' + primaryColor + '; color: white; font: 600 14px "Space Grotesk", system-ui; cursor: pointer; }\
        @media (prefers-reduced-motion: reduce) { .panel { transition: opacity 120ms ease; } .toggle { transition: none; } }\
        ' + reducedTransparencyFallback + '\
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

  function getPixelOffset(value, fallback) {
    var numericValue = Number(value);
    if (!Number.isFinite(numericValue)) return fallback;
    return Math.min(320, Math.max(12, Math.round(numericValue)));
  }

  function getCollisionStrategy(value) {
    return value === 'none' ? 'none' : 'auto';
  }

  function getWidgetTheme(value) {
    return value === 'glass' ? 'glass' : 'solid';
  }

  function getGlassBackground(value) {
    return value === 'dark' ? 'dark' : 'light';
  }

  function getGlassBlur(value) {
    if (value == null || value === '') return 18;
    var numeric = Number(value);
    if (!Number.isFinite(numeric)) return 18;
    return Math.min(30, Math.max(0, Math.round(numeric)));
  }

  function getGlassTranslucency(value) {
    if (value == null || value === '') return 58;
    var numeric = Number(value);
    if (!Number.isFinite(numeric)) return 58;
    return Math.min(85, Math.max(15, Math.round(numeric)));
  }

  // Glass material tokens. Mirrors getGlassSkin in settings-form.tsx (the Agora
  // preview) so the live preview and the deployed widget look identical.
  // `translucency` is 15-85 where higher = more see-through chrome.
  function getGlassSkin(color, background, translucency) {
    var alpha = Math.min(0.85, Math.max(0.15, (100 - translucency) / 100));
    if (background === 'dark') {
      return {
        bright: 1.16,
        panelFill: 'color-mix(in srgb, ' + color + ' 16%, rgba(46,36,52,' + alpha + '))',
        chromeFill: 'color-mix(in srgb, ' + color + ' 40%, rgba(40,30,46,' + (alpha * 0.85) + '))',
        toggleFill: 'color-mix(in srgb, ' + color + ' 54%, rgba(60,44,66,0.3))',
        spec: 'rgba(255,255,255,0.62)',
        spec2: 'rgba(255,255,255,0.22)',
        hairline: 'rgba(255,255,255,0.14)',
        msgSurface: 'rgba(30,23,36,0.55)',
        botBubble: 'rgba(255,255,255,0.15)',
        botText: '#f3ecf3',
        shadow: '0 20px 50px -14px rgba(0,0,0,0.62)'
      };
    }
    return {
      bright: 1.04,
      panelFill: 'color-mix(in srgb, ' + color + ' 8%, rgba(255,255,255,' + alpha + '))',
      chromeFill: 'color-mix(in srgb, ' + color + ' 40%, rgba(255,255,255,' + (alpha * 0.7) + '))',
      toggleFill: 'color-mix(in srgb, ' + color + ' 56%, rgba(255,255,255,0.22))',
      spec: 'rgba(255,255,255,0.9)',
      spec2: 'rgba(255,255,255,0.4)',
      hairline: 'rgba(255,255,255,0.6)',
      msgSurface: 'rgba(250,248,243,0.55)',
      botBubble: '#ffffff',
      botText: '#211018',
      shadow: '0 18px 45px -14px rgba(40,10,25,0.42)'
    };
  }

  function getWidgetSize(value) {
    return value === 'small' || value === 'large' ? value : 'medium';
  }

  function getWidgetSizePixels(value) {
    if (value === 'small') return 56;
    if (value === 'large') return 72;
    return 64;
  }

  function getCollisionPixelOffset(value) {
    var numericValue = Number(value);
    if (!Number.isFinite(numericValue)) return 0;
    return Math.min(320, Math.max(0, Math.round(numericValue)));
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

  function registerFloatingWidget(host, type, position, options) {
    var registry = getFloatingRegistry();
    registry.items = registry.items.filter(function (item) {
      return item.host && item.host.isConnected && item.type !== type;
    });
    registry.items.push({
      host: host,
      type: type,
      position: position,
      widgetSize: getWidgetSize(options && options.widgetSize),
      inlineOffset: getPixelOffset(options && options.inlineOffset, 20),
      blockOffset: getPixelOffset(options && options.blockOffset, 20),
      collisionStrategy: getCollisionStrategy(options && options.collisionStrategy),
      collisionOffset: 0
    });
    updateFloatingWidgets(registry);
    installFloatingCollisionObserver(registry);
  }

  function getFloatingRegistry() {
    var key = '__taliaFloatingWidgets';
    window[key] = window[key] || { items: [] };
    return window[key];
  }

  function updateFloatingWidgets(registry) {
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
          var inlineOffset = getPixelOffset(item.inlineOffset, 20);
          var baseBlockOffset = getPixelOffset(item.blockOffset, 20);
          var collisionOffset = getCollisionPixelOffset(item.collisionOffset);
          var widgetSize = getWidgetSizePixels(item.widgetSize);
          var toggleOffset = Math.max(baseBlockOffset, collisionOffset) + (index * (widgetSize + gap));
          var panelOffset = toggleOffset + widgetSize + panelGap;
          item.host.style.setProperty('--talia-floating-inline-offset', inlineOffset + 'px');
          item.host.style.setProperty('--talia-floating-toggle-offset', toggleOffset + 'px');
          item.host.style.setProperty('--talia-floating-panel-offset', panelOffset + 'px');
        });
    });
  }

  function installFloatingCollisionObserver(registry) {
    if (registry.collisionObserverInstalled) {
      scheduleFloatingCollisionCheck(registry, 80);
      return;
    }
    registry.collisionObserverInstalled = true;
    var schedule = function () { scheduleFloatingCollisionCheck(registry, 120); };
    window.addEventListener('resize', schedule, { passive: true });
    window.addEventListener('scroll', schedule, { passive: true });
    scheduleFloatingCollisionCheck(registry, 80);
    scheduleFloatingCollisionCheck(registry, 800);
    scheduleFloatingCollisionCheck(registry, 1800);
  }

  function scheduleFloatingCollisionCheck(registry, delay) {
    window.clearTimeout(registry.collisionTimer);
    registry.collisionTimer = window.setTimeout(function () {
      updateFloatingCollisionOffsets(registry);
      updateFloatingWidgets(registry);
    }, delay);
  }

  function updateFloatingCollisionOffsets(registry) {
    registry.items = registry.items.filter(function (item) {
      return item.host && item.host.isConnected;
    });

    registry.items.forEach(function (item) {
      if (item.collisionStrategy === 'none') {
        item.collisionOffset = 0;
        return;
      }
      item.collisionOffset = getCollisionOffsetForPosition(item.position, item.host);
    });
  }

  function getCollisionOffsetForPosition(position, ownHost) {
    if (!window.innerWidth || !window.innerHeight || !document.body) return 0;

    var viewportWidth = window.innerWidth;
    var viewportHeight = window.innerHeight;
    var cornerSize = 190;
    var clearance = 14;
    var maxOffset = 320;
    var nextOffset = 0;
    var nodes = Array.prototype.slice.call(document.body.querySelectorAll('body *'));

    nodes.forEach(function (node) {
      if (!isExternalFloatingElement(node, ownHost)) return;
      var rect = node.getBoundingClientRect();
      if (!isInSameCorner(rect, position, viewportWidth, viewportHeight, cornerSize)) return;

      if (position.indexOf('bottom') === 0) {
        nextOffset = Math.max(nextOffset, viewportHeight - rect.top + clearance);
      } else {
        nextOffset = Math.max(nextOffset, rect.bottom + clearance);
      }
    });

    return Math.min(maxOffset, Math.max(0, Math.round(nextOffset)));
  }

  function isExternalFloatingElement(node, ownHost) {
    if (!node || node === ownHost) return false;
    if (node.id === 'talia-widget-root' || node.id === 'talia-accessibility-widget-root') return false;
    if (ownHost && ownHost.contains && ownHost.contains(node)) return false;

    var rect = node.getBoundingClientRect();
    if (rect.width < 32 || rect.height < 32) return false;
    if (rect.width > 260 || rect.height > 260) return false;
    if (rect.right <= 0 || rect.bottom <= 0 || rect.left >= window.innerWidth || rect.top >= window.innerHeight) return false;

    var styles = window.getComputedStyle(node);
    if (styles.visibility === 'hidden' || styles.display === 'none' || Number(styles.opacity) === 0) return false;
    if (styles.position !== 'fixed' && styles.position !== 'sticky') return false;
    if (styles.pointerEvents === 'none') return false;

    return true;
  }

  function isInSameCorner(rect, position, viewportWidth, viewportHeight, cornerSize) {
    var nearLeft = rect.left < cornerSize;
    var nearRight = rect.right > viewportWidth - cornerSize;
    var nearTop = rect.top < cornerSize;
    var nearBottom = rect.bottom > viewportHeight - cornerSize;

    if (position === 'bottom-left') return nearLeft && nearBottom;
    if (position === 'top-right') return nearRight && nearTop;
    if (position === 'top-left') return nearLeft && nearTop;
    return nearRight && nearBottom;
  }
})();
