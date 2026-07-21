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
  var installedWebCapture = { enabled: false, mode: 'manual' };
  var sessionId = localStorage.getItem(sessionKey);
  if (!sessionId) {
    sessionId = createSessionId();
    localStorage.setItem(sessionKey, sessionId);
  }

  installNavigationObserver();

  fetch(baseUrl + '/api/widget/' + tenantId)
    .then(function (response) { return response.json(); })
    .then(function (config) {
      if (config.error) throw new Error(config.error);
      installedWebCapture = getInstalledWebCapturePolicy(config.installedWebCapture);
      schedulePageContextSync(0);
      mountWidget(config);
    })
    .catch(function (error) {
      console.warn('[TALIA] Could not load widget config', error);
    });

  function mountWidget(config) {
    var assistantName = config.assistantName || script.getAttribute('data-name') || 'TALIA';
    var initialMessage = config.initialMessage || script.getAttribute('data-initial-message') || 'Hola, soc TALIA. En què et puc ajudar?';
    var proactiveMessage = getProactiveMessage(config.proactiveMessage || script.getAttribute('data-proactive-message'), assistantName);
    var primaryColor = config.primaryColor || script.getAttribute('data-color') || '#000000';
    var position = getPosition(config.position || script.getAttribute('data-position') || 'bottom-right');
    var widgetSize = getWidgetSize(config.widgetSize || config.size || script.getAttribute('data-size'));
    var inlineOffset = getPixelOffset(config.inlineOffset || script.getAttribute('data-inline-offset'), 20);
    var blockOffset = getPixelOffset(config.blockOffset || script.getAttribute('data-block-offset'), 20);
    var collisionStrategy = getCollisionStrategy(config.collisionStrategy || script.getAttribute('data-collision-strategy'));
    var widgetTheme = getWidgetTheme(config.widgetTheme || script.getAttribute('data-theme'));
    var launcherIcon = getLauncherIcon(config.launcherIcon || script.getAttribute('data-icon'));
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
    root.innerHTML = getTemplate(assistantName, initialMessage, proactiveMessage, primaryColor, position, widgetSize, widgetTheme, launcherIcon, glassBackground, glassBlur, glassTranslucency, baseUrl + '/icon.svg');

    var panel = root.querySelector('[data-panel]');
    var welcome = root.querySelector('[data-welcome]');
    var welcomeAction = root.querySelector('[data-welcome-action]');
    var welcomeClose = root.querySelector('[data-welcome-close]');
    var toggle = root.querySelector('[data-toggle]');
    var restart = root.querySelector('[data-restart]');
    var close = root.querySelector('[data-close]');
    var form = root.querySelector('[data-form]');
    var input = root.querySelector('[data-input]');
    var messages = root.querySelector('[data-messages]');
    var sessionFeedbackPrompt = null;
    var conversationHasActivity = false;

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
      hideWelcome();
      panel.classList.add('panel--open');
      toggle.setAttribute('aria-expanded', 'true');
      setTimeout(function () { input.focus(); }, 280);
    }

    function closePanel() {
      panel.classList.remove('panel--open');
      toggle.setAttribute('aria-expanded', 'false');
    }

    function showWelcome() {
      if (panel.classList.contains('panel--open')) return;
      welcome.classList.add('welcome--visible');
      welcome.setAttribute('aria-hidden', 'false');
    }

    function hideWelcome() {
      if (root.activeElement && welcome.contains(root.activeElement)) {
        toggle.focus();
      }
      welcome.classList.remove('welcome--visible');
      welcome.setAttribute('aria-hidden', 'true');
    }

    if (config.autoOpen) {
      var delay = typeof config.autoOpenDelay === 'number' ? config.autoOpenDelay : 3;
      setTimeout(showWelcome, delay * 1000);
    }

    welcomeAction.addEventListener('click', openPanel);

    welcomeClose.addEventListener('click', function () {
      hideWelcome();
      toggle.focus();
    });

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

    restart.addEventListener('click', function () {
      if (conversationHasActivity || hasConversationActivity(messages)) {
        showSessionFeedback();
        return;
      }
      restartConversation();
    });

    function restartConversation() {
      sessionId = createSessionId();
      localStorage.setItem(sessionKey, sessionId);
      conversationHasActivity = false;
      sessionFeedbackPrompt = null;
      resetMessages(messages, initialMessage);
      input.value = '';
      resizeComposer();
      input.focus();
    }

    function showSessionFeedback() {
      if (sessionFeedbackPrompt && messages.contains(sessionFeedbackPrompt)) {
        var firstChoice = sessionFeedbackPrompt.querySelector('[data-session-feedback-choice]');
        if (firstChoice) firstChoice.focus();
        messages.scrollTop = messages.scrollHeight;
        return;
      }

      sessionFeedbackPrompt = createSessionFeedbackPrompt(sessionId);
      messages.appendChild(sessionFeedbackPrompt);
      messages.scrollTop = messages.scrollHeight;
      var firstChoice = sessionFeedbackPrompt.querySelector('[data-session-feedback-choice]');
      if (firstChoice) firstChoice.focus();
    }

    function removeSessionFeedbackPrompt() {
      if (sessionFeedbackPrompt && messages.contains(sessionFeedbackPrompt)) {
        sessionFeedbackPrompt.remove();
      }
      sessionFeedbackPrompt = null;
    }

    function createSessionFeedbackPrompt(feedbackSessionId) {
      var prompt = document.createElement('div');
      var resolved = null;
      prompt.className = 'message assistant session-feedback';
      prompt.setAttribute('data-session-feedback', 'true');
      prompt.innerHTML = '\
        <strong class="session-feedback-title">Antes de empezar de nuevo, ¿he resuelto tu consulta?</strong>\
        <div class="session-feedback-choices">\
          <button class="session-feedback-choice" data-session-feedback-choice data-value="yes" type="button">' + getThumbsUpIcon() + '<span>Sí</span></button>\
          <button class="session-feedback-choice" data-session-feedback-choice data-value="no" type="button">' + getThumbsDownIcon() + '<span>No</span></button>\
        </div>\
        <textarea data-session-feedback-comments maxlength="1000" placeholder="Añade comentarios adicionales..."></textarea>\
        <div class="session-feedback-actions">\
          <button class="session-feedback-button session-feedback-submit" data-session-feedback-submit type="button" disabled>Enviar y reiniciar</button>\
          <button class="session-feedback-button" data-session-feedback-skip type="button">Saltar</button>\
        </div>';

      var choices = prompt.querySelectorAll('[data-session-feedback-choice]');
      var comments = prompt.querySelector('[data-session-feedback-comments]');
      var submit = prompt.querySelector('[data-session-feedback-submit]');
      var skip = prompt.querySelector('[data-session-feedback-skip]');

      choices.forEach(function (choice) {
        choice.addEventListener('click', function () {
          resolved = choice.getAttribute('data-value') === 'yes';
          choices.forEach(function (item) {
            item.classList.toggle('session-feedback-choice--active', item === choice);
          });
          submit.disabled = false;
        });
      });

      submit.addEventListener('click', function () {
        if (resolved === null) return;
        submitSessionFeedback({
          feedbackSessionId: feedbackSessionId,
          resolved: resolved,
          skipped: false,
          comments: comments.value,
          submit: submit,
          skip: skip,
        });
      });

      skip.addEventListener('click', function () {
        submitSessionFeedback({
          feedbackSessionId: feedbackSessionId,
          resolved: null,
          skipped: true,
          comments: comments.value,
          submit: submit,
          skip: skip,
        });
      });

      return prompt;
    }

    function submitSessionFeedback(input) {
      input.submit.disabled = true;
      input.skip.disabled = true;

      fetch(baseUrl + '/api/chat/' + tenantId + '/session-feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: input.feedbackSessionId,
          resolved: input.skipped ? undefined : input.resolved,
          skipped: input.skipped,
          comments: input.comments,
          page_url: getCurrentPageUrl(),
        }),
      })
        .catch(function () {})
        .then(function () {
          restartConversation();
        });
    }

    root.addEventListener('keydown', function (event) {
      if (event.key === 'Escape') {
        if (welcome.classList.contains('welcome--visible')) {
          hideWelcome();
          toggle.focus();
          return;
        }
        closePanel();
        toggle.focus();
      }
    });

    form.addEventListener('submit', function (event) {
      event.preventDefault();
      var text = input.value.trim();
      if (!text) return;
      input.value = '';
      resizeComposer();
      removeSessionFeedbackPrompt();
      appendMessage(messages, text, 'user');
      conversationHasActivity = true;
      sendMessage(text, messages);
    });

    input.addEventListener('input', resizeComposer);
    input.addEventListener('keydown', function (event) {
      if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        if (typeof form.requestSubmit === 'function') form.requestSubmit();
      }
    });

    function resizeComposer() {
      input.style.height = 'auto';
      var nextHeight = Math.min(input.scrollHeight, 120);
      input.style.height = Math.max(nextHeight, 44) + 'px';
      input.style.overflowY = input.scrollHeight > 120 ? 'auto' : 'hidden';
    }
  }

  function sendMessage(text, messages) {
    var requestSessionId = sessionId;
    appendMessage(messages, '...', 'assistant', true);
    fetch(baseUrl + '/api/chat/' + tenantId, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        session_id: requestSessionId,
        message: text,
        page_url: getCurrentPageUrl(),
      }),
    })
      .then(function (response) { return response.json(); })
      .then(function (data) {
        if (requestSessionId !== sessionId) return;
        removeTyping(messages);
        appendMessage(
          messages,
          data.reply || getChatErrorMessage(data.error) || 'No he podido responder ahora mismo.',
          'assistant',
          false,
          data.actions,
          data.assistant_message_id || data.assistantMessageId,
          requestSessionId
        );
      })
      .catch(function () {
        if (requestSessionId !== sessionId) return;
        removeTyping(messages);
        appendMessage(messages, 'No he podido conectar con TALIA ahora mismo.', 'assistant');
      });
  }

  function appendMessage(container, text, role, typing, actions, messageId, feedbackSessionId) {
    var item = document.createElement('div');
    item.className = 'message ' + role;
    if (typing) item.setAttribute('data-typing', 'true');
    if (typing) {
      item.setAttribute('aria-label', 'TALIA está escribiendo');
      item.innerHTML = '<span class="typing-dots" aria-hidden="true"><span></span><span></span><span></span></span>';
    } else {
      appendMessageContent(item, text, actions);
    }
    container.appendChild(item);
    if (role === 'assistant' && !typing && messageId) {
      container.appendChild(createFeedbackControls(messageId, feedbackSessionId || sessionId));
    }
    container.scrollTop = container.scrollHeight;
  }

  function resetMessages(container, initialMessage) {
    while (container.firstChild) container.removeChild(container.firstChild);
    appendMessage(container, initialMessage, 'assistant');
  }

  function createFeedbackControls(messageId, feedbackSessionId) {
    var wrapper = document.createElement('div');
    wrapper.className = 'feedback';
    wrapper.setAttribute('aria-label', 'Valorar respuesta');

    var positive = createFeedbackButton(messageId, feedbackSessionId, 'positive', 'Respuesta útil', getThumbsUpIcon());
    var negative = createFeedbackButton(messageId, feedbackSessionId, 'negative', 'Respuesta no útil', getThumbsDownIcon());
    wrapper.appendChild(positive);
    wrapper.appendChild(negative);
    return wrapper;
  }

  function createFeedbackButton(messageId, feedbackSessionId, rating, label, icon) {
    var button = document.createElement('button');
    button.type = 'button';
    button.className = 'feedback-button';
    button.setAttribute('aria-label', label);
    button.setAttribute('title', label);
    button.setAttribute('data-rating', rating);
    button.innerHTML = icon;
    button.addEventListener('click', function () {
      submitFeedback(messageId, feedbackSessionId, rating, button);
    });
    return button;
  }

  function submitFeedback(messageId, feedbackSessionId, rating, button) {
    var wrapper = button.parentElement;
    if (!wrapper) return;

    wrapper.querySelectorAll('.feedback-button').forEach(function (item) {
      item.classList.toggle('feedback-button--active', item === button);
      item.disabled = true;
    });

    fetch(baseUrl + '/api/chat/' + tenantId + '/feedback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        session_id: feedbackSessionId,
        message_id: messageId,
        rating: rating,
        page_url: getCurrentPageUrl(),
      }),
    })
      .then(function (response) {
        if (!response.ok) throw new Error('feedback_failed');
        wrapper.setAttribute('data-feedback-submitted', rating);
      })
      .catch(function () {
        wrapper.querySelectorAll('.feedback-button').forEach(function (item) {
          item.disabled = false;
          item.classList.remove('feedback-button--active');
        });
      });
  }

  function appendMessageContent(container, text, actions) {
    var value = String(text || '').replace(/\r\n/g, '\n');
    var safeActions = normalizeMessageActions(actions);
    var paragraphLines = [];
    var listType = null;
    var listItems = [];

    function flushParagraph() {
      if (!paragraphLines.length) return;
      var paragraph = document.createElement('p');
      paragraphLines.forEach(function (line, index) {
        if (index > 0) paragraph.appendChild(document.createElement('br'));
        appendInlineMessageContent(paragraph, line, safeActions);
      });
      container.appendChild(paragraph);
      paragraphLines = [];
    }

    function flushList() {
      if (!listType || !listItems.length) return;
      var list = document.createElement(listType);
      listItems.forEach(function (item) {
        var listItem = document.createElement('li');
        appendInlineMessageContent(listItem, item, safeActions);
        list.appendChild(listItem);
      });
      container.appendChild(list);
      listType = null;
      listItems = [];
    }

    value.split('\n').forEach(function (line) {
      var orderedMatch = line.match(/^\s*\d+[\.)]\s+(.+)$/);
      var unorderedMatch = line.match(/^\s*[-*•]\s+(.+)$/);

      if (!line.trim()) {
        flushParagraph();
        flushList();
        return;
      }

      if (orderedMatch || unorderedMatch) {
        var nextListType = orderedMatch ? 'ol' : 'ul';
        flushParagraph();
        if (listType && listType !== nextListType) flushList();
        listType = nextListType;
        listItems.push(orderedMatch ? orderedMatch[1] : unorderedMatch[1]);
        return;
      }

      flushList();
      paragraphLines.push(line);
    });

    flushParagraph();
    flushList();
  }

  function appendInlineMessageContent(container, text, actions) {
    var value = String(text || '');
    var urlPattern = /https?:\/\/[^\s]+/g;
    var cursor = 0;
    while (cursor < value.length) {
      urlPattern.lastIndex = cursor;
      var urlMatch = urlPattern.exec(value);
      var actionMatch = findNextActionMatch(value, cursor, actions);
      var useAction = actionMatch && (!urlMatch || actionMatch.index <= urlMatch.index);
      var match = useAction ? actionMatch : urlMatch;
      if (!match) break;

      if (match.index > cursor) appendFormattedText(container, value.slice(cursor, match.index));
      var link = document.createElement('a');
      link.href = useAction ? match.action.href : match[0];
      link.textContent = useAction ? match.action.label : match[0];
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      container.appendChild(link);
      cursor = match.index + (useAction ? match.action.label.length : match[0].length);
    }

    if (cursor < value.length) appendFormattedText(container, value.slice(cursor));
  }

  function appendFormattedText(container, text) {
    var value = String(text || '');
    var cursor = 0;
    while (cursor < value.length) {
      var token = findNextMarkdownToken(value, cursor);
      if (!token) break;
      if (token.start > cursor) container.appendChild(document.createTextNode(value.slice(cursor, token.start)));

      var element = document.createElement(token.tagName);
      appendFormattedText(element, value.slice(token.contentStart, token.contentEnd));
      container.appendChild(element);
      cursor = token.end;
    }

    if (cursor < value.length) container.appendChild(document.createTextNode(value.slice(cursor)));
  }

  function findNextMarkdownToken(value, cursor) {
    for (var index = cursor; index < value.length; index += 1) {
      if (value.slice(index, index + 2) === '**') {
        var boldEnd = value.indexOf('**', index + 2);
        if (boldEnd > index + 2) {
          return {
            start: index,
            contentStart: index + 2,
            contentEnd: boldEnd,
            end: boldEnd + 2,
            tagName: 'strong',
          };
        }
      }

      if (value.slice(index, index + 2) === '__') {
        var strongEnd = value.indexOf('__', index + 2);
        if (strongEnd > index + 2) {
          return {
            start: index,
            contentStart: index + 2,
            contentEnd: strongEnd,
            end: strongEnd + 2,
            tagName: 'strong',
          };
        }
      }

      if (value[index] === '*' && value[index - 1] !== '*' && value[index + 1] !== '*') {
        var italicEnd = findClosingItalicMarker(value, index + 1);
        if (italicEnd > index + 1) {
          return {
            start: index,
            contentStart: index + 1,
            contentEnd: italicEnd,
            end: italicEnd + 1,
            tagName: 'em',
          };
        }
      }
    }

    return null;
  }

  function findClosingItalicMarker(value, cursor) {
    for (var index = cursor; index < value.length; index += 1) {
      if (value[index] === '*' && value[index - 1] !== '*' && value[index + 1] !== '*') return index;
    }
    return -1;
  }

  function hasConversationActivity(container) {
    return Array.prototype.some.call(container.children, function (child) {
      if (!child.classList || child.hasAttribute('data-session-feedback')) return false;
      return child.classList.contains('user') || (child.classList.contains('assistant') && child.hasAttribute('data-rendered-reply'));
    });
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
    if (!installedWebCapture.enabled) return;
    if (getCaptureParams().get('talia_capture') === '1') return;
    var pageUrl = getCurrentPageUrl();
    var key = 'talia-installed-page-' + tenantId + '-' + pageUrl;
    var lastSeen = Number(localStorage.getItem(key) || '0');
    if (Date.now() - lastSeen < 10 * 60 * 1000) return;

    var payload = {
      url: pageUrl,
      title: getSafeDocumentTitle(),
      heading: getSafePageHeading(),
      http_status: getNavigationResponseStatus()
    };

    if (installedWebCapture.mode === 'automatic') {
      waitForCapturableText().then(function (pageText) {
        if (pageText && pageText.length >= 40) payload.text = pageText;
        sendInstalledPage(payload, key);
      });
      return;
    }

    sendInstalledPage(payload, key);
  }

  function sendInstalledPage(payload, key) {
    fetch(baseUrl + '/api/widget/' + tenantId + '/installed-page', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
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

  function getSafePageHeading() {
    var heading = document.querySelector('h1');
    var text = heading ? (heading.textContent || '').trim() : '';
    return text.length > 300 ? text.slice(0, 300) : text;
  }

  function getNavigationResponseStatus() {
    if (!window.performance || !window.performance.getEntriesByType) return undefined;
    var entries = window.performance.getEntriesByType('navigation');
    var status = entries.length ? Number(entries[0].responseStatus) : 0;
    return status >= 100 && status <= 599 ? status : undefined;
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
            heading: getSafePageHeading(),
            http_status: getNavigationResponseStatus(),
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

  function getInstalledWebCapturePolicy(value) {
    if (!value || typeof value !== 'object') return { enabled: false, mode: 'manual' };
    return {
      enabled: value.enabled === true,
      mode: value.mode === 'automatic' ? 'automatic' : 'manual'
    };
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
    removeTrackingParameters(url);
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
      removeTrackingParameters(url);
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
      removeTrackingParameters(url);
      return url.toString();
    } catch {
      return null;
    }
  }

  function removeTrackingParameters(url) {
    var trackingParameters = {
      '_ga': true,
      '_gl': true,
      'dclid': true,
      'fbclid': true,
      'gclid': true,
      'igshid': true,
      'mc_cid': true,
      'mc_eid': true,
      'msclkid': true,
      'ttclid': true,
      'twclid': true,
      'yclid': true
    };
    Array.from(url.searchParams.keys()).forEach(function (key) {
      var normalizedKey = key.toLowerCase();
      if (normalizedKey.indexOf('utm_') === 0 || trackingParameters[normalizedKey]) {
        url.searchParams.delete(key);
      }
    });
    url.searchParams.sort();
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

  function getTemplate(assistantName, initialMessage, proactiveMessage, primaryColor, position, widgetSize, widgetTheme, launcherIcon, glassBackground, glassBlur, glassTranslucency, iconUrl) {
    var togglePosition = getTogglePositionCss(position);
    var panelPosition = getPanelPositionCss(position);
    var toggleSize = getWidgetSizePixels(widgetSize);
    var welcomePosition = getWelcomePositionCss(position, toggleSize);
    var welcomeOrigin = position.indexOf('top') >= 0 ? 'top center' : 'bottom center';
    var welcomeStartTransform = position.indexOf('top') >= 0 ? 'translateY(-8px) scale(.96)' : 'translateY(8px) scale(.96)';
    var toggleIconSize = Math.round(toggleSize * 0.82);
    var chatIconSize = Math.round(toggleSize * 0.5);
    var launcherIconMarkup = getLauncherIconMarkup(launcherIcon, iconUrl);
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
    var welcomeBackground = glass ? skin.panelFill : '#fff';
    var welcomeColor = glass ? skin.botText : '#1A1A2E';
    var welcomeFilter = glass ? glassFilter : '';
    var welcomeBorder = glass ? '1px solid ' + skin.hairline : '1px solid rgba(26,26,46,.12)';
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
        + ' .form, .powered { background: ' + (glassBackground === 'dark' ? '#1b1622' : '#fff') + '; backdrop-filter: none; -webkit-backdrop-filter: none; }'
        + ' .welcome { background: ' + (glassBackground === 'dark' ? '#1b1622' : '#fff') + '; backdrop-filter: none; -webkit-backdrop-filter: none; }'
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
        .toggle .launcher-icon { position: relative; z-index: 1; display: block; object-fit: contain; }\
        .toggle .launcher-icon--talia { width: ' + toggleIconSize + 'px; height: ' + toggleIconSize + 'px; filter: brightness(0) invert(1) drop-shadow(0 1px 2px rgba(0,0,0,.2)); }\
        .toggle .launcher-icon--chat, .toggle .launcher-icon--bubble, .toggle .launcher-icon--bot { width: ' + chatIconSize + 'px; height: ' + chatIconSize + 'px; fill: none; stroke: currentColor; filter: drop-shadow(0 1px 2px rgba(0,0,0,.2)); }\
        ' + toggleSheen + '\
        .welcome { position: fixed; ' + welcomePosition + ' z-index: 2147483647; width: min(320px, calc(100vw - 32px)); min-height: 112px; overflow: hidden; border: ' + welcomeBorder + '; border-radius: 12px; background: ' + welcomeBackground + '; ' + welcomeFilter + ' color: ' + welcomeColor + '; box-shadow: 0 14px 38px rgba(0,0,0,.2); opacity: 0; visibility: hidden; pointer-events: none; transform: ' + welcomeStartTransform + '; transform-origin: ' + welcomeOrigin + '; transition: opacity 180ms ease, transform 240ms cubic-bezier(0.16,1,0.3,1), visibility 0s linear 240ms; }\
        .welcome--visible { opacity: 1; visibility: visible; pointer-events: auto; transform: translateY(0) scale(1); transition-delay: 0s; }\
        .welcome-action { display: grid; width: 100%; min-width: 0; gap: 12px; border: 0; padding: 16px 46px 17px 16px; background: transparent; color: inherit; cursor: pointer; text-align: left; }\
        .welcome-brand { display: flex; align-items: center; gap: 11px; min-width: 0; }\
        .welcome-mark { flex: 0 0 38px; display: grid; width: 38px; height: 38px; place-items: center; overflow: hidden; border-radius: 50%; background: ' + primaryColor + '; color: #fff; box-shadow: inset 0 1px 0 rgba(255,255,255,.28); }\
        .welcome-mark .launcher-icon { display: block; object-fit: contain; }\
        .welcome-mark .launcher-icon--talia { width: 82%; height: 82%; filter: brightness(0) invert(1) drop-shadow(0 1px 1px rgba(0,0,0,.16)); }\
        .welcome-mark .launcher-icon--chat, .welcome-mark .launcher-icon--bubble, .welcome-mark .launcher-icon--bot { width: 52%; height: 52%; fill: none; stroke: currentColor; }\
        .welcome-name { min-width: 0; overflow: hidden; color: inherit; font: 700 16px/1.2 "Space Grotesk", system-ui; text-overflow: ellipsis; white-space: nowrap; }\
        .welcome-message { color: inherit; font: 500 16px/1.42 "Space Grotesk", system-ui; }\
        .welcome-action:focus-visible, .welcome-close:focus-visible { outline: 2px solid ' + primaryColor + '; outline-offset: 2px; }\
        .welcome-close { position: absolute; top: 14px; right: 13px; width: 32px; height: 32px; border: 0; border-radius: 50%; padding: 0; background: transparent; color: inherit; cursor: pointer; font: 22px/1 system-ui; opacity: .58; }\
        .welcome-close:hover { opacity: 1; background: rgba(127,127,127,.12); }\
        .panel { position: fixed; ' + panelPosition + ' z-index: 2147483647; width: min(400px, calc(100vw - 32px)); height: min(580px, calc(100vh - 112px)); max-height: calc(100vh - 112px); background: ' + panelBackground + '; ' + glassFilter + ' color: #1A1A2E; ' + panelBorder + ' border-radius: 14px; overflow: hidden; display: grid; grid-template-rows: auto 1fr auto auto; opacity: 0; transform: translateY(14px) scale(0.97); transform-origin: ' + transformOrigin + '; pointer-events: none; transition: opacity 280ms cubic-bezier(0.16,1,0.3,1), transform 280ms cubic-bezier(0.16,1,0.3,1), box-shadow 280ms cubic-bezier(0.16,1,0.3,1); box-shadow: ' + panelShadow + panelInset + '; }\
        .panel--open { opacity: 1 !important; transform: translateY(0) scale(1) !important; pointer-events: auto !important; box-shadow: ' + panelOpenShadow + panelInset + ' !important; }\
        ' + specularBand + '\
        .header { position: relative; display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 15px 18px; background: ' + headerBackground + '; ' + headerFilter + ' color: white; font: 600 17px "Space Grotesk", system-ui; }\
        .header-brand { display: flex; min-width: 0; align-items: center; gap: 10px; }\
        .header-mark { flex: 0 0 34px; display: grid; width: 34px; height: 34px; place-items: center; overflow: hidden; border-radius: 999px; background: rgba(255,255,255,.92); color: ' + primaryColor + '; box-shadow: inset 0 1px 0 rgba(255,255,255,.62), 0 1px 2px rgba(0,0,0,.08); }\
        .header-mark .launcher-icon { display: block; object-fit: contain; }\
        .header-mark .launcher-icon--talia { width: 78%; height: 78%; }\
        .header-mark .launcher-icon--chat, .header-mark .launcher-icon--bubble, .header-mark .launcher-icon--bot { width: 54%; height: 54%; fill: none; stroke: currentColor; }\
        .header-name { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }\
        .header-actions { display: flex; align-items: center; gap: 8px; flex: 0 0 auto; }\
        .header-button { display: grid; width: 34px; height: 34px; place-items: center; border: 0; border-radius: 999px; padding: 0; background: transparent; color: white; cursor: pointer; line-height: 1; }\
        .header-button:hover { background: rgba(255,255,255,.14); }\
        .header-button:focus-visible, .feedback-button:focus-visible, .session-feedback-choice:focus-visible, .session-feedback-button:focus-visible, .session-feedback textarea:focus-visible, .powered a:focus-visible { outline: 2px solid ' + primaryColor + '; outline-offset: 2px; }\
        .header-button svg { display: block; width: 21px; height: 21px; fill: none; stroke: currentColor; }\
        .close { font-size: 22px; }\
        .messages { position: relative; padding: 16px; overflow: auto; display: flex; flex-direction: column; gap: 11px; background: ' + messagesBackground + '; }\
        .message { max-width: 84%; border-radius: 13px; padding: 11px 13px; font: 15px/1.45 "Space Grotesk", system-ui; overflow-wrap: anywhere; white-space: pre-wrap; }\
        .message p { margin: 0; }\
        .message p + p, .message p + ol, .message p + ul, .message ol + p, .message ul + p { margin-top: 10px; }\
        .message ol, .message ul { margin: 0; padding-left: 1.35em; white-space: normal; }\
        .message li + li { margin-top: 6px; }\
        .message strong { font-weight: 700; }\
        .message em { font-style: italic; }\
        .message a { color: inherit; text-decoration: underline; overflow-wrap: anywhere; }\
        .typing-dots { display: inline-flex; align-items: center; gap: 4px; min-width: 34px; height: 18px; }\
        .typing-dots span { display: block; width: 7px; height: 7px; border-radius: 999px; background: currentColor; opacity: .38; transform: translateY(0); animation: taliaTypingBounce 1s ease-in-out infinite; }\
        .typing-dots span:nth-child(2) { animation-delay: 140ms; }\
        .typing-dots span:nth-child(3) { animation-delay: 280ms; }\
        @keyframes taliaTypingBounce { 0%, 70%, 100% { opacity: .38; transform: translateY(0); } 35% { opacity: .95; transform: translateY(-4px); } }\
        .assistant { align-self: flex-start; border-top-left-radius: 4px; background: ' + botBubbleBackground + '; color: ' + botBubbleColor + '; box-shadow: 0 1px 2px rgba(0,0,0,.06); }\
        .user { align-self: flex-end; border-bottom-right-radius: 4px; background: ' + primaryColor + '; color: white; }\
        .feedback { align-self: flex-start; display: flex; gap: 8px; margin: -5px 0 1px 4px; }\
        .feedback-button { display: grid; width: 34px; height: 34px; place-items: center; border: .5px solid rgba(26,26,46,.18); border-radius: 8px; padding: 0; background: rgba(255,255,255,.72); color: rgba(26,26,46,.62); cursor: pointer; transition: border-color 150ms ease, color 150ms ease, background 150ms ease; }\
        .feedback-button:hover { border-color: rgba(26,26,46,.34); color: rgba(26,26,46,.9); background: #fff; }\
        .feedback-button:disabled { cursor: default; }\
        .feedback-button svg { display: block; width: 18px; height: 18px; fill: none; stroke: currentColor; }\
        .feedback-button--active[data-rating="positive"] { border-color: rgba(40,167,69,.42); color: #1f9d3a; background: rgba(40,167,69,.08); }\
        .feedback-button--active[data-rating="negative"] { border-color: rgba(220,53,69,.42); color: #dc3545; background: rgba(220,53,69,.08); }\
        .session-feedback { display: grid; gap: 12px; width: min(340px, 84%); max-width: 84%; box-sizing: border-box; }\
        .session-feedback-title { color: inherit; font: inherit; font-weight: 700; letter-spacing: 0; white-space: normal; }\
        .session-feedback-choices { display: grid; grid-template-columns: 1fr 1fr; gap: 9px; }\
        .session-feedback-choice { display: inline-flex; min-width: 0; height: 42px; align-items: center; justify-content: center; gap: 7px; border: 1px solid rgba(17,24,39,.14); border-radius: 8px; background: #fff; color: #374151; font: 700 14px/1 "Space Grotesk", system-ui; cursor: pointer; }\
        .session-feedback-choice svg { width: 18px; height: 18px; fill: none; stroke: currentColor; }\
        .session-feedback-choice[data-value="yes"] { color: #2dae1f; }\
        .session-feedback-choice[data-value="no"] { color: #e02424; }\
        .session-feedback-choice--active[data-value="yes"] { border-color: rgba(45,174,31,.45); background: rgba(45,174,31,.08); }\
        .session-feedback-choice--active[data-value="no"] { border-color: rgba(224,36,36,.45); background: rgba(224,36,36,.08); }\
        .session-feedback textarea { display: block; width: 100%; min-height: 78px; resize: vertical; box-sizing: border-box; border: 1px solid rgba(17,24,39,.14); border-radius: 8px; padding: 11px; color: #111827; background: #fff; font: 14px/1.42 "Space Grotesk", system-ui; }\
        .session-feedback-actions { display: grid; gap: 8px; }\
        .session-feedback-button { min-height: 42px; border: 1px solid rgba(17,24,39,.14); border-radius: 8px; background: #fff; color: #6b7280; font: 700 14px/1.2 "Space Grotesk", system-ui; cursor: pointer; }\
        .session-feedback-submit { border-color: transparent; background: #111827; color: #fff; }\
        .session-feedback-submit:disabled { background: #8b8b8b; cursor: default; }\
        .form { display: flex; align-items: flex-end; gap: 9px; padding: 13px; background: ' + formBackground + '; ' + formFilter + ' ' + formBorder + ' }\
        .input { min-width: 0; min-height: 44px; max-height: 120px; flex: 1; resize: none; overflow-y: hidden; border: .5px solid rgba(26,26,46,.25); border-radius: 7px; padding: 11px; color: #1A1A2E; caret-color: ' + primaryColor + '; font: 15px/1.4 "Space Grotesk", system-ui; background: ' + inputBackground + '; box-sizing: border-box; }\
        .input:focus { outline: none; border-color: ' + primaryColor + '; box-shadow: 0 0 0 2px color-mix(in srgb, ' + primaryColor + ' 22%, transparent); }\
        .input::placeholder { color: rgba(26,26,46,.48); }\
        .send { flex: 0 0 auto; height: 44px; border: 0; border-radius: 7px; padding: 0 14px; background: ' + primaryColor + '; color: white; font: 600 14px "Space Grotesk", system-ui; cursor: pointer; }\
        .powered { padding: 0 13px 10px; background: ' + formBackground + '; ' + formFilter + ' color: rgba(26,26,46,.52); text-align: center; font: 600 11px/1.25 "Space Grotesk", system-ui; }\
        .powered a { color: inherit; text-decoration: none; }\
        .powered a:hover { color: ' + primaryColor + '; text-decoration: underline; }\
        @media (prefers-reduced-motion: reduce) { .panel, .welcome { transition: opacity 120ms ease; } .toggle { transition: none; } .typing-dots span { animation: none; opacity: .62; } }\
        ' + reducedTransparencyFallback + '\
      </style>\
      <aside class="welcome" data-welcome aria-hidden="true" aria-label="Saludo del asistente">\
        <button class="welcome-action" data-welcome-action type="button">\
          <span class="welcome-brand"><span class="welcome-mark">' + launcherIconMarkup + '</span><strong class="welcome-name">' + escapeHtml(assistantName) + '</strong></span>\
          <span class="welcome-message">' + escapeHtml(proactiveMessage) + '</span>\
        </button>\
        <button class="welcome-close" data-welcome-close type="button" aria-label="Cerrar">×</button>\
      </aside>\
      <section class="panel" data-panel>\
        <div class="header"><span class="header-brand"><span class="header-mark">' + launcherIconMarkup + '</span><span class="header-name">' + escapeHtml(assistantName) + '</span></span><div class="header-actions"><button class="header-button" data-restart type="button" aria-label="Volver a comenzar" title="Volver a comenzar">' + getRestartIcon() + '</button><button class="header-button close" data-close type="button" aria-label="Cerrar">×</button></div></div>\
        <div class="messages" data-messages><div class="message assistant">' + escapeHtml(initialMessage) + '</div></div>\
        <form class="form" data-form><textarea class="input" data-input rows="1" placeholder="Escribe tu mensaje..." autocomplete="off"></textarea><button class="send" type="submit">Enviar</button></form>\
        <div class="powered"><a href="https://talia.events" target="_blank" rel="noopener noreferrer">Powered by TALIA</a></div>\
      </section>\
      <button class="toggle" data-toggle aria-label="Abrir asistente virtual">\
        ' + launcherIconMarkup + '\
      </button>';
  }

  function getLauncherIconMarkup(launcherIcon, iconUrl) {
    if (launcherIcon === 'bubble') {
      return '<svg class="launcher-icon launcher-icon--bubble" viewBox="0 0 24 24" aria-hidden="true" focusable="false" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z"></path><path d="M8 12h.01"></path><path d="M12 12h.01"></path><path d="M16 12h.01"></path></svg>';
    }

    if (launcherIcon === 'bot') {
      return '<svg class="launcher-icon launcher-icon--bot" viewBox="0 0 24 24" aria-hidden="true" focusable="false" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect width="16" height="12" x="4" y="8" rx="2"></rect><path d="M9 4h6"></path><path d="M12 4v4"></path><path d="M8 12h.01"></path><path d="M16 12h.01"></path><path d="M9 16h6"></path></svg>';
    }

    if (launcherIcon === 'chat') {
      return '<svg class="launcher-icon launcher-icon--chat" viewBox="0 0 24 24" aria-hidden="true" focusable="false" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z"></path></svg>';
    }

    return '<img class="launcher-icon launcher-icon--talia" src="' + escapeHtml(iconUrl) + '" alt="" aria-hidden="true" />';
  }

  function getRestartIcon() {
    return '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 3-6.7"></path><path d="M3 4v6h6"></path></svg>';
  }

  function getThumbsUpIcon() {
    return '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 10v11"></path><path d="M15 5.9 14 10h5.8a2 2 0 0 1 2 2.4l-1.4 6.5a2 2 0 0 1-2 1.6H7"></path><path d="M7 10l3.2-6.4A2 2 0 0 1 12 2.5a2 2 0 0 1 2 2v1.4"></path><path d="M3 10h4v11H3z"></path></svg>';
  }

  function getThumbsDownIcon() {
    return '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 14V3"></path><path d="M15 18.1 14 14h5.8a2 2 0 0 0 2-2.4L20.4 5a2 2 0 0 0-2-1.6H7"></path><path d="M7 14l3.2 6.4a2 2 0 0 0 1.8 1.1 2 2 0 0 0 2-2v-1.4"></path><path d="M3 3h4v11H3z"></path></svg>';
  }

  function createSessionId() {
    return crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + '-' + Math.random().toString(16).slice(2);
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

  function getProactiveMessage(value, assistantName) {
    if (typeof value === 'string' && value.trim()) return value.trim().slice(0, 160);
    return 'Soy ' + assistantName + '. ¿Te ayudo?';
  }

  function getLauncherIcon(value) {
    return value === 'chat' || value === 'bubble' || value === 'bot' ? value : 'talia';
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

  function getWelcomePositionCss(position, toggleSize) {
    var blockPosition = 'calc(var(--talia-floating-toggle-offset, 20px) + ' + (toggleSize + 12) + 'px)';
    if (position === 'bottom-left') return 'left: var(--talia-floating-inline-offset, 20px); bottom: ' + blockPosition + ';';
    if (position === 'top-right') return 'right: var(--talia-floating-inline-offset, 20px); top: ' + blockPosition + ';';
    if (position === 'top-left') return 'left: var(--talia-floating-inline-offset, 20px); top: ' + blockPosition + ';';
    return 'right: var(--talia-floating-inline-offset, 20px); bottom: ' + blockPosition + ';';
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
