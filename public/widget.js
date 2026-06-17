(function () {
  var script = document.currentScript;
  if (!script) return;

  var tenantId = script.getAttribute('data-tenant');
  if (!tenantId) {
    console.warn('[TALIA] Missing data-tenant attribute');
    return;
  }

  var baseUrl = new URL(script.src).origin;
  var sessionKey = 'talia-session-' + tenantId;
  var sessionId = localStorage.getItem(sessionKey);
  if (!sessionId) {
    sessionId = crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + '-' + Math.random().toString(16).slice(2);
    localStorage.setItem(sessionKey, sessionId);
  }

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
      body: JSON.stringify({ session_id: sessionId, message: text }),
    })
      .then(function (response) { return response.json(); })
      .then(function (data) {
        removeTyping(messages);
        appendMessage(messages, data.reply || data.error || 'No he podido responder ahora mismo.', 'assistant');
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

  function getTemplate(assistantName, initialMessage, primaryColor, position) {
    var togglePosition = getTogglePositionCss(position);
    var panelPosition = getPanelPositionCss(position);
    var transformOrigin = position.indexOf('left') >= 0
      ? (position.indexOf('top') >= 0 ? 'top left' : 'bottom left')
      : (position.indexOf('top') >= 0 ? 'top right' : 'bottom right');

    return '\
      <style>\
        :host { all: initial; font-family: "Space Grotesk", ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }\
        .toggle { position: fixed; ' + togglePosition + ' z-index: 2147483647; width: 56px; height: 56px; border: 0; border-radius: 999px; background: ' + primaryColor + '; color: white; cursor: pointer; display: grid; place-items: center; box-shadow: 0 4px 16px rgba(0,0,0,.18); transition: transform 150ms ease, box-shadow 150ms ease; }\
        .toggle:hover { transform: scale(1.08); box-shadow: 0 6px 20px rgba(0,0,0,.22); }\
        .toggle:active { transform: scale(0.94); }\
        .toggle svg { width: 28px; height: 28px; display: block; }\
        .panel { position: fixed; ' + panelPosition + ' z-index: 2147483647; width: min(360px, calc(100vw - 40px)); height: 520px; max-height: calc(100vh - 120px); background: white; color: #1A1A2E; border: .5px solid rgba(26,26,46,.12); border-radius: 12px; overflow: hidden; display: grid; grid-template-rows: auto 1fr auto; opacity: 0; transform: translateY(14px) scale(0.97); transform-origin: ' + transformOrigin + '; pointer-events: none; transition: opacity 280ms cubic-bezier(0.16,1,0.3,1), transform 280ms cubic-bezier(0.16,1,0.3,1), box-shadow 280ms cubic-bezier(0.16,1,0.3,1); box-shadow: 0 0 0 rgba(0,0,0,0); }\
        .panel--open { opacity: 1 !important; transform: translateY(0) scale(1) !important; pointer-events: auto !important; box-shadow: 0 12px 40px rgba(0,0,0,.16) !important; }\
        .header { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 14px 16px; background: ' + primaryColor + '; color: white; font: 500 16px "Space Grotesk", system-ui; }\
        .close { border: 0; background: transparent; color: white; font-size: 22px; cursor: pointer; line-height: 1; }\
        .messages { padding: 14px; overflow: auto; display: flex; flex-direction: column; gap: 10px; background: #F5F2EC; }\
        .message { max-width: 82%; border-radius: 12px; padding: 10px 12px; font: 14px/1.4 "Space Grotesk", system-ui; white-space: pre-wrap; }\
        .assistant { align-self: flex-start; background: #fff; color: #1A1A2E; }\
        .user { align-self: flex-end; background: ' + primaryColor + '; color: white; }\
        .form { display: flex; gap: 8px; padding: 12px; border-top: .5px solid rgba(26,26,46,.12); }\
        .input { min-width: 0; flex: 1; border: .5px solid rgba(26,26,46,.25); border-radius: 6px; padding: 10px; font: 14px "Space Grotesk", system-ui; }\
        .send { border: 0; border-radius: 6px; padding: 0 12px; background: ' + primaryColor + '; color: white; font: 500 13px "Space Grotesk", system-ui; cursor: pointer; }\
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
    var widgetSize = 56;
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
