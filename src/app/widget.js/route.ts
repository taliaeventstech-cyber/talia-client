const widgetScript = String.raw`
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
    var assistantName = script.getAttribute('data-name') || config.assistantName || 'TALIA';
    var primaryColor = script.getAttribute('data-color') || config.primaryColor || '#000000';
    var host = document.createElement('div');
    host.id = 'talia-widget-root';
    document.body.appendChild(host);

    var root = host.attachShadow({ mode: 'open' });
    root.innerHTML = getTemplate(assistantName, primaryColor);

    var panel = root.querySelector('[data-panel]');
    var toggle = root.querySelector('[data-toggle]');
    var close = root.querySelector('[data-close]');
    var form = root.querySelector('[data-form]');
    var input = root.querySelector('[data-input]');
    var messages = root.querySelector('[data-messages]');

    toggle.addEventListener('click', function () {
      panel.hidden = !panel.hidden;
      if (!panel.hidden) input.focus();
    });
    close.addEventListener('click', function () {
      panel.hidden = true;
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
      body: JSON.stringify({ session_id: sessionId, message: text })
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

  function getTemplate(assistantName, primaryColor) {
    return '\
      <style>\
        :host { all: initial; font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }\
        .toggle { position: fixed; right: 20px; bottom: 20px; z-index: 2147483647; width: 56px; height: 56px; border: 0; border-radius: 999px; background: ' + primaryColor + '; color: white; font: 700 18px system-ui; cursor: pointer; box-shadow: 0 10px 30px rgba(0,0,0,.25); }\
        .panel { position: fixed; right: 20px; bottom: 88px; z-index: 2147483647; width: min(360px, calc(100vw - 40px)); height: 520px; max-height: calc(100vh - 120px); background: white; color: #111; border: 1px solid #ddd; border-radius: 12px; box-shadow: 0 18px 60px rgba(0,0,0,.25); overflow: hidden; display: grid; grid-template-rows: auto 1fr auto; }\
        .header { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 14px 16px; background: ' + primaryColor + '; color: white; font: 700 15px system-ui; }\
        .close { border: 0; background: transparent; color: white; font-size: 22px; cursor: pointer; line-height: 1; }\
        .messages { padding: 14px; overflow: auto; display: flex; flex-direction: column; gap: 10px; background: #fafafa; }\
        .message { max-width: 82%; border-radius: 12px; padding: 10px 12px; font: 14px/1.4 system-ui; white-space: pre-wrap; }\
        .assistant { align-self: flex-start; background: #eee; color: #111; }\
        .user { align-self: flex-end; background: ' + primaryColor + '; color: white; }\
        .form { display: flex; gap: 8px; padding: 12px; border-top: 1px solid #eee; }\
        .input { min-width: 0; flex: 1; border: 1px solid #ddd; border-radius: 8px; padding: 10px; font: 14px system-ui; }\
        .send { border: 0; border-radius: 8px; padding: 0 12px; background: ' + primaryColor + '; color: white; font: 700 14px system-ui; cursor: pointer; }\
      </style>\
      <section class="panel" data-panel hidden>\
        <div class="header"><span>' + escapeHtml(assistantName) + '</span><button class="close" data-close aria-label="Cerrar">×</button></div>\
        <div class="messages" data-messages><div class="message assistant">Hola, soy ' + escapeHtml(assistantName) + '. ¿En qué puedo ayudarte?</div></div>\
        <form class="form" data-form><input class="input" data-input placeholder="Escribe tu mensaje..." autocomplete="off" /><button class="send" type="submit">Enviar</button></form>\
      </section>\
      <button class="toggle" data-toggle aria-label="Abrir chat">?</button>';
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, function (char) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char];
    });
  }
})();
`

export function GET() {
  return new Response(widgetScript, {
    headers: {
      'Content-Type': 'application/javascript; charset=utf-8',
      'Cache-Control': 'public, max-age=300',
    },
  })
}
