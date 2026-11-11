(function () {
  var script = document.currentScript;
  if (!script) return;

  var tenantId = script.getAttribute('data-tenant');
  if (!tenantId) {
    console.warn('[TALIA] Missing data-tenant attribute');
    return;
  }

  window.__taliaWidgetTenants = window.__taliaWidgetTenants || {};
  if (window.__taliaWidgetTenants[tenantId]) return;
  window.__taliaWidgetTenants[tenantId] = 'loading';

  var baseUrl = (script.getAttribute('data-api-base') || new URL(script.src).origin).replace(/\/$/, '');
  var pageUrlOverride = script.getAttribute('data-page-url') || '';
  var siteOriginOverride = script.getAttribute('data-site-origin') || '';
  // Opt-in diagnostics for voice testing: logs what the browser heard.
  var voiceDebug = script.hasAttribute('data-voice-debug') || /[?&]talia_voice_debug=1(&|$)/.test(window.location.search);
  var sessionKey = 'talia-session-' + tenantId;
  var installedWebCapture = { enabled: false, mode: 'manual' };
  var sessionId = getStoredValue(sessionKey);
  if (!sessionId) {
    sessionId = createSessionId();
    setStoredValue(sessionKey, sessionId);
  }

  installNavigationObserver();

  fetch(baseUrl + '/api/widget/' + tenantId)
    .then(function (response) { return response.json(); })
    .then(function (config) {
      if (config.error) throw new Error(config.error);
      registerWidgetInstallation();
      if (config.enabled === false) {
        window.__taliaWidgetTenants[tenantId] = 'disabled';
        return;
      }
      installedWebCapture = getInstalledWebCapturePolicy(config.installedWebCapture);
      mountWidgetWhenReady(config);
    })
    .catch(function (error) {
      delete window.__taliaWidgetTenants[tenantId];
      console.warn('[TALIA] Could not load widget config', error);
    });

  function registerWidgetInstallation() {
    var origin = window.location.origin;
    var key = 'talia-installation-' + tenantId + '-' + origin;
    var lastSeen = Number(getStoredValue(key) || '0');
    if (Date.now() - lastSeen < 30 * 60 * 1000) return;

    fetch(baseUrl + '/api/widget/' + tenantId + '/installation', {
      method: 'POST',
      keepalive: true,
    })
      .then(function (response) {
        if (response.ok) setStoredValue(key, String(Date.now()));
      })
      .catch(function () {});
  }

  function mountWidgetWhenReady(config) {
    function mount() {
      if (document.getElementById('talia-widget-root')) {
        window.__taliaWidgetTenants[tenantId] = 'mounted';
        return;
      }
      mountWidget(config);
      window.__taliaWidgetTenants[tenantId] = 'mounted';
      schedulePageContextSync(0);
    }

    if (document.body) {
      mount();
      return;
    }

    document.addEventListener('DOMContentLoaded', mount, { once: true });
  }

  function mountWidget(config) {
    var fallbackLanguage = getWidgetLanguage(config.fallbackLanguage, 'es');
    var widgetCopy = getWidgetChromeCopy(fallbackLanguage);
    var assistantName = config.assistantName || script.getAttribute('data-name') || 'TALIA';
    var initialMessage = config.initialMessage || script.getAttribute('data-initial-message') || widgetCopy.initialMessage;
    var proactiveMessage = getProactiveMessage(config.proactiveMessage || script.getAttribute('data-proactive-message'), assistantName, fallbackLanguage);
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
    var compliance = getComplianceConfig(config.compliance, fallbackLanguage);
    var suggestedQuestions = getVisibleSuggestedQuestions(config.suggestedQuestions, getCurrentPageUrl());
    var voiceSupport = getVoiceSupport(config.voice, script.getAttribute('data-voice'));
    var voiceCopy = getVoiceCopy(fallbackLanguage);
    var host = document.createElement('div');
    host.id = 'talia-widget-root';
    host.classList.add('notranslate');
    host.setAttribute('translate', 'no');
    // Named landmark: screen readers list it among the page regions
    // (EN 301 549 / WCAG 1.3.1, 2.4.1).
    host.setAttribute('role', 'region');
    host.setAttribute('aria-label', widgetCopy.landmark.replace('{name}', assistantName));
    document.body.appendChild(host);
    registerFloatingWidget(host, 'chatbot', position, {
      widgetSize: widgetSize,
      inlineOffset: inlineOffset,
      blockOffset: blockOffset,
      collisionStrategy: collisionStrategy
    });

    var root = host.attachShadow({ mode: 'open' });
    root.innerHTML = getTemplate(assistantName, initialMessage, proactiveMessage, primaryColor, position, widgetSize, widgetTheme, launcherIcon, glassBackground, glassBlur, glassTranslucency, baseUrl + '/icon.svg', compliance, widgetCopy, voiceSupport, voiceCopy);

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
    isolateWidgetScroll(host, root);
    var privacyLink = root.querySelector('[data-privacy]');
    var sessionFeedbackPrompt = null;
    // Per venue. Closing the voice greeting hides it for the rest of this
    // visit only; it is offered again on the next visit.
    var voiceInviteKey = 'talia-voice-invite-' + tenantId;
    var conversationHasActivity = false;
    var privacyReplyPending = false;
    var voice = createVoiceController({
      support: voiceSupport,
      copy: voiceCopy,
      language: fallbackLanguage,
      micButton: root.querySelector('[data-voice-mic]'),
      speakerButton: root.querySelector('[data-voice-speaker]'),
      wakeButton: root.querySelector('[data-voice-wake]'),
      launcher: toggle,
      launcherLabel: widgetCopy.openAssistant,
      assistantName: assistantName,
      status: root.querySelector('[data-voice-status]'),
      input: input,
      isPanelOpen: function () { return panel.classList.contains('panel--open'); },
      onVisualState: function (state) {
        toggle.setAttribute('data-voice-state', state);
        panel.setAttribute('data-voice-state', state);
        updateVoiceDock(state);
      },
      onWakeChange: function (enabled) {
        if (enabled) revealHandsFree();
      },
      onLevel: function (level) {
        var live = typeof level === 'number';
        toggle.classList.toggle('voice-live', live);
        panel.classList.toggle('voice-live', live);
        if (live) {
          toggle.style.setProperty('--lvl', level.toFixed(2));
          panel.style.setProperty('--lvl', level.toFixed(2));
        }
      },
      openPanel: function () {
        if (!panel.classList.contains('panel--open')) openPanel();
      },
      onTranscript: function (text) {
        submitText(text, true);
      },
      onInterim: function (text) {
        input.value = text;
        resizeComposer();
      },
    });

    window.addEventListener('talia:page-context-changed', refreshSuggestedQuestions);
    showSuggestedQuestions();
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
      voice.announceShortcutOnce();
      panel.classList.add('panel--open');
      toggle.setAttribute('aria-expanded', 'true');
      setTimeout(function () { input.focus(); }, 280);
    }

    function closePanel() {
      voice.stopAll();
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

    // Venue-enabled voice offer inside the greeting ("Escribir" / "Hablar").
    var welcomeVoice = root.querySelector('[data-welcome-voice]');
    var offerVoice = !!welcomeVoice && config.voiceInvitation === true && getSessionValue(voiceInviteKey) !== 'dismissed';
    if (offerVoice) {
      welcomeVoice.hidden = false;
      welcome.classList.add('welcome--voice');
      welcome.querySelector('[data-welcome-type]').addEventListener('click', openPanel);
      welcome.querySelector('[data-welcome-talk]').addEventListener('click', function () {
        setStoredValue(voiceInviteKey, 'used');
        // The click is the visitor's explicit choice to talk (and lets the
        // browser ask for the microphone).
        if (!panel.classList.contains('panel--open')) openPanel();
        voice.toggleListening();
      });
    }

    if (config.autoOpen || offerVoice) {
      var delay = typeof config.autoOpenDelay === 'number' ? config.autoOpenDelay : 3;
      setTimeout(showWelcome, delay * 1000);
    }

    welcomeAction.addEventListener('click', openPanel);

    welcomeClose.addEventListener('click', function () {
      // Closing a greeting that offered voice means "don't offer it again".
      if (offerVoice) setSessionValue(voiceInviteKey, 'dismissed');
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

    privacyLink.addEventListener('click', function (event) {
      event.preventDefault();
      if (privacyReplyPending) return;

      openPanel();
      removeSessionFeedbackPrompt();
      removeSuggestedQuestions(messages);
      appendMessage(messages, compliance.privacyQuestion, 'user');
      appendMessage(messages, '...', 'assistant', true, undefined, undefined, undefined, fallbackLanguage);
      conversationHasActivity = true;
      privacyReplyPending = true;
      var privacySessionId = sessionId;

      setTimeout(function () {
        if (privacySessionId !== sessionId) return;
        removeTyping(messages);
        appendMessage(
          messages,
          compliance.privacySummary + '\n\n' + compliance.privacyMore + ' ' + compliance.privacyUrl,
          'assistant',
          false,
          undefined,
          undefined,
          sessionId,
          fallbackLanguage
        );
        privacyReplyPending = false;
        input.focus();
      }, prefersReducedMotion ? 0 : 420);
    });

    restart.addEventListener('click', function () {
      if (conversationHasActivity || hasConversationActivity(messages)) {
        showSessionFeedback();
        return;
      }
      restartConversation();
    });

    function restartConversation() {
      voice.stopAll();
      sessionId = createSessionId();
      setStoredValue(sessionKey, sessionId);
      conversationHasActivity = false;
      privacyReplyPending = false;
      sessionFeedbackPrompt = null;
      suggestedQuestions = getVisibleSuggestedQuestions(config.suggestedQuestions, getCurrentPageUrl());
      resetMessages(messages, initialMessage);
      showSuggestedQuestions();
      input.value = '';
      resizeComposer();
      input.focus();
    }

    // Voice panel in the chat pad: status, what to do next, one clear action.
    function updateVoiceDock(state) {
      var dock = root.querySelector('[data-voice-dock]');
      if (!dock) return;
      var active = state === 'listening' || state === 'thinking' || state === 'speaking';
      var hadFocus = root.activeElement && (root.activeElement === input || dock.contains(root.activeElement));
      dock.setAttribute('aria-hidden', active ? 'false' : 'true');
      if (active) {
        revealHandsFree();
        dock.querySelector('[data-voice-dock-title]').textContent = state === 'listening' ? voiceCopy.dockListeningTitle
          : state === 'thinking' ? voiceCopy.dockThinkingTitle : voiceCopy.dockSpeakingTitle;
        dock.querySelector('[data-voice-dock-hint]').textContent = state === 'listening' ? voiceCopy.dockListeningHint
          : state === 'thinking' ? voiceCopy.dockThinkingHint : voiceCopy.dockSpeakingHint;
        dock.querySelector('[data-voice-dock-action]').textContent = state === 'listening' ? voiceCopy.dockDone
          : state === 'thinking' ? voiceCopy.dockCancel : voiceCopy.dockStop;
        // Keep keyboard focus on something visible.
        if (hadFocus) dock.querySelector('[data-voice-dock-action]').focus();
      } else if (hadFocus && root.activeElement !== input) {
        input.focus();
      }
    }

    function revealHandsFree() {
      var handsFree = root.querySelector('[data-voice-handsfree]');
      if (!handsFree || !handsFree.hidden) return;
      handsFree.hidden = false;
      panel.classList.add('panel--handsfree');
    }

    function showSessionFeedback() {
      if (sessionFeedbackPrompt && messages.contains(sessionFeedbackPrompt)) {
        var firstChoice = sessionFeedbackPrompt.querySelector('[data-session-feedback-choice]');
        if (firstChoice) firstChoice.focus();
        messages.scrollTop = messages.scrollHeight;
        return;
      }

      sessionFeedbackPrompt = createSessionFeedbackPrompt(sessionId, fallbackLanguage);
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

    function createSessionFeedbackPrompt(feedbackSessionId, language) {
      var prompt = document.createElement('div');
      var resolved = null;
      var copy = getSessionFeedbackCopy(language);
      prompt.className = 'message notranslate assistant session-feedback';
      prompt.setAttribute('translate', 'no');
      prompt.setAttribute('data-session-feedback', 'true');
      prompt.setAttribute('aria-label', copy.groupLabel);
      prompt.innerHTML = '\
        <div class="session-feedback-heading">\
          <strong class="session-feedback-title">' + escapeHtml(copy.title) + '</strong>\
          <span class="session-feedback-description">' + escapeHtml(copy.description) + '</span>\
        </div>\
        <div class="session-feedback-choices">\
          <button class="session-feedback-choice" data-session-feedback-choice data-value="yes" type="button"><span>' + escapeHtml(copy.positive) + '</span></button>\
          <button class="session-feedback-choice" data-session-feedback-choice data-value="no" type="button"><span>' + escapeHtml(copy.negative) + '</span></button>\
        </div>\
        <textarea data-session-feedback-comments maxlength="1000" placeholder="' + escapeHtml(copy.commentsPlaceholder) + '"></textarea>\
        <div class="session-feedback-actions">\
          <button class="session-feedback-button session-feedback-submit" data-session-feedback-submit type="button" disabled>' + escapeHtml(copy.submit) + '</button>\
          <button class="session-feedback-button session-feedback-skip" data-session-feedback-skip type="button">' + escapeHtml(copy.skip) + '</button>\
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
        if (voice.isActive()) {
          voice.stopAll(true);
          return;
        }
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
      submitText(input.value, false);
    });

    function submitText(value, fromVoice) {
      var text = String(value || '').trim();
      if (!text) return;
      input.value = '';
      resizeComposer();
      if (!fromVoice) voice.stopAll();
      removeSessionFeedbackPrompt();
      removeSuggestedQuestions(messages);
      appendMessage(messages, text, 'user');
      conversationHasActivity = true;
      voice.notifyProcessing(fromVoice);
      sendMessage(text, messages, undefined, fallbackLanguage, function (reply, replyLanguage, failed) {
        voice.handleReply(reply, replyLanguage, fromVoice, failed);
      });
    }

    // First stop of the keyboard / screen-reader tab order on the page, like a
    // "skip to content" link: tells blind visitors the agent exists and how to
    // reach it (EN 301 549 / WCAG 2.4.1, 2.1.1). Hidden until focused.
    mountAccessLink(
      voiceSupport.recognition
        ? widgetCopy.accessLinkVoice.replace('{name}', assistantName).replace('{keys}', voiceCopy.shortcutKeys)
        : widgetCopy.accessLinkOpen.replace('{name}', assistantName),
      primaryColor,
      function () {
        if (!panel.classList.contains('panel--open')) openPanel();
        // Activating the link is the visitor's explicit choice, like the shortcut.
        if (voiceSupport.recognition) voice.toggleListening();
      }
    );

    if (voiceSupport.enabled) {
      // Global, screen-reader friendly shortcut: opens the agent and starts
      // listening (or stops listening / interrupts speech when already active).
      document.addEventListener('keydown', function (event) {
        if (!isVoiceShortcut(event)) return;
        event.preventDefault();
        event.stopPropagation();
        if (!panel.classList.contains('panel--open')) openPanel();
        voice.toggleListening();
      }, true);

      var micButton = root.querySelector('[data-voice-mic]');
      if (micButton) {
        micButton.addEventListener('click', function () {
          voice.toggleListening();
        });
      }
      var speakerButton = root.querySelector('[data-voice-speaker]');
      if (speakerButton) {
        speakerButton.addEventListener('click', function () {
          voice.toggleReadAloud();
        });
      }
      var wakeButton = root.querySelector('[data-voice-wake]');
      if (wakeButton) {
        wakeButton.addEventListener('click', function () {
          voice.toggleWake();
        });
      }

      var dockAction = root.querySelector('[data-voice-dock-action]');
      if (dockAction) {
        dockAction.addEventListener('click', function () {
          if (panel.getAttribute('data-voice-state') === 'listening') voice.toggleListening();
          else voice.stopAll(true);
        });
      }
      if (voice.isWakeEnabled()) revealHandsFree();
    }

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

    function showSuggestedQuestions() {
      removeSuggestedQuestions(messages);
      if (!suggestedQuestions.length) return;
      var group = createSuggestedQuestions(
        suggestedQuestions,
        getSuggestedQuestionsLabel(fallbackLanguage),
        getSuggestedQuestionsPrompt(fallbackLanguage),
        function (question) {
          voice.stopAll();
          removeSessionFeedbackPrompt();
          removeSuggestedQuestions(messages);
          appendMessage(messages, question.text, 'user');
          conversationHasActivity = true;
          sendMessage(question.text, messages, {
            id: question.id,
            position: question.position,
            language: fallbackLanguage,
          }, fallbackLanguage);
          input.focus();
        }
      );
      messages.appendChild(group);
    }

    function refreshSuggestedQuestions() {
      suggestedQuestions = getVisibleSuggestedQuestions(config.suggestedQuestions, getCurrentPageUrl());
      if (!conversationHasActivity && !sessionFeedbackPrompt) showSuggestedQuestions();
    }
  }

  function sendMessage(text, messages, suggestedQuestion, fallbackLanguage, onReply) {
    var requestSessionId = sessionId;
    appendMessage(messages, '...', 'assistant', true, undefined, undefined, undefined, fallbackLanguage);
    fetch(baseUrl + '/api/chat/' + tenantId, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        session_id: requestSessionId,
        message: text,
        page_url: getCurrentPageUrl(),
        time_zone: getCurrentTimeZone(),
        suggested_question: suggestedQuestion || undefined,
      }),
    })
      .then(function (response) { return response.json(); })
      .then(function (data) {
        if (requestSessionId !== sessionId) return;
        removeTyping(messages);
        var replyText = data.reply || getChatErrorMessage(data.error, fallbackLanguage);
        appendMessage(
          messages,
          replyText,
          'assistant',
          false,
          data.actions,
          data.assistant_message_id || data.assistantMessageId,
          requestSessionId,
          fallbackLanguage,
          getAgentResponseLanguage(data, fallbackLanguage)
        );
        if (onReply) onReply(replyText, getAgentResponseLanguage(data, fallbackLanguage), !data.reply);
      })
      .catch(function () {
        if (requestSessionId !== sessionId) return;
        removeTyping(messages);
        var unavailable = getChatUnavailableMessage(fallbackLanguage);
        appendMessage(messages, unavailable, 'assistant');
        if (onReply) onReply(unavailable, fallbackLanguage, true);
      });
  }

  function appendMessage(container, text, role, typing, actions, messageId, feedbackSessionId, feedbackLanguage, contentLanguage) {
    var item = document.createElement('div');
    item.className = 'message notranslate ' + role;
    item.setAttribute('translate', 'no');
    if (role === 'assistant' && !typing) {
      item.setAttribute('data-ai-generated', 'true');
      item.setAttribute('data-ai-provider', 'talia');
    }
    if (typing) item.setAttribute('data-typing', 'true');
    if (typing) {
      item.setAttribute('aria-label', getTypingLabel(feedbackLanguage));
      item.innerHTML = '<span class="typing-dots" aria-hidden="true"><span></span><span></span><span></span></span>';
    } else {
      appendMessageContent(item, text, actions, contentLanguage || feedbackLanguage);
    }
    container.appendChild(item);
    if (role === 'assistant' && !typing && messageId) {
      container.appendChild(createFeedbackControls(messageId, feedbackSessionId || sessionId, feedbackLanguage));
    }
    container.scrollTop = container.scrollHeight;
  }

  function resetMessages(container, initialMessage) {
    while (container.firstChild) container.removeChild(container.firstChild);
    appendMessage(container, initialMessage, 'assistant');
  }

  function createSuggestedQuestions(questions, label, prompt, onSelect) {
    var group = document.createElement('div');
    group.className = 'suggested-questions';
    group.setAttribute('data-suggested-questions', 'true');
    group.setAttribute('role', 'group');
    group.setAttribute('aria-label', label);

    var title = document.createElement('p');
    title.className = 'suggested-questions-title';
    title.textContent = prompt;
    group.appendChild(title);

    var actions = document.createElement('div');
    actions.className = 'suggested-questions-actions';
    questions.forEach(function (question) {
      var button = document.createElement('button');
      button.type = 'button';
      button.className = 'suggested-question';
      button.textContent = question.text;
      button.addEventListener('click', function () { onSelect(question); });
      actions.appendChild(button);
    });
    group.appendChild(actions);

    return group;
  }

  function removeSuggestedQuestions(container) {
    var group = container.querySelector('[data-suggested-questions]');
    if (group) group.remove();
  }

  function getVisibleSuggestedQuestions(value, pageUrl) {
    if (!Array.isArray(value)) return [];
    var contextual = [];
    var general = [];
    var normalizedPageUrl = normalizeSuggestedQuestionPageUrl(pageUrl);

    value.forEach(function (question) {
      if (!question || question.enabled !== true || typeof question.id !== 'string') return;
      var text = typeof question.text === 'string' ? question.text.trim() : '';
      if (!text) return;
      var targets = Array.isArray(question.targets) ? question.targets : [];
      var target = normalizedPageUrl
        ? targets.find(function (item) {
            return matchesSuggestedQuestionTarget(item, normalizedPageUrl);
          })
        : null;

      if (targets.length && !target) return;
      var destination = target ? contextual : general;
      destination.push({
        id: question.id,
        text: text,
        source: target ? 'contextual' : 'general',
        matchedTarget: target || null,
      });
    });

    var seenText = {};
    return contextual.concat(general)
      .filter(function (question) {
        var key = question.text.trim().replace(/\s+/g, ' ').toLocaleLowerCase();
        if (seenText[key]) return false;
        seenText[key] = true;
        return true;
      })
      .slice(0, 6)
      .map(function (question, position) {
        question.position = position;
        return question;
      });
  }

  function matchesSuggestedQuestionTarget(target, pageUrl) {
    if (!target || typeof target.type !== 'string' || typeof target.value !== 'string') return false;
    if (target.type === 'hostname') return pageUrl.hostname === target.value.toLowerCase();
    if (target.type === 'path_prefix') {
      return target.value === '/'
        || pageUrl.pathname === target.value
        || pageUrl.pathname.indexOf(target.value + '/') === 0;
    }
    if (target.type === 'exact_url') return pageUrl.href === target.value;
    return false;
  }

  function normalizeSuggestedQuestionPageUrl(value) {
    if (!value) return null;
    try {
      var url = new URL(value);
      if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
      url.hash = '';
      removeTrackingParameters(url);
      url.searchParams.sort();
      url.pathname = url.pathname === '/' ? '/' : url.pathname.replace(/\/+$/, '') || '/';
      return {
        href: url.pathname === '/' && !url.search
          ? url.origin
          : url.toString().replace(/\/$/, ''),
        hostname: url.hostname.toLowerCase(),
        pathname: url.pathname,
      };
    } catch {
      return null;
    }
  }

  function getWidgetLanguage(value, fallbackLanguage) {
    if (typeof value !== 'string') return fallbackLanguage;
    var normalized = value.trim().toLowerCase().replace('_', '-');
    if (normalized === 'pt' || normalized.indexOf('pt-') === 0) return 'pt-BR';
    var language = normalized.split('-')[0];
    return language === 'es' || language === 'ca' || language === 'en'
      ? language
      : fallbackLanguage;
  }

  function getComplianceConfig(value, language) {
    var localized;
    if (language === 'ca') {
      localized = {
        aiLabel: 'Agent web',
        disclosure: 'Estàs parlant amb un assistent d’IA. Pot cometre errors.',
        privacyLabel: 'Privacitat',
        privacyQuestion: 'Com tracteu les meves dades?',
        privacySummary: 'Utilitzem els missatges que envies per respondre la teva consulta, supervisar la qualitat i protegir el servei. El contingut de la conversa es conserva durant 90 dies i es pot eliminar abans si ho sol·licites. Si parles amb l’agent, la teva veu es transcriu i les respostes es poden llegir en veu alta mitjançant proveïdors d’IA (com OpenAI) o el servei de veu del teu navegador; no desem enregistraments d’àudio. Si actives el mode «Hola TALIA», el teu navegador escolta el micròfon mentre estigui actiu per detectar aquesta frase. No venem les teves dades.',
        privacyMore: 'Pots consultar tots els detalls i com exercir els teus drets aquí:'
      };
    } else if (language === 'en') {
      localized = {
        aiLabel: 'Web agent',
        disclosure: 'You are talking to an AI assistant. It can make mistakes.',
        privacyLabel: 'Privacy',
        privacyQuestion: 'How do you use my data?',
        privacySummary: 'We use the messages you send to answer your question, monitor quality, and protect the service. Conversation content is retained for 90 days and can be deleted sooner if you request it. If you talk to the agent, your voice is transcribed and answers may be read aloud using AI providers (such as OpenAI) or your browser’s speech service; we do not keep audio recordings. If you turn on “Hi TALIA” mode, your browser listens to the microphone while it is on to detect that phrase. We do not sell your data.',
        privacyMore: 'You can read the full details and learn how to exercise your rights here:'
      };
    } else if (language === 'pt-BR') {
      localized = {
        aiLabel: 'Agente web',
        disclosure: 'Você está falando com um assistente de IA. Ele pode cometer erros.',
        privacyLabel: 'Privacidade',
        privacyQuestion: 'Como vocês tratam meus dados?',
        privacySummary: 'Usamos as mensagens que você envia para responder à sua solicitação, supervisionar a qualidade e proteger o serviço. O conteúdo da conversa é mantido por 90 dias e pode ser excluído antes se você solicitar. Se você falar com o agente, sua voz é transcrita e as respostas podem ser lidas em voz alta por provedores de IA (como a OpenAI) ou pelo serviço de voz do seu navegador; não guardamos gravações de áudio. Se você ativar o modo “Olá TALIA”, seu navegador ouve o microfone enquanto estiver ativo para detectar essa frase. Não vendemos seus dados.',
        privacyMore: 'Você pode consultar todos os detalhes e saber como exercer seus direitos aqui:'
      };
    } else {
      localized = {
        aiLabel: 'Agente web',
        disclosure: 'Estás hablando con un asistente de IA. Puede cometer errores.',
        privacyLabel: 'Privacidad',
        privacyQuestion: '¿Cómo tratáis mis datos?',
        privacySummary: 'Usamos los mensajes que envías para responder a tu consulta, supervisar la calidad y proteger el servicio. El contenido de la conversación se conserva durante 90 días y puede eliminarse antes si lo solicitas. Si hablas con el agente, tu voz se transcribe y las respuestas pueden leerse en voz alta mediante proveedores de IA (como OpenAI) o el servicio de voz de tu navegador; no guardamos grabaciones de audio. Si activas el modo «Hola TALIA», tu navegador escucha el micrófono mientras esté activo para detectar esa frase. No vendemos tus datos.',
        privacyMore: 'Puedes consultar todos los detalles y cómo ejercer tus derechos aquí:'
      };
    }
    var source = value && typeof value === 'object' ? value : {};
    var privacyUrl = 'https://talia.events/privacy';
    try {
      var candidate = new URL(source.privacyUrl || privacyUrl);
      if (candidate.protocol === 'https:') privacyUrl = candidate.toString();
    } catch {
      // Keep the TALIA policy as the safe fallback.
    }
    return {
      aiLabel: typeof source.aiLabel === 'string' ? source.aiLabel : localized.aiLabel,
      disclosure: typeof source.disclosure === 'string' ? source.disclosure : localized.disclosure,
      privacyLabel: typeof source.privacyLabel === 'string' ? source.privacyLabel : localized.privacyLabel,
      privacyQuestion: typeof source.privacyQuestion === 'string' ? source.privacyQuestion : localized.privacyQuestion,
      privacySummary: typeof source.privacySummary === 'string' ? source.privacySummary : localized.privacySummary,
      privacyMore: typeof source.privacyMore === 'string' ? source.privacyMore : localized.privacyMore,
      privacyUrl: privacyUrl
    };
  }

  function getSuggestedQuestionsLabel(language) {
    if (language === 'ca') return 'Preguntes suggerides';
    if (language === 'en') return 'Suggested questions';
    if (language === 'pt-BR') return 'Perguntas sugeridas';
    return 'Preguntas sugeridas';
  }

  function getSuggestedQuestionsPrompt(language) {
    if (language === 'ca') return 'Pregunta’m sobre...';
    if (language === 'en') return 'Ask me about...';
    if (language === 'pt-BR') return 'Pergunte sobre...';
    return 'Pregúntame sobre...';
  }

  function getTypingLabel(language) {
    if (language === 'ca') return 'TALIA està escrivint';
    if (language === 'en') return 'TALIA is typing';
    if (language === 'pt-BR') return 'TALIA está digitando';
    return 'TALIA está escribiendo';
  }

  function createFeedbackControls(messageId, feedbackSessionId, language) {
    var copy = getResponseFeedbackCopy(language);
    var wrapper = document.createElement('div');
    wrapper.className = 'feedback';
    wrapper.setAttribute('aria-label', copy.groupLabel);

    var prompt = document.createElement('span');
    prompt.className = 'feedback-prompt';
    prompt.textContent = copy.prompt;
    wrapper.appendChild(prompt);

    var actions = document.createElement('span');
    actions.className = 'feedback-actions';
    actions.appendChild(createFeedbackButton(messageId, feedbackSessionId, 'positive', copy.positiveLabel, copy.positive));
    actions.appendChild(createFeedbackButton(messageId, feedbackSessionId, 'negative', copy.negativeLabel, copy.negative));
    wrapper.appendChild(actions);
    return wrapper;
  }

  function createFeedbackButton(messageId, feedbackSessionId, rating, label, text) {
    var button = document.createElement('button');
    button.type = 'button';
    button.className = 'feedback-button';
    button.setAttribute('aria-label', label);
    button.setAttribute('title', label);
    button.setAttribute('data-rating', rating);
    button.textContent = text;
    button.addEventListener('click', function () {
      submitFeedback(messageId, feedbackSessionId, rating, button);
    });
    return button;
  }

  function getResponseFeedbackCopy(language) {
    if (language === 'ca') {
      return {
        groupLabel: 'Valorar la resposta',
        prompt: 'T’ha ajudat?',
        positive: 'Sí',
        positiveLabel: 'La resposta m’ha ajudat',
        negative: 'No',
        negativeLabel: 'La resposta no m’ha ajudat'
      };
    }
    if (language === 'en') {
      return {
        groupLabel: 'Rate this answer',
        prompt: 'Was this helpful?',
        positive: 'Yes',
        positiveLabel: 'This answer was helpful',
        negative: 'No',
        negativeLabel: 'This answer was not helpful'
      };
    }
    if (language === 'pt-BR') {
      return {
        groupLabel: 'Avaliar esta resposta',
        prompt: 'Isso ajudou?',
        positive: 'Sim',
        positiveLabel: 'Esta resposta ajudou',
        negative: 'Não',
        negativeLabel: 'Esta resposta não ajudou'
      };
    }
    return {
      groupLabel: 'Valorar la respuesta',
      prompt: '¿Te ha ayudado?',
      positive: 'Sí',
      positiveLabel: 'La respuesta me ha ayudado',
      negative: 'No',
      negativeLabel: 'La respuesta no me ha ayudado'
    };
  }

  function getSessionFeedbackCopy(language) {
    if (language === 'ca') {
      return {
        groupLabel: 'Valoració abans de reiniciar',
        title: 'Tornem a començar?',
        description: 'Abans, digues-me si he resolt la teva consulta.',
        positive: 'Sí, gràcies',
        negative: 'No del tot',
        commentsPlaceholder: 'Comentari opcional',
        submit: 'Enviar i reiniciar',
        skip: 'Reiniciar sense valorar'
      };
    }
    if (language === 'en') {
      return {
        groupLabel: 'Feedback before restarting',
        title: 'Start a new conversation?',
        description: 'Before we do, did I resolve your question?',
        positive: 'Yes, thanks',
        negative: 'Not quite',
        commentsPlaceholder: 'Optional comment',
        submit: 'Submit and restart',
        skip: 'Restart without rating'
      };
    }
    if (language === 'pt-BR') {
      return {
        groupLabel: 'Avaliação antes de reiniciar',
        title: 'Começar uma nova conversa?',
        description: 'Antes disso, diga se consegui resolver sua dúvida.',
        positive: 'Sim, obrigado',
        negative: 'Não totalmente',
        commentsPlaceholder: 'Comentário opcional',
        submit: 'Enviar e reiniciar',
        skip: 'Reiniciar sem avaliar'
      };
    }
    return {
      groupLabel: 'Valoración antes de reiniciar',
      title: '¿Empezamos de nuevo?',
      description: 'Antes, dime si he resuelto tu consulta.',
      positive: 'Sí, gracias',
      negative: 'No del todo',
      commentsPlaceholder: 'Comentario opcional',
      submit: 'Enviar y reiniciar',
      skip: 'Reiniciar sin valorar'
    };
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

  function appendMessageContent(container, text, actions, language) {
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
    appendLocationActions(container, safeActions, language);
    appendPurchaseActions(container, safeActions, language);
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
      if (!action || typeof action.label !== 'string' || typeof action.href !== 'string') return false;
      if (!action.label || action.label.length > 120) return false;
      if (action.type === 'whatsapp') {
        try {
          var whatsappUrl = new URL(action.href);
          return whatsappUrl.protocol === 'https:' && whatsappUrl.hostname === 'wa.me' && /^\/\d{8,15}$/.test(whatsappUrl.pathname);
        } catch {
          return false;
        }
      }
      if (action.type === 'location') {
        if (typeof action.address !== 'string' || typeof action.embed_href !== 'string') return false;
        var address = action.address.trim().replace(/\s+/g, ' ');
        if (address.length < 5 || address.length > 300 || /[\r\n<>]/.test(address)) return false;
        var encodedAddress = encodeURIComponent(address);
        return action.href === 'https://www.google.com/maps/search/?api=1&query=' + encodedAddress
          && action.embed_href === 'https://www.google.com/maps?q=' + encodedAddress + '&output=embed';
      }
      if (action.type === 'purchase') {
        try {
          var purchaseUrl = new URL(action.href);
          return purchaseUrl.protocol === 'https:'
            && !purchaseUrl.username
            && !purchaseUrl.password
            && action.href.length <= 2000;
        } catch {
          return false;
        }
      }
      return false;
    });
  }

  function appendLocationActions(container, actions, language) {
    var action = actions.find(function (item) { return item.type === 'location'; });
    if (!action) return;

    var copy = getLocationActionCopy(language);
    var card = document.createElement('section');
    card.className = 'location-card';
    card.setAttribute('aria-label', copy.locationLabel);

    var heading = document.createElement('div');
    heading.className = 'location-heading';
    var marker = document.createElement('span');
    marker.className = 'location-marker';
    marker.setAttribute('aria-hidden', 'true');
    marker.innerHTML = '<svg viewBox="0 0 24 24" focusable="false"><path d="M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 1 1 16 0Z"></path><circle cx="12" cy="10" r="2.5"></circle></svg>';
    var details = document.createElement('span');
    details.className = 'location-details';
    var label = document.createElement('strong');
    label.textContent = action.label;
    var address = document.createElement('span');
    address.textContent = action.address;
    details.appendChild(label);
    details.appendChild(address);
    heading.appendChild(marker);
    heading.appendChild(details);

    var mapShell = document.createElement('div');
    mapShell.className = 'location-map-shell';
    var placeholder = document.createElement('div');
    placeholder.className = 'location-map-placeholder';
    placeholder.setAttribute('aria-hidden', 'true');
    placeholder.innerHTML = '<span></span><span></span><span></span><b></b>';
    mapShell.appendChild(placeholder);

    var frame = document.createElement('iframe');
    frame.className = 'location-map-frame';
    frame.src = action.embed_href;
    frame.title = copy.mapTitle + ': ' + action.label;
    frame.loading = 'lazy';
    frame.referrerPolicy = 'no-referrer';
    frame.setAttribute('allowfullscreen', '');
    frame.addEventListener('load', function () {
      mapShell.classList.add('location-map-shell--loaded');
    });
    mapShell.appendChild(frame);

    var handleMapCspViolation = function (event) {
      var blockedUri = String(event && event.blockedURI || '');
      var directive = String(event && event.violatedDirective || '');
      if (!card.isConnected || directive.indexOf('frame') === -1 || blockedUri.indexOf('google.com') === -1) return;
      mapShell.classList.add('location-map-shell--blocked');
      if (frame.parentNode) frame.remove();
      window.removeEventListener('securitypolicyviolation', handleMapCspViolation);
    };
    window.addEventListener('securitypolicyviolation', handleMapCspViolation);
    window.setTimeout(function () {
      window.removeEventListener('securitypolicyviolation', handleMapCspViolation);
    }, 5000);

    var link = document.createElement('a');
    link.className = 'location-open-link';
    link.href = action.href;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.textContent = copy.openMaps;
    link.setAttribute('aria-label', copy.openMaps + ': ' + action.address);

    card.appendChild(heading);
    card.appendChild(mapShell);
    card.appendChild(link);
    container.appendChild(card);
  }

  function getLocationActionCopy(language) {
    var normalized = getWidgetLanguage(language, 'es');
    if (normalized === 'ca') {
      return { locationLabel: 'Ubicació', mapTitle: 'Mapa', openMaps: 'Obrir a Maps' };
    }
    if (normalized === 'en') {
      return { locationLabel: 'Location', mapTitle: 'Map', openMaps: 'Open in Maps' };
    }
    if (normalized === 'pt-BR') {
      return { locationLabel: 'Localização', mapTitle: 'Mapa', openMaps: 'Abrir no Maps' };
    }
    return { locationLabel: 'Ubicación', mapTitle: 'Mapa', openMaps: 'Abrir en Maps' };
  }

  function appendPurchaseActions(container, actions, language) {
    var action = actions.find(function (item) { return item.type === 'purchase'; });
    if (!action) return;

    var copy = getPurchaseActionCopy(language);
    var card = document.createElement('section');
    card.className = 'purchase-card';
    card.setAttribute('aria-label', copy.purchaseLabel);

    var heading = document.createElement('div');
    heading.className = 'purchase-heading';
    var marker = document.createElement('span');
    marker.className = 'purchase-marker';
    marker.setAttribute('aria-hidden', 'true');
    marker.innerHTML = '<svg viewBox="0 0 24 24" focusable="false"><path d="M4 7.5A2.5 2.5 0 0 0 6.5 10 2.5 2.5 0 0 0 4 12.5V17h16v-4.5a2.5 2.5 0 0 0 0-5V3H4Z"></path><path d="M14 6v8"></path></svg>';
    var details = document.createElement('span');
    details.className = 'purchase-details';
    var title = document.createElement('strong');
    title.textContent = action.label;
    var description = document.createElement('span');
    description.textContent = copy.officialPurchase;
    details.appendChild(title);
    details.appendChild(description);
    heading.appendChild(marker);
    heading.appendChild(details);

    var link = document.createElement('a');
    link.className = 'purchase-open-link';
    link.href = action.href;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.textContent = copy.buy + ' ' + action.label;
    link.setAttribute('aria-label', copy.buy + ' ' + action.label);

    card.appendChild(heading);
    card.appendChild(link);
    container.appendChild(card);
  }

  function getPurchaseActionCopy(language) {
    var normalized = getWidgetLanguage(language, 'es');
    if (normalized === 'ca') {
      return { purchaseLabel: 'Compra', officialPurchase: 'Enllaç oficial', buy: 'Comprar' };
    }
    if (normalized === 'en') {
      return { purchaseLabel: 'Purchase', officialPurchase: 'Official link', buy: 'Buy' };
    }
    if (normalized === 'pt-BR') {
      return { purchaseLabel: 'Compra', officialPurchase: 'Link oficial', buy: 'Comprar' };
    }
    return { purchaseLabel: 'Compra', officialPurchase: 'Enlace oficial', buy: 'Comprar' };
  }

  function getAgentResponseLanguage(data, fallbackLanguage) {
    var metadata = data && data.source && data.source.metadata;
    return metadata && typeof metadata.response_language === 'string'
      ? getWidgetLanguage(metadata.response_language, fallbackLanguage)
      : fallbackLanguage;
  }

  function findNextActionMatch(value, cursor, actions) {
    var best = null;
    actions.forEach(function (action) {
      if (action.type !== 'whatsapp') return;
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

  function getChatErrorMessage(error, language) {
    if (error === 'domain_not_allowed') {
      if (language === 'ca') return 'Aquest domini no està autoritzat per utilitzar aquest assistent de TALIA.';
      if (language === 'en') return 'This domain is not authorized to use this TALIA assistant.';
      if (language === 'pt-BR') return 'Este domínio não está autorizado a usar este agente da TALIA.';
      return 'Este dominio no está autorizado para usar este asistente de TALIA.';
    }
    return getChatUnavailableMessage(language);
  }

  function getChatUnavailableMessage(language) {
    if (language === 'ca') return 'Ara mateix no puc respondre. Si us plau, torna-ho a provar d’aquí a uns instants.';
    if (language === 'en') return 'I cannot respond right now. Please try again in a moment.';
    if (language === 'pt-BR') return 'Não consigo responder agora. Tente novamente em instantes.';
    return 'Ahora mismo no puedo responder. Por favor, vuelve a intentarlo en unos instantes.';
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
      window.dispatchEvent(new CustomEvent('talia:page-context-changed'));
    }, delay);
  }

  function registerInstalledPage() {
    if (!installedWebCapture.enabled) return;
    if (getCaptureParams().get('talia_capture') === '1') return;
    var pageUrl = getCurrentPageUrl();
    var key = 'talia-installed-page-' + tenantId + '-' + pageUrl;
    var lastSeen = Number(getStoredValue(key) || '0');
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
        if (response.ok) setStoredValue(key, String(Date.now()));
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

  function getCurrentTimeZone() {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
    } catch {
      return 'UTC';
    }
  }

  function getCanonicalPageUrl() {
    var explicitUrl = normalizePublicPageUrl(pageUrlOverride);
    if (explicitUrl) return explicitUrl;

    var canonical = document.querySelector('link[rel="canonical"]');
    var canonicalUrl = canonical ? normalizePublicPageUrl(canonical.getAttribute('href')) : null;
    if (canonicalUrl) {
      return getMappedSiteOriginUrl(siteOriginOverride, canonicalUrl) || canonicalUrl;
    }

    var ogUrl = document.querySelector('meta[property="og:url"], meta[name="og:url"]');
    var openGraphUrl = ogUrl ? normalizePublicPageUrl(ogUrl.getAttribute('content')) : null;
    if (openGraphUrl) {
      return getMappedSiteOriginUrl(siteOriginOverride, openGraphUrl) || openGraphUrl;
    }

    return getMappedSiteOriginUrl(siteOriginOverride, window.location.href);
  }

  function getMappedSiteOriginUrl(originValue, pageValue) {
    if (!originValue) return null;
    try {
      var origin = new URL(originValue);
      var current = new URL(pageValue || window.location.href, window.location.href);
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

  function getTemplate(assistantName, initialMessage, proactiveMessage, primaryColor, position, widgetSize, widgetTheme, launcherIcon, glassBackground, glassBlur, glassTranslucency, iconUrl, compliance, widgetCopy, voiceSupport, voiceCopy) {
    var togglePosition = getTogglePositionCss(position);
    var panelPosition = getPanelPositionCss(position);
    var toggleSize = getWidgetSizePixels(widgetSize);
    var welcomePosition = getWelcomePositionCss(position, toggleSize);
    var welcomeOrigin = position.indexOf('top') >= 0 ? 'top center' : 'bottom center';
    var welcomeStartTransform = position.indexOf('top') >= 0 ? 'translateY(-8px) scale(.96)' : 'translateY(8px) scale(.96)';
    var chatIconSize = Math.round(toggleSize * 0.5);
    var toggleIconSize = Math.round(toggleSize * 0.82);
    var launcherIconMarkup = getLauncherIconMarkup(launcherIcon, iconUrl);
    // TALIA's own avatar in the chat is always TALIA's face, drawn as a
    // one-colour icon, whatever launcher icon the venue picked.
    var taliaFaceMarkup = getTaliaFaceIcon(iconUrl);
    var voiceMicMarkup = voiceSupport.recognition
      ? '<button class="mic notranslate" translate="no" data-voice-mic type="button" aria-pressed="false" aria-keyshortcuts="Alt+Shift+V" aria-label="' + escapeHtml(voiceCopy.micStart) + '" title="' + escapeHtml(voiceCopy.micStart + ' (' + voiceCopy.shortcutKeys + ')') + '">' + getMicIcon() + '</button>'
      : '';
    var voiceSpeakerMarkup = voiceSupport.synthesis
      ? '<button class="header-button" data-voice-speaker type="button" aria-pressed="false" aria-label="' + escapeHtml(voiceCopy.readAloud) + '" title="' + escapeHtml(voiceCopy.readAloud) + '">' + getSpeakerIcon() + '</button>'
      : '';
    var voiceBarsMarkup = '<span class="voice-bars" aria-hidden="true"><span></span><span></span><span></span><span></span><span></span></span>';
    // Greeting choices (shown only when the venue offers voice): typing and
    // talking presented side by side, with a just-in-time privacy notice.
    var welcomeVoiceMarkup = voiceSupport.recognition
      ? '<div class="welcome-voice" data-welcome-voice hidden>'
        + '<span class="welcome-voice-hint">' + escapeHtml(voiceSupport.browserRecognition && getStoredValue('talia-voice-wake-word') === 'on' ? voiceCopy.greetingWakeHint : voiceCopy.greetingVoiceHint) + '</span>'
        + '<div class="welcome-voice-actions">'
        + '<button class="welcome-choice" data-welcome-type type="button">' + getPencilIcon() + '<span>' + escapeHtml(voiceCopy.greetingType) + '</span></button>'
        + '<button class="welcome-choice welcome-choice--primary" data-welcome-talk type="button">' + getMicIcon() + '<span>' + escapeHtml(voiceCopy.greetingTalk) + '</span></button>'
        + '</div>'
        + '<span class="welcome-voice-notice">' + escapeHtml(voiceCopy.greetingNotice) + ' <a href="' + escapeHtml(compliance.privacyUrl) + '" target="_blank" rel="noopener noreferrer">' + escapeHtml(compliance.privacyLabel) + '</a></span>'
        + '</div>'
      : '';
    // Voice panel that takes over the composer while voice is in use.
    var voiceDockMarkup = voiceSupport.recognition
      ? '<div class="voice-dock" data-voice-dock aria-hidden="true">'
        + '<span class="voice-dock-visual">' + voiceBarsMarkup + '</span>'
        + '<span class="voice-dock-text"><strong data-voice-dock-title></strong><span data-voice-dock-hint></span></span>'
        + '<button class="voice-dock-action" data-voice-dock-action type="button"></button>'
        + '</div>'
      : '';
    // "Manos libres" switch, revealed after the visitor has used voice once.
    var voiceHandsFreeMarkup = voiceSupport.browserRecognition
      ? '<div class="voice-handsfree" data-voice-handsfree hidden>'
        + '<span class="voice-handsfree-label" data-voice-handsfree-label>' + escapeHtml(voiceCopy.handsFreeLabel) + '</span>'
        + '<button class="voice-switch" data-voice-wake type="button" role="switch" aria-checked="false" aria-label="' + escapeHtml(voiceCopy.handsFreeLabel) + '" title="' + escapeHtml(voiceCopy.handsFreeTitle) + '"><span class="voice-switch-knob"></span></button>'
        + '</div>'
      : '';
    var voiceStatusMarkup = voiceSupport.enabled
      ? '<div class="sr-only" data-voice-status role="status" aria-live="assertive" aria-atomic="true"></div><p class="sr-only" id="talia-voice-hint">' + escapeHtml(voiceCopy.shortcutHint) + '</p>'
      : '';
    var toggleVoiceAttributes = voiceSupport.enabled
      ? ' aria-keyshortcuts="Alt+Shift+V" aria-describedby="talia-voice-hint"'
      : '';
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
        .toggle .launcher-icon--mark { width: ' + chatIconSize + 'px; height: ' + chatIconSize + 'px; fill: currentColor; filter: drop-shadow(0 1px 2px rgba(0,0,0,.2)); }\
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
        .header-mark { flex: 0 0 36px; display: grid; width: 36px; height: 36px; place-items: center; overflow: hidden; border-radius: 999px; background: rgba(255,255,255,.16); border: 1px solid rgba(255,255,255,.32); color: #fff; box-shadow: inset 0 1px 0 rgba(255,255,255,.24); }\
        .header-mark .launcher-icon { display: block; object-fit: contain; }\
        .header-mark .launcher-icon--talia { width: 88%; height: 88%; filter: brightness(0) invert(1); }\
        .header-mark .launcher-icon--chat, .header-mark .launcher-icon--bubble, .header-mark .launcher-icon--bot { width: 54%; height: 54%; fill: none; stroke: currentColor; }\
        .header-identity { min-width: 0; display: grid; gap: 2px; }\
        .header-name { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }\
        .header-ai-label { color: rgba(255,255,255,.76); font: 650 10px/1.1 "Space Grotesk", system-ui; letter-spacing: .04em; text-transform: uppercase; }\
        .header-actions { display: flex; align-items: center; gap: 8px; flex: 0 0 auto; }\
        .header-button { display: grid; width: 34px; height: 34px; place-items: center; border: 0; border-radius: 999px; padding: 0; background: transparent; color: white; cursor: pointer; line-height: 1; }\
        .header-button:hover { background: rgba(255,255,255,.14); }\
        .header-button:focus-visible, .feedback-button:focus-visible, .suggested-question:focus-visible, .session-feedback-choice:focus-visible, .session-feedback-button:focus-visible, .session-feedback textarea:focus-visible, .purchase-open-link:focus-visible, .powered a:focus-visible { outline: 2px solid ' + primaryColor + '; outline-offset: 2px; }\
        .header-button svg { display: block; width: 21px; height: 21px; fill: none; stroke: currentColor; }\
        .close { font-size: 22px; }\
        .ai-disclosure { padding: 9px 16px; border-bottom: .5px solid rgba(26,26,46,.12); background: ' + messagesBackground + '; color: rgba(26,26,46,.62); font: 600 11px/1.35 "Space Grotesk", system-ui; }\
        .messages { position: relative; padding: 16px; overflow: auto; overscroll-behavior: contain; display: flex; flex-direction: column; gap: 11px; background: ' + messagesBackground + '; }\
        .message { max-width: 84%; border-radius: 13px; padding: 11px 13px; font: 15px/1.45 "Space Grotesk", system-ui; overflow-wrap: anywhere; white-space: pre-wrap; }\
        .message p { margin: 0; }\
        .message p + p, .message p + ol, .message p + ul, .message ol + p, .message ul + p { margin-top: 10px; }\
        .message ol, .message ul { margin: 0; padding-left: 1.35em; white-space: normal; }\
        .message li + li { margin-top: 6px; }\
        .message strong { font-weight: 700; }\
        .message em { font-style: italic; }\
        .message a { color: inherit; text-decoration: underline; overflow-wrap: anywhere; }\
        .location-card { display: grid; gap: 10px; margin-top: 12px; overflow: hidden; border: 1px solid rgba(26,26,46,.12); border-radius: 12px; padding: 10px; background: color-mix(in srgb, ' + primaryColor + ' 5%, #fff); white-space: normal; }\
        .location-heading { display: flex; min-width: 0; align-items: flex-start; gap: 9px; }\
        .location-marker { flex: 0 0 30px; display: grid; width: 30px; height: 30px; place-items: center; border-radius: 999px; background: color-mix(in srgb, ' + primaryColor + ' 12%, #fff); color: ' + primaryColor + '; }\
        .location-marker svg { width: 18px; height: 18px; fill: none; stroke: currentColor; stroke-width: 1.9; stroke-linecap: round; stroke-linejoin: round; }\
        .location-details { min-width: 0; display: grid; gap: 2px; color: inherit; }\
        .location-details strong { overflow: hidden; font: 700 13px/1.25 "Space Grotesk", system-ui; text-overflow: ellipsis; white-space: nowrap; }\
        .location-details span { font: 500 12px/1.35 "Space Grotesk", system-ui; opacity: .7; }\
        .location-map-shell { position: relative; height: 156px; overflow: hidden; border-radius: 9px; background: color-mix(in srgb, ' + primaryColor + ' 7%, #ebe8e2); }\
        .location-map-placeholder { position: absolute; inset: 0; overflow: hidden; background: linear-gradient(29deg, transparent 46%, rgba(255,255,255,.78) 47%, rgba(255,255,255,.78) 52%, transparent 53%), linear-gradient(151deg, transparent 35%, rgba(255,255,255,.58) 36%, rgba(255,255,255,.58) 41%, transparent 42%), color-mix(in srgb, ' + primaryColor + ' 7%, #e8e4dc); }\
        .location-map-placeholder span { position: absolute; height: 2px; width: 140%; left: -20%; background: rgba(26,26,46,.1); transform: rotate(-18deg); }\
        .location-map-placeholder span:nth-child(1) { top: 28%; }\
        .location-map-placeholder span:nth-child(2) { top: 58%; transform: rotate(23deg); }\
        .location-map-placeholder span:nth-child(3) { top: 78%; transform: rotate(-4deg); }\
        .location-map-placeholder b { position: absolute; left: 50%; top: 50%; width: 18px; height: 18px; border-radius: 50% 50% 50% 0; background: ' + primaryColor + '; box-shadow: 0 4px 10px rgba(26,26,46,.24); transform: translate(-50%,-65%) rotate(-45deg); }\
        .location-map-placeholder b::after { content: ""; position: absolute; width: 6px; height: 6px; left: 6px; top: 6px; border-radius: 50%; background: #fff; }\
        .location-map-frame { position: absolute; inset: 0; width: 100%; height: 100%; border: 0; background: transparent; opacity: 0; transition: opacity 180ms ease; }\
        .location-map-shell--loaded .location-map-frame { opacity: 1; }\
        .location-map-shell--blocked { height: 104px; }\
        .location-open-link { display: flex; min-height: 36px; align-items: center; justify-content: center; border-radius: 8px; background: ' + primaryColor + '; color: #fff !important; font: 700 12px/1 "Space Grotesk", system-ui; text-decoration: none !important; }\
        .location-open-link:hover { filter: brightness(.96); }\
        .location-open-link:focus-visible { outline: 2px solid ' + primaryColor + '; outline-offset: 2px; }\
        .purchase-card { display: grid; gap: 10px; margin-top: 12px; border: 1px solid color-mix(in srgb, ' + primaryColor + ' 22%, rgba(26,26,46,.12)); border-radius: 12px; padding: 11px; background: color-mix(in srgb, ' + primaryColor + ' 6%, #fff); white-space: normal; }\
        .purchase-heading { display: flex; min-width: 0; align-items: center; gap: 9px; }\
        .purchase-marker { flex: 0 0 32px; display: grid; width: 32px; height: 32px; place-items: center; border-radius: 10px; background: color-mix(in srgb, ' + primaryColor + ' 13%, #fff); color: ' + primaryColor + '; }\
        .purchase-marker svg { width: 19px; height: 19px; fill: none; stroke: currentColor; stroke-width: 1.8; stroke-linecap: round; stroke-linejoin: round; }\
        .purchase-details { min-width: 0; display: grid; gap: 2px; color: inherit; }\
        .purchase-details strong { overflow: hidden; font: 700 13px/1.25 "Space Grotesk", system-ui; text-overflow: ellipsis; white-space: nowrap; }\
        .purchase-details span { font: 500 11px/1.3 "Space Grotesk", system-ui; opacity: .64; }\
        .purchase-open-link { display: flex; min-height: 38px; align-items: center; justify-content: center; border-radius: 9px; padding: 0 12px; background: ' + primaryColor + '; color: #fff !important; font: 700 12px/1.2 "Space Grotesk", system-ui; text-align: center; text-decoration: none !important; }\
        .purchase-open-link:hover { filter: brightness(.96); }\
        .typing-dots { display: inline-flex; align-items: center; gap: 4px; min-width: 34px; height: 18px; }\
        .typing-dots span { display: block; width: 7px; height: 7px; border-radius: 999px; background: currentColor; opacity: .38; transform: translateY(0); animation: taliaTypingBounce 1s ease-in-out infinite; }\
        .typing-dots span:nth-child(2) { animation-delay: 140ms; }\
        .typing-dots span:nth-child(3) { animation-delay: 280ms; }\
        @keyframes taliaTypingBounce { 0%, 70%, 100% { opacity: .38; transform: translateY(0); } 35% { opacity: .95; transform: translateY(-4px); } }\
        .assistant { align-self: flex-start; border-top-left-radius: 4px; background: ' + botBubbleBackground + '; color: ' + botBubbleColor + '; box-shadow: 0 1px 2px rgba(0,0,0,.06); }\
        .user { align-self: flex-end; border-bottom-right-radius: 4px; background: ' + primaryColor + '; color: white; }\
        .feedback { align-self: flex-start; display: inline-flex; min-height: 30px; align-items: center; gap: 7px; margin: -5px 0 1px 4px; border: .5px solid rgba(26,26,46,.13); border-radius: 999px; padding: 3px 4px 3px 10px; background: rgba(255,255,255,.58); color: rgba(26,26,46,.58); box-shadow: 0 1px 2px rgba(26,26,46,.04); }\
        .feedback-prompt { font: 600 11px/1.2 "Space Grotesk", system-ui; white-space: nowrap; }\
        .feedback-actions { display: inline-flex; align-items: center; gap: 2px; }\
        .feedback-button { min-width: 34px; height: 24px; border: 0; border-radius: 999px; padding: 0 9px; background: transparent; color: rgba(26,26,46,.72); font: 700 11px/1 "Space Grotesk", system-ui; cursor: pointer; transition: color 150ms ease, background 150ms ease, box-shadow 150ms ease, opacity 150ms ease; }\
        .feedback-button:hover { color: color-mix(in srgb, ' + primaryColor + ' 82%, #1A1A2E); background: color-mix(in srgb, ' + primaryColor + ' 10%, transparent); }\
        .feedback-button:disabled { cursor: default; opacity: .48; }\
        .feedback-button--active:disabled { opacity: 1; }\
        .feedback-button--active { color: white; background: ' + primaryColor + '; box-shadow: 0 2px 7px color-mix(in srgb, ' + primaryColor + ' 28%, transparent); }\
        .suggested-questions { align-self: stretch; display: grid; gap: 8px; }\
        .suggested-questions-title { margin: 2px 2px 0; color: ' + botBubbleColor + '; font: 650 12px/1.3 "Space Grotesk", system-ui; opacity: .68; }\
        .suggested-questions-actions { display: flex; flex-wrap: wrap; gap: 8px; }\
        .suggested-question { min-height: 38px; border: 1px solid color-mix(in srgb, ' + primaryColor + ' 45%, rgba(26,26,46,.16)); border-radius: 999px; padding: 8px 12px; background: rgba(255,255,255,.82); color: color-mix(in srgb, ' + primaryColor + ' 82%, #1A1A2E); font: 650 13px/1.25 "Space Grotesk", system-ui; text-align: left; cursor: pointer; }\
        .suggested-question:hover { background: color-mix(in srgb, ' + primaryColor + ' 9%, #fff); }\
        .session-feedback { display: grid; gap: 11px; width: min(320px, 84%); max-width: 84%; box-sizing: border-box; }\
        .session-feedback-heading { display: grid; gap: 3px; }\
        .session-feedback-title { color: inherit; font: 700 15px/1.32 "Space Grotesk", system-ui; letter-spacing: 0; white-space: normal; }\
        .session-feedback-description { color: inherit; font: 500 12px/1.4 "Space Grotesk", system-ui; opacity: .62; white-space: normal; }\
        .session-feedback-choices { display: flex; flex-wrap: wrap; gap: 6px; }\
        .session-feedback-choice { display: inline-flex; min-width: 0; min-height: 32px; align-items: center; justify-content: center; border: 1px solid rgba(17,24,39,.14); border-radius: 999px; padding: 0 12px; background: #fff; color: rgba(26,26,46,.72); font: 700 12px/1 "Space Grotesk", system-ui; cursor: pointer; transition: border-color 150ms ease, background 150ms ease, color 150ms ease; }\
        .session-feedback-choice:hover { border-color: color-mix(in srgb, ' + primaryColor + ' 45%, rgba(17,24,39,.14)); color: color-mix(in srgb, ' + primaryColor + ' 82%, #1A1A2E); }\
        .session-feedback-choice--active { border-color: ' + primaryColor + '; background: ' + primaryColor + '; color: #fff; }\
        .session-feedback textarea { display: block; width: 100%; min-height: 52px; resize: vertical; box-sizing: border-box; border: 1px solid rgba(17,24,39,.14); border-radius: 10px; padding: 9px 10px; color: #111827; background: #fff; font: 12px/1.42 "Space Grotesk", system-ui; }\
        .session-feedback-actions { display: flex; align-items: center; gap: 10px; }\
        .session-feedback-button { min-height: 34px; border: 0; border-radius: 999px; padding: 0 13px; background: transparent; color: rgba(26,26,46,.62); font: 650 11px/1.2 "Space Grotesk", system-ui; cursor: pointer; }\
        .session-feedback-submit { background: ' + primaryColor + '; color: #fff; }\
        .session-feedback-submit:disabled { opacity: .42; cursor: default; }\
        .session-feedback-skip { padding-inline: 2px; }\
        .form { display: flex; align-items: flex-end; gap: 9px; padding: 13px; background: ' + formBackground + '; ' + formFilter + ' ' + formBorder + ' }\
        .input { min-width: 0; min-height: 44px; max-height: 120px; flex: 1; resize: none; overflow-y: hidden; border: .5px solid rgba(26,26,46,.25); border-radius: 7px; padding: 11px; color: #1A1A2E; caret-color: ' + primaryColor + '; font: 15px/1.4 "Space Grotesk", system-ui; background: ' + inputBackground + '; box-sizing: border-box; }\
        .input:focus { outline: none; border-color: ' + primaryColor + '; box-shadow: 0 0 0 2px color-mix(in srgb, ' + primaryColor + ' 22%, transparent); }\
        .input::placeholder { color: rgba(26,26,46,.48); }\
        .mic { position: relative; flex: 0 0 auto; display: grid; width: 44px; height: 44px; place-items: center; border: .5px solid rgba(26,26,46,.25); border-radius: 7px; padding: 0; background: ' + inputBackground + '; color: ' + primaryColor + '; cursor: pointer; }\
        .mic svg { display: block; width: 21px; height: 21px; fill: none; stroke: currentColor; }\
        .mic:hover { border-color: ' + primaryColor + '; }\
        .mic:focus-visible, .send:focus-visible { outline: 2px solid ' + primaryColor + '; outline-offset: 2px; }\
        .mic--listening { border-color: ' + primaryColor + '; background: ' + primaryColor + '; color: #fff; }\
        .mic--listening::after { content: ""; position: absolute; inset: -4px; border: 2px solid ' + primaryColor + '; border-radius: 10px; animation: talia-mic-pulse 1.2s ease-out infinite; pointer-events: none; }\
        .mic--busy { opacity: .6; }\
        @keyframes talia-mic-pulse { 0% { opacity: .7; transform: scale(.92); } 100% { opacity: 0; transform: scale(1.18); } }\
        .header-button[aria-pressed="true"] { background: rgba(255,255,255,.22); }\
        .voice-bars { display: none; position: relative; z-index: 1; align-items: center; justify-content: center; gap: 4px; height: 60%; }\
        .voice-bars span { --f: 1; display: block; width: 5px; height: 6px; border-radius: 3px; background: currentColor; transition: height 90ms linear; }\
        .voice-bars span:nth-child(1) { --f: .45; } .voice-bars span:nth-child(2) { --f: .8; } .voice-bars span:nth-child(3) { --f: 1; } .voice-bars span:nth-child(4) { --f: .7; } .voice-bars span:nth-child(5) { --f: .4; }\
        .toggle .voice-bars { gap: 3px; } .toggle .voice-bars span { width: 4px; }\
        .toggle[data-voice-state]:not([data-voice-state="idle"]) .launcher-icon { display: none; }\
        [data-voice-state]:not([data-voice-state="idle"]) .voice-bars { display: flex; }\
        [data-voice-state="wake"] .voice-bars span { animation: talia-bars-idle 2.4s ease-in-out infinite; }\
        [data-voice-state="wake"] .voice-bars span:nth-child(2) { animation-delay: .2s; } [data-voice-state="wake"] .voice-bars span:nth-child(3) { animation-delay: .4s; } [data-voice-state="wake"] .voice-bars span:nth-child(4) { animation-delay: .6s; }\
        [data-voice-state="listening"] .voice-bars span, [data-voice-state="speaking"] .voice-bars span { animation: talia-bars-voice .5s ease-in-out infinite alternate; }\
        [data-voice-state="listening"] .voice-bars span:nth-child(2n), [data-voice-state="speaking"] .voice-bars span:nth-child(2n) { animation-duration: .38s; }\
        .voice-live .voice-bars span { animation: none !important; height: calc(6px + var(--lvl, 0) * var(--f) * 26px); }\
        [data-voice-state="thinking"] .voice-bars span { width: 6px; height: 6px; animation: talia-bars-think 1s ease-in-out infinite; }\
        [data-voice-state="thinking"] .voice-bars span:nth-child(2) { animation-delay: .15s; } [data-voice-state="thinking"] .voice-bars span:nth-child(3) { animation-delay: .3s; } [data-voice-state="thinking"] .voice-bars span:nth-child(4) { animation-delay: .45s; }\
        @keyframes talia-bars-idle { 0%, 100% { height: 6px; opacity: .65; } 50% { height: 14px; opacity: 1; } }\
        @keyframes talia-bars-voice { from { height: 6px; } to { height: calc(10px + var(--f) * 18px); } }\
        @keyframes talia-bars-think { 0%, 100% { transform: translateY(0); opacity: .55; } 50% { transform: translateY(-5px); opacity: 1; } }\
        .form { position: relative; }\
        .voice-dock { position: absolute; inset: 0; z-index: 3; display: none; align-items: center; gap: 14px; padding: 13px 13px 13px 16px; background: ' + (glass ? skin.chromeFill : '#fff') + '; ' + formFilter + ' animation: talia-dock-in 200ms ease-out both; }\
        .panel[data-voice-state="listening"] .voice-dock, .panel[data-voice-state="thinking"] .voice-dock, .panel[data-voice-state="speaking"] .voice-dock { display: flex; }\
        .voice-dock-visual { flex: 0 0 auto; display: grid; width: 56px; height: 44px; place-items: center; border-radius: 12px; background: color-mix(in srgb, ' + primaryColor + ' 10%, #fff); color: ' + primaryColor + '; }\
        .voice-dock-visual .voice-bars { height: 70%; gap: 3px; }\
        .voice-dock-visual .voice-bars span { width: 4px; }\
        .voice-dock-text { display: grid; flex: 1; min-width: 0; gap: 2px; color: #1A1A2E; }\
        .voice-dock-text strong { font: 700 15px/1.25 "Space Grotesk", system-ui; }\
        .voice-dock-text span { overflow: hidden; color: rgba(26,26,46,.66); font: 500 12.5px/1.35 "Space Grotesk", system-ui; text-overflow: ellipsis; }\
        .voice-dock-action { flex: 0 0 auto; height: 40px; border: 0; border-radius: 999px; padding: 0 16px; background: ' + primaryColor + '; color: #fff; font: 600 14px "Space Grotesk", system-ui; cursor: pointer; }\
        .voice-dock-action:focus-visible, .voice-switch:focus-visible, .welcome-choice:focus-visible { outline: 2px solid ' + primaryColor + '; outline-offset: 2px; }\
        @keyframes talia-dock-in { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }\
        .voice-handsfree { position: absolute; left: 0; right: 0; bottom: calc(100% + 8px); z-index: 2; display: flex; width: max-content; max-width: calc(100% - 26px); margin: 0 auto; align-items: center; gap: 10px; border-radius: 999px; padding: 5px 6px 5px 14px; background: #fff; color: #1A1A2E; box-shadow: 0 4px 16px rgba(0,0,0,.12), 0 0 0 1px rgba(26,26,46,.08); white-space: nowrap; font: 600 12.5px "Space Grotesk", system-ui; animation: talia-dock-in 220ms ease-out both; }\
        .voice-handsfree[hidden] { display: none; }\
        .panel--handsfree .messages { padding-bottom: 56px; }\
        .voice-switch { position: relative; width: 38px; height: 22px; border: 0; border-radius: 999px; padding: 0; background: rgba(26,26,46,.22); cursor: pointer; transition: background 160ms ease; }\
        .voice-switch-knob { position: absolute; top: 3px; left: 3px; width: 16px; height: 16px; border-radius: 50%; background: #fff; box-shadow: 0 1px 2px rgba(0,0,0,.25); transition: transform 160ms ease; }\
        .voice-switch[aria-checked="true"] { background: ' + primaryColor + '; }\
        .voice-switch[aria-checked="true"] .voice-switch-knob { transform: translateX(16px); }\
        .welcome-voice { display: grid; gap: 10px; padding: 0 16px 16px; }\
        .welcome-voice[hidden] { display: none; }\
        .welcome--voice .welcome-action { padding-bottom: 10px; }\
        .welcome-voice-hint { font: 500 14px/1.4 "Space Grotesk", system-ui; opacity: .78; }\
        .welcome-voice-actions { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }\
        .welcome-choice { display: inline-flex; align-items: center; justify-content: center; gap: 8px; min-height: 44px; border: 1px solid rgba(26,26,46,.2); border-radius: 12px; padding: 0 12px; background: transparent; color: inherit; font: 600 14.5px "Space Grotesk", system-ui; cursor: pointer; transition: transform 120ms ease, box-shadow 120ms ease; }\
        .welcome-choice:hover { transform: translateY(-1px); box-shadow: 0 4px 12px rgba(0,0,0,.08); }\
        .welcome-choice svg { width: 18px; height: 18px; fill: none; stroke: currentColor; }\
        .welcome-choice--primary { border-color: ' + primaryColor + '; background: ' + primaryColor + '; color: #fff; }\
        .welcome-voice-notice { font: 500 11.5px/1.4 "Space Grotesk", system-ui; opacity: .62; }\
        .welcome-voice-notice a { color: inherit; }\
        @keyframes talia-msg-in { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }\
        .message, .suggested-questions, .feedback { animation: talia-msg-in 220ms ease-out both; }\
        .voice-invite-body { display: grid; gap: 10px; padding: 16px; }\
        .voice-invite-text { margin: 0; font-size: 15px; }\
        .voice-invite-actions { display: flex; flex-wrap: wrap; gap: 8px; }\
        .voice-invite-primary, .voice-invite-secondary { min-height: 40px; border-radius: 8px; padding: 0 14px; font: 600 14px "Space Grotesk", system-ui; cursor: pointer; }\
        .voice-invite-primary { border: 0; background: ' + primaryColor + '; color: #fff; }\
        .voice-invite-secondary { border: 1px solid currentColor; background: transparent; color: inherit; }\
        .voice-invite-primary[hidden] { display: none; }\
        .voice-invite-primary:focus-visible, .voice-invite-secondary:focus-visible, .voice-invite-privacy:focus-visible { outline: 2px solid ' + primaryColor + '; outline-offset: 2px; }\
        .voice-invite-privacy { color: inherit; font-size: 12px; opacity: .75; }\
        .sr-only { position: absolute; width: 1px; height: 1px; margin: -1px; padding: 0; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; border: 0; }\
        .send { flex: 0 0 auto; height: 44px; border: 0; border-radius: 7px; padding: 0 14px; background: ' + primaryColor + '; color: white; font: 600 14px "Space Grotesk", system-ui; cursor: pointer; }\
        .powered { padding: 0 13px 10px; background: ' + formBackground + '; ' + formFilter + ' color: rgba(26,26,46,.52); text-align: center; font: 600 10px/1.35 "Space Grotesk", system-ui; }\
        .powered a { color: inherit; text-decoration: none; }\
        .powered a:hover { color: ' + primaryColor + '; text-decoration: underline; }\
        @media (prefers-reduced-motion: reduce) { .panel, .welcome { transition: opacity 120ms ease; } .toggle { transition: none; } .typing-dots span { animation: none; opacity: .62; } .mic--listening::after { animation: none; opacity: .5; } .voice-bars span { animation: none !important; transition: none; } .message, .suggested-questions, .feedback, .voice-dock, .voice-handsfree { animation: none; } .welcome-choice, .voice-switch, .voice-switch-knob { transition: none; } }\
        ' + reducedTransparencyFallback + '\
      </style>\
      <aside class="welcome notranslate" data-welcome translate="no" aria-hidden="true" aria-label="' + escapeHtml(widgetCopy.greetingLabel) + '">\
        <button class="welcome-action" data-welcome-action type="button">\
          <span class="welcome-brand"><span class="welcome-mark">' + taliaFaceMarkup + '</span><strong class="welcome-name">' + escapeHtml(assistantName) + '</strong></span>\
          <span class="welcome-message">' + escapeHtml(proactiveMessage) + '</span>\
        </button>\
        ' + welcomeVoiceMarkup + '\
        <button class="welcome-close" data-welcome-close type="button" aria-label="' + escapeHtml(widgetCopy.close) + '">×</button>\
      </aside>\
      <section class="panel notranslate" data-panel translate="no">\
        <div class="header"><span class="header-brand"><span class="header-mark">' + taliaFaceMarkup + '</span><span class="header-identity"><span class="header-name">' + escapeHtml(assistantName) + '</span><small class="header-ai-label">' + escapeHtml(compliance.aiLabel) + '</small></span></span><div class="header-actions">' + voiceSpeakerMarkup + '<button class="header-button" data-restart type="button" aria-label="' + escapeHtml(widgetCopy.restart) + '" title="' + escapeHtml(widgetCopy.restart) + '">' + getRestartIcon() + '</button><button class="header-button close" data-close type="button" aria-label="' + escapeHtml(widgetCopy.close) + '">×</button></div></div>\
        <div class="ai-disclosure" id="talia-ai-disclosure">' + escapeHtml(compliance.disclosure) + '</div>\
        <div class="messages notranslate" data-messages translate="no"><div class="message notranslate assistant" translate="no" data-ai-generated="true" data-ai-provider="talia">' + escapeHtml(initialMessage) + '</div></div>\
        <form class="form notranslate" data-form translate="no">' + voiceHandsFreeMarkup + voiceDockMarkup + '<textarea class="input notranslate" data-input translate="no" rows="1" placeholder="' + escapeHtml(widgetCopy.inputPlaceholder) + '" autocomplete="off" aria-describedby="talia-ai-disclosure talia-privacy-notice"></textarea>' + voiceMicMarkup + '<button class="send notranslate" translate="no" type="submit">' + escapeHtml(widgetCopy.send) + '</button></form>\
        <div class="powered" id="talia-privacy-notice"><a data-privacy href="' + escapeHtml(compliance.privacyUrl) + '" target="_blank" rel="noopener noreferrer">' + escapeHtml(compliance.privacyLabel) + '</a><span aria-hidden="true"> · </span><a href="https://talia.events" target="_blank" rel="noopener noreferrer">Powered by TALIA</a></div>\
        ' + voiceStatusMarkup + '\
      </section>\
      <button class="toggle" data-toggle aria-label="' + escapeHtml(widgetCopy.openAssistant) + '"' + toggleVoiceAttributes + '>\
        ' + launcherIconMarkup + '\
        ' + voiceBarsMarkup + '\
      </button>';
  }

  // ---------------------------------------------------------------------------
  // Voice mode: speech-to-text input, spoken replies and audio cues (earcons).
  // Preferred engine: TALIA's voice endpoints (OpenAI speech-to-text and
  // text-to-speech) when the public config reports `voice.provider: 'openai'`.
  // Fallback engine: the browser's own Web Speech API, used when TALIA voice is
  // unavailable, rate limited or fails. Audio cues are synthesized locally with
  // Web Audio. Designed so blind and low-vision visitors can run a full
  // conversation with Alt+Shift+V (Option+Shift+V on a Mac).
  // ---------------------------------------------------------------------------

  function getVoiceSupport(configValue, attributeValue) {
    var disabled = configValue === false
      || (configValue && typeof configValue === 'object' && configValue.enabled === false)
      || attributeValue === 'off'
      || attributeValue === 'false';
    var serverProvider = !disabled && configValue && typeof configValue === 'object' && configValue.provider === 'talia';
    var hasAudioContext = !!(window.AudioContext || window.webkitAudioContext);
    var browserRecognition = !disabled && !!getSpeechRecognitionConstructor();
    var browserSynthesis = !disabled && typeof window.speechSynthesis !== 'undefined' && typeof window.SpeechSynthesisUtterance === 'function';
    var serverRecognition = !!serverProvider
      && typeof window.MediaRecorder === 'function'
      && !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia)
      && hasAudioContext;
    var serverSynthesis = !!serverProvider && hasAudioContext;
    var recognition = serverRecognition || browserRecognition;
    var synthesis = serverSynthesis || browserSynthesis;
    return {
      enabled: recognition || synthesis,
      recognition: recognition,
      synthesis: synthesis,
      serverRecognition: serverRecognition,
      serverSynthesis: serverSynthesis,
      browserRecognition: browserRecognition,
      browserSynthesis: browserSynthesis
    };
  }

  function getSpeechRecognitionConstructor() {
    return window.SpeechRecognition || window.webkitSpeechRecognition || null;
  }

  function isVoiceShortcut(event) {
    return event.altKey && event.shiftKey && !event.ctrlKey && !event.metaKey
      && (event.code === 'KeyV' || String(event.key).toLowerCase() === 'v');
  }

  // The shortcut is the same physical keys everywhere (Alt is Option on a
  // Mac); only its spoken/visible name changes so Mac users hear their keys.
  function isApplePlatform() {
    var platform = ((navigator.userAgentData && navigator.userAgentData.platform) || '') + ' ' + (navigator.platform || '');
    return /mac|iphone|ipad|ipod/i.test(platform)
      || (/Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1);
  }

  function getVoiceShortcutLabel(language, apple) {
    if (apple) {
      if (language === 'ca') return 'Opció+Maj+V';
      if (language === 'es') return 'Opción+Mayús+V';
      return 'Option+Shift+V';
    }
    if (language === 'ca') return 'Alt+Maj+V';
    if (language === 'es') return 'Alt+Mayús+V';
    return 'Alt+Shift+V';
  }

  function getVoiceCopy(language, apple) {
    if (apple === undefined) apple = isApplePlatform();
    var keys = getVoiceShortcutLabel(language, apple);
    if (language === 'ca') {
      return {
        micStart: 'Parlar amb l’agent',
        micStop: 'Deixar d’escoltar',
        listening: 'T’escolto. Pots parlar.',
        stopped: 'He deixat d’escoltar.',
        processing: 'Missatge enviat. Preparant la resposta.',
        transcribing: 'T’he sentit. Un moment.',
        noSpeech: 'No t’he sentit. Prem ' + keys + ' per tornar-ho a provar.',
        denied: 'No tinc accés al micròfon. Revisa els permisos del navegador o escriu el teu missatge.',
        unsupported: 'Aquest navegador no permet parlar amb l’agent. Pots escriure el teu missatge.',
        failed: 'No he pogut entendre l’àudio. Torna-ho a provar o escriu el teu missatge.',
        readAloud: 'Llegir respostes en veu alta',
        readAloudOn: 'Lectura en veu alta activada.',
        readAloudOff: 'Lectura en veu alta desactivada.',
        speechStopped: 'Lectura aturada.',
        slower: 'D’acord, parlaré més a poc a poc.',
        writtenOnly: 'D’acord, et respondré només per escrit. Activa el botó de lectura en veu alta per tornar a escoltar-me.',
        nothingToRepeat: 'Encara no hi ha cap resposta per repetir.',
        link: 'enllaç',
        shortcutKeys: keys,
        shortcutHint: 'Prem ' + keys + ' en qualsevol moment per parlar amb l’agent web. Sentiràs un so quan puguis començar a parlar.',
        firstOpen: 'Consell: prem ' + keys + ' per parlar en comptes d’escriure.',
        wakeWord: 'Escoltar «Hola TALIA»',
        wakeOn: 'Mode «Hola TALIA» activat. Mentre estigui actiu, el teu navegador escolta el micròfon per detectar «Hola TALIA». Desactiva’l amb el mateix interruptor.',
        wakeOff: 'Mode «Hola TALIA» desactivat.',
        wakeLauncher: 'escoltant «Hola TALIA»',
        handsFreeEnded: 'No he sentit res més. Prem ' + keys + ' per tornar a parlar.',
        greetingWakeHint: 'Digues «Hola TALIA» o prem Parlar.',
        wakeOffer: 'Vols que la propera vegada em pugui activar dient «Hola TALIA»? Mentre aquesta web estigui oberta, el teu navegador escoltarà el micròfon per detectar aquesta frase. Digues sí o no.',
        wakeOfferAccepted: 'Fet. Quan vulguis, digues «Hola TALIA». Ho pots desactivar amb l’interruptor Mans lliures. Alguna cosa més?',
        wakeOfferDeclined: 'D’acord. Alguna cosa més?',
        greetingVoiceHint: 'Pots escriure’m o parlar-me.',
        greetingType: 'Escriure',
        greetingTalk: 'Parlar',
        greetingNotice: 'Si parles, la teva veu es transcriu per respondre’t.',
        dockListeningTitle: 'T’escolto…',
        dockListeningHint: 'Parla amb normalitat i fes una pausa en acabar.',
        dockThinkingTitle: 'Un moment…',
        dockThinkingHint: 'Estic preparant la resposta.',
        dockSpeakingTitle: 'TALIA està responent',
        dockSpeakingHint: 'Digues «para» o prem Aturar.',
        dockDone: 'Fet',
        dockCancel: 'Cancel·lar',
        dockStop: 'Aturar',
        handsFreeLabel: 'Mans lliures: digues «Hola TALIA»',
        handsFreeTitle: 'En activar-ho, el navegador escolta el micròfon només per detectar «Hola TALIA».'
      };
    }
    if (language === 'en') {
      return {
        micStart: 'Talk to the agent',
        micStop: 'Stop listening',
        listening: 'I’m listening. You can talk now.',
        stopped: 'Stopped listening.',
        processing: 'Message sent. Preparing the answer.',
        transcribing: 'Got it. One moment.',
        noSpeech: 'I didn’t hear anything. Press ' + keys + ' to try again.',
        denied: 'I can’t access the microphone. Check your browser permissions or type your message.',
        unsupported: 'This browser doesn’t support talking to the agent. You can type your message.',
        failed: 'I couldn’t understand the audio. Try again or type your message.',
        readAloud: 'Read answers aloud',
        readAloudOn: 'Reading answers aloud is on.',
        readAloudOff: 'Reading answers aloud is off.',
        speechStopped: 'Reading stopped.',
        slower: 'Okay, I’ll speak more slowly.',
        writtenOnly: 'Okay, I’ll answer in writing only. Turn on “read answers aloud” to hear me again.',
        nothingToRepeat: 'There’s no answer to repeat yet.',
        link: 'link',
        shortcutKeys: keys,
        shortcutHint: 'Press ' + keys + ' at any time to talk to the web agent. You will hear a sound when you can start talking.',
        firstOpen: 'Tip: press ' + keys + ' to talk instead of typing.',
        wakeWord: 'Listen for “Hi TALIA”',
        wakeOn: '“Hi TALIA” mode is on. While it’s on, your browser listens to the microphone to detect “Hi TALIA”. Turn it off with the same switch.',
        wakeOff: '“Hi TALIA” mode is off.',
        wakeLauncher: 'listening for “Hi TALIA”',
        handsFreeEnded: 'I didn’t hear anything else. Press ' + keys + ' to talk again.',
        greetingWakeHint: 'Say “Hi TALIA” or press Talk.',
        wakeOffer: 'Would you like to call me next time just by saying “Hi TALIA”? While this site is open, your browser will listen to the microphone to detect that phrase. Say yes or no.',
        wakeOfferAccepted: 'Done. Whenever you like, say “Hi TALIA”. You can turn it off with the Hands-free switch. Anything else?',
        wakeOfferDeclined: 'All right. Anything else?',
        greetingVoiceHint: 'You can type or talk to me.',
        greetingType: 'Type',
        greetingTalk: 'Talk',
        greetingNotice: 'If you talk, your voice is transcribed to answer you.',
        dockListeningTitle: 'Listening…',
        dockListeningHint: 'Speak normally and pause when you’re done.',
        dockThinkingTitle: 'One moment…',
        dockThinkingHint: 'I’m preparing the answer.',
        dockSpeakingTitle: 'TALIA is answering',
        dockSpeakingHint: 'Say “stop” or press Stop.',
        dockDone: 'Done',
        dockCancel: 'Cancel',
        dockStop: 'Stop',
        handsFreeLabel: 'Hands-free: say “Hi TALIA”',
        handsFreeTitle: 'When on, your browser listens to the microphone only to detect “Hi TALIA”.'
      };
    }
    if (language === 'pt-BR') {
      return {
        micStart: 'Falar com o agente',
        micStop: 'Parar de ouvir',
        listening: 'Estou ouvindo. Pode falar.',
        stopped: 'Parei de ouvir.',
        processing: 'Mensagem enviada. Preparando a resposta.',
        transcribing: 'Entendi. Um momento.',
        noSpeech: 'Não ouvi nada. Pressione ' + keys + ' para tentar de novo.',
        denied: 'Não tenho acesso ao microfone. Verifique as permissões do navegador ou digite sua mensagem.',
        unsupported: 'Este navegador não permite falar com o agente. Você pode digitar sua mensagem.',
        failed: 'Não consegui entender o áudio. Tente de novo ou digite sua mensagem.',
        readAloud: 'Ler respostas em voz alta',
        readAloudOn: 'Leitura em voz alta ativada.',
        readAloudOff: 'Leitura em voz alta desativada.',
        speechStopped: 'Leitura interrompida.',
        slower: 'Certo, vou falar mais devagar.',
        writtenOnly: 'Certo, vou responder só por escrito. Ative “ler respostas em voz alta” para me ouvir de novo.',
        nothingToRepeat: 'Ainda não há nenhuma resposta para repetir.',
        link: 'link',
        shortcutKeys: keys,
        shortcutHint: 'Pressione ' + keys + ' a qualquer momento para falar com o agente web. Você ouvirá um som quando puder começar a falar.',
        firstOpen: 'Dica: pressione ' + keys + ' para falar em vez de digitar.',
        wakeWord: 'Ouvir “Olá TALIA”',
        wakeOn: 'Modo “Olá TALIA” ativado. Enquanto estiver ativo, seu navegador ouve o microfone para detectar “Olá TALIA”. Desative com o mesmo interruptor.',
        wakeOff: 'Modo “Olá TALIA” desativado.',
        wakeLauncher: 'ouvindo “Olá TALIA”',
        handsFreeEnded: 'Não ouvi mais nada. Pressione ' + keys + ' para falar de novo.',
        greetingWakeHint: 'Diga “Olá TALIA” ou toque em Falar.',
        wakeOffer: 'Quer que na próxima vez eu possa ser ativada quando você disser “Olá TALIA”? Enquanto este site estiver aberto, seu navegador vai ouvir o microfone para detectar essa frase. Diga sim ou não.',
        wakeOfferAccepted: 'Pronto. Quando quiser, diga “Olá TALIA”. Você pode desativar no botão Mãos livres. Mais alguma coisa?',
        wakeOfferDeclined: 'Tudo bem. Mais alguma coisa?',
        greetingVoiceHint: 'Você pode escrever ou falar comigo.',
        greetingType: 'Escrever',
        greetingTalk: 'Falar',
        greetingNotice: 'Se você falar, sua voz é transcrita para responder.',
        dockListeningTitle: 'Estou ouvindo…',
        dockListeningHint: 'Fale normalmente e faça uma pausa ao terminar.',
        dockThinkingTitle: 'Um momento…',
        dockThinkingHint: 'Estou preparando a resposta.',
        dockSpeakingTitle: 'TALIA está respondendo',
        dockSpeakingHint: 'Diga “pare” ou toque em Parar.',
        dockDone: 'Pronto',
        dockCancel: 'Cancelar',
        dockStop: 'Parar',
        handsFreeLabel: 'Mãos livres: diga “Olá TALIA”',
        handsFreeTitle: 'Quando ativado, seu navegador ouve o microfone apenas para detectar “Olá TALIA”.'
      };
    }
    return {
      micStart: 'Hablar con el agente',
      micStop: 'Dejar de escuchar',
      listening: 'Te escucho. Puedes hablar.',
      stopped: 'He dejado de escuchar.',
      processing: 'Mensaje enviado. Preparando la respuesta.',
      transcribing: 'Te he oído. Un momento.',
      noSpeech: 'No te he oído. Pulsa ' + keys + ' para volver a intentarlo.',
      denied: 'No tengo acceso al micrófono. Revisa los permisos del navegador o escribe tu mensaje.',
      unsupported: 'Este navegador no permite hablar con el agente. Puedes escribir tu mensaje.',
      failed: 'No he podido entender el audio. Vuelve a intentarlo o escribe tu mensaje.',
      readAloud: 'Leer respuestas en voz alta',
      readAloudOn: 'Lectura en voz alta activada.',
      readAloudOff: 'Lectura en voz alta desactivada.',
      speechStopped: 'Lectura detenida.',
      slower: 'De acuerdo, hablaré más despacio.',
      writtenOnly: 'De acuerdo, te responderé solo por escrito. Activa “leer respuestas en voz alta” para volver a escucharme.',
      nothingToRepeat: 'Todavía no hay ninguna respuesta que repetir.',
      link: 'enlace',
      shortcutKeys: keys,
      shortcutHint: 'Pulsa ' + keys + ' en cualquier momento para hablar con el agente web. Oirás un sonido cuando puedas empezar a hablar.',
      firstOpen: 'Consejo: pulsa ' + keys + ' para hablar en lugar de escribir.',
      wakeWord: 'Escuchar «Hola TALIA»',
      wakeOn: 'Modo «Hola TALIA» activado. Mientras esté activo, tu navegador escucha el micrófono para detectar «Hola TALIA». Desactívalo con el mismo interruptor.',
      wakeOff: 'Modo «Hola TALIA» desactivado.',
      wakeLauncher: 'escuchando «Hola TALIA»',
      handsFreeEnded: 'No he oído nada más. Pulsa ' + keys + ' para volver a hablar.',
      greetingWakeHint: 'Di «Hola TALIA» o pulsa Hablar.',
      wakeOffer: '¿Quieres que la próxima vez puedas llamarme diciendo «Hola TALIA»? Mientras esta web esté abierta, tu navegador escuchará el micrófono para detectar esa frase. Di sí o no.',
      wakeOfferAccepted: 'Hecho. Cuando quieras, di «Hola TALIA». Puedes desactivarlo con el interruptor Manos libres. ¿Algo más?',
      wakeOfferDeclined: 'De acuerdo. ¿Algo más?',
      greetingVoiceHint: 'Puedes escribirme o hablarme.',
      greetingType: 'Escribir',
      greetingTalk: 'Hablar',
      greetingNotice: 'Si hablas, tu voz se transcribe para responderte.',
      dockListeningTitle: 'Te escucho…',
      dockListeningHint: 'Habla con normalidad y haz una pausa al terminar.',
      dockThinkingTitle: 'Un momento…',
      dockThinkingHint: 'Estoy preparando la respuesta.',
      dockSpeakingTitle: 'TALIA está respondiendo',
      dockSpeakingHint: 'Di «para» o pulsa Detener.',
      dockDone: 'Listo',
      dockCancel: 'Cancelar',
      dockStop: 'Detener',
      handsFreeLabel: 'Manos libres: di «Hola TALIA»',
      handsFreeTitle: 'Al activarlo, tu navegador escucha el micrófono solo para detectar «Hola TALIA».'
    };
  }

  function createVoiceController(options) {
    var support = options.support;
    var copy = options.copy;
    var micButton = options.micButton;
    var speakerButton = options.speakerButton;
    var statusRegion = options.status;
    var readAloudKey = 'talia-voice-read-aloud';
    var shortcutAnnouncedKey = 'talia-voice-shortcut-announced';
    var readAloud = getStoredValue(readAloudKey) === 'on';
    // Engines can be downgraded to the browser at runtime (TALIA voice
    // unavailable, rate limited, over the usage limit...).
    var useServerRecognition = support.serverRecognition;
    var useServerSynthesis = support.serverSynthesis;
    // Browser recognition state.
    var recognition = null;
    var recognitionStarted = false;
    var recognitionAborted = false;
    var finalTranscript = '';
    var interimTranscript = '';
    var recognitionError = null;
    // Server recognition state (recording + upload).
    var capture = null;
    var captureToken = 0;
    var transcribing = false;
    // Shared state.
    var listening = false;
    var speaking = false;
    var voiceUsed = false;
    var speechToken = 0;
    var currentSource = null;
    // Voice commands (TAL-8): "slower" lowers the pace for the rest of the
    // visit; "write it" stops speaking replies to voice turns.
    var pace = 'normal';
    var speakVoiceReplies = true;
    var lastReply = null;
    // Hands-free: after a spoken answer to a voice question, listen again.
    var conversationActive = false;
    var followUpListening = false;
    var afterSpeech = null;
    // Opt-in "Hola TALIA" wake word (browser speech engine only).
    var wakeKey = 'talia-voice-wake-word';
    var wakeEnabled = support.browserRecognition && getStoredValue(wakeKey) === 'on';
    var wakeRecognition = null;
    var wakeTimer = null;
    var wakeFailures = 0;
    // After the first spoken answer TALIA asks, once, whether to turn on
    // "Hola TALIA" for next time; the visitor answers by voice (yes / no).
    var wakeOfferKey = 'talia-voice-wake-offer';
    var wakeOfferPending = false;
    // Visual state for the animated sound bars on the launcher and header.
    var awaitingReply = false;
    var visualState = 'idle';
    var outputMeterStop = function () {};
    var earcons = createEarconPlayer();
    var noop = function () {};

    if (!support.enabled) {
      return {
        toggleListening: noop,
        toggleReadAloud: noop,
        stopAll: noop,
        notifyProcessing: noop,
        handleReply: noop,
        announceShortcutOnce: noop,
        toggleWake: noop,
        enableWake: noop,
        disableWake: noop,
        isWakeEnabled: function () { return false; },
        isActive: function () { return false; }
      };
    }

    updateSpeakerButton();
    updateWakeIndicator();
    if (wakeEnabled) scheduleWake(1200);
    document.addEventListener('visibilitychange', function () {
      // Never listen for the wake word in a background tab.
      if (document.hidden) stopWake();
      else scheduleWake(600);
    });

    function announce(message) {
      if (!statusRegion) return;
      // Clear first so identical consecutive messages are announced again.
      statusRegion.textContent = '';
      setTimeout(function () { statusRegion.textContent = message; }, 40);
    }

    // idle | wake | listening | thinking | speaking
    function refreshVisualState() {
      var next = listening ? 'listening'
        : (transcribing || awaitingReply) ? 'thinking'
          : speaking ? 'speaking'
            : (wakeEnabled && wakeRecognition) ? 'wake'
              : 'idle';
      if (next === visualState) return;
      visualState = next;
      if (next !== 'listening' && next !== 'speaking') setLevel(null);
      if (options.onVisualState) options.onVisualState(next);
    }

    function setLevel(level) {
      if (options.onLevel) options.onLevel(level);
    }

    function updateMicButton() {
      refreshVisualState();
      if (!micButton) return;
      micButton.classList.toggle('mic--listening', listening);
      micButton.classList.toggle('mic--busy', transcribing);
      micButton.setAttribute('aria-pressed', listening ? 'true' : 'false');
      var label = listening ? copy.micStop : copy.micStart;
      micButton.setAttribute('aria-label', label);
      micButton.setAttribute('title', label + ' (' + copy.shortcutKeys + ')');
    }

    function updateSpeakerButton() {
      if (!speakerButton) return;
      speakerButton.setAttribute('aria-pressed', readAloud ? 'true' : 'false');
    }

    function failListening(message) {
      listening = false;
      conversationActive = false;
      updateMicButton();
      earcons.play('error');
      announce(message);
      scheduleWake(1500);
    }

    // Nothing was said: a hands-free follow-up ends the conversation quietly.
    function handleNoSpeech() {
      earcons.play('cancel');
      if (followUpListening && conversationActive) {
        conversationActive = false;
        announce(copy.handsFreeEnded);
      } else {
        announce(copy.noSpeech);
      }
      followUpListening = false;
      scheduleWake(800);
    }

    function toggleListening() {
      if (speaking) stopSpeaking();
      if (transcribing) return;
      if (listening) {
        stopListening(false);
        return;
      }
      startListening(false);
    }

    function startListening(followUp) {
      voiceUsed = true;
      followUpListening = !!followUp;
      stopWake();
      if (useServerRecognition) {
        startServerListening();
        return;
      }
      if (support.browserRecognition) {
        startBrowserListening();
        return;
      }
      earcons.play('error');
      announce(copy.unsupported);
      speak(copy.unsupported, options.language, false);
      if (options.input) options.input.focus();
    }

    // --- TALIA (OpenAI) recognition: record, detect end of speech, upload ----

    function startServerListening() {
      var token = ++captureToken;
      listening = true;
      updateMicButton();
      earcons.prime();

      navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }
      })
        .then(function (stream) {
          if (token !== captureToken || !listening) {
            stopStream(stream);
            return;
          }
          announce(copy.listening);
          // Recording starts after the "you can talk" cue so it is never captured.
          earcons.play('listen', function () {
            if (token !== captureToken || !listening) {
              stopStream(stream);
              return;
            }
            beginRecording(stream, token);
          });
        })
        .catch(function (error) {
          if (token !== captureToken) return;
          var denied = error && (error.name === 'NotAllowedError' || error.name === 'SecurityError');
          if (denied) {
            failListening(copy.denied);
            speak(copy.denied, options.language, false);
            return;
          }
          listening = false;
          updateMicButton();
          if (support.browserRecognition) {
            useServerRecognition = false;
            startBrowserListening();
            return;
          }
          failListening(copy.failed);
        });
    }

    function beginRecording(stream, token) {
      var mimeType = getRecorderMimeType();
      var recorder;
      try {
        recorder = mimeType ? new window.MediaRecorder(stream, { mimeType: mimeType }) : new window.MediaRecorder(stream);
      } catch {
        stopStream(stream);
        failListening(copy.failed);
        return;
      }

      var chunks = [];
      var current = {
        recorder: recorder,
        stream: stream,
        heardSpeech: false,
        discard: false,
        stopMeter: noop
      };
      capture = current;

      recorder.ondataavailable = function (event) {
        if (event.data && event.data.size) chunks.push(event.data);
      };

      recorder.onstop = function () {
        current.stopMeter();
        stopStream(stream);
        if (capture === current) capture = null;
        listening = false;
        updateMicButton();
        if (current.discard || token !== captureToken) return;

        if (!current.heardSpeech || !chunks.length) {
          handleNoSpeech();
          return;
        }

        var blob = new Blob(chunks, { type: recorder.mimeType || mimeType || 'audio/webm' });
        earcons.play('captured');
        announce(copy.transcribing);
        transcribe(blob, token);
      };

      try {
        recorder.start(250);
      } catch {
        stopStream(stream);
        capture = null;
        failListening(copy.failed);
        return;
      }
      current.stopMeter = watchForEndOfSpeech(stream, current);
    }

    // Stops automatically after a pause once the visitor has spoken, when no
    // speech is heard at all, or at the hard 30 s cap.
    function watchForEndOfSpeech(stream, current) {
      var context = earcons.getContext();
      if (!context) return noop;
      var source;
      var analyser;
      try {
        source = context.createMediaStreamSource(stream);
        analyser = context.createAnalyser();
        analyser.fftSize = 1024;
        source.connect(analyser);
      } catch {
        return noop;
      }

      var samples = new Uint8Array(analyser.fftSize);
      var startedAt = Date.now();
      var lastVoiceAt = startedAt;
      var interval = setInterval(function () {
        analyser.getByteTimeDomainData(samples);
        var sum = 0;
        for (var index = 0; index < samples.length; index += 1) {
          var value = (samples[index] - 128) / 128;
          sum += value * value;
        }
        var level = Math.sqrt(sum / samples.length);
        setLevel(Math.min(1, level * 7));
        var now = Date.now();
        if (level > 0.035) {
          current.heardSpeech = true;
          lastVoiceAt = now;
        }
        var pauseAfterSpeech = current.heardSpeech && now - lastVoiceAt > 1500;
        var nothingHeard = !current.heardSpeech && now - startedAt > 8000;
        if (pauseAfterSpeech || nothingHeard || now - startedAt > 30000) {
          stopRecorder(current);
        }
      }, 100);

      return function () {
        clearInterval(interval);
        try { source.disconnect(); } catch { /* already disconnected */ }
      };
    }

    function stopRecorder(current) {
      current.stopMeter();
      current.stopMeter = noop;
      if (current.recorder.state !== 'inactive') {
        try { current.recorder.stop(); } catch { /* already stopped */ }
      }
    }

    function transcribe(blob, token) {
      transcribing = true;
      updateMicButton();
      var form = new FormData();
      form.append('audio', blob, 'speech');
      form.append('session_id', sessionId);
      form.append('page_url', getCurrentPageUrl());
      // No language hint: visitors may speak a language other than the page's,
      // and TALIA answers in the language they use.

      fetch(baseUrl + '/api/chat/' + tenantId + '/transcribe', { method: 'POST', body: form })
        .then(function (response) {
          return response.json().catch(function () { return {}; }).then(function (data) {
            return { ok: response.ok, status: response.status, data: data };
          });
        })
        .then(function (result) {
          transcribing = false;
          updateMicButton();
          if (token !== captureToken) return;
          var text = result.ok && result.data && typeof result.data.text === 'string' ? result.data.text.trim() : '';
          if (text) {
            deliverTranscript(text);
            return;
          }
          if (result.ok) {
            handleNoSpeech();
            return;
          }
          voiceLog('transcription failed', result.status, result.data && result.data.error);
          if (shouldUseBrowserFallback(result.status) && support.browserRecognition) useServerRecognition = false;
          failListening(copy.failed);
        })
        .catch(function () {
          transcribing = false;
          updateMicButton();
          if (token !== captureToken) return;
          failListening(copy.failed);
        });
    }

    // --- Browser recognition (fallback) ---------------------------------------

    function startBrowserListening() {
      var Recognition = getSpeechRecognitionConstructor();
      if (!Recognition) {
        failListening(copy.unsupported);
        return;
      }

      finalTranscript = '';
      interimTranscript = '';
      recognitionError = null;
      recognitionStarted = false;
      recognitionAborted = false;
      try {
        recognition = new Recognition();
      } catch {
        failListening(copy.unsupported);
        return;
      }
      recognition.lang = getRecognitionLanguage(options.language);
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.maxAlternatives = 1;

      recognition.onresult = function (event) {
        interimTranscript = '';
        for (var index = event.resultIndex; index < event.results.length; index += 1) {
          var result = event.results[index];
          var transcript = result[0] && result[0].transcript ? result[0].transcript : '';
          if (result.isFinal) finalTranscript += transcript;
          else interimTranscript += transcript;
        }
        options.onInterim((finalTranscript + interimTranscript).trim());
      };

      recognition.onerror = function (event) {
        recognitionError = event && event.error ? event.error : 'unknown';
        voiceLog('recognition error', recognitionError);
      };

      recognition.onend = function () {
        recognition = null;
        recognitionStarted = false;
        listening = false;
        updateMicButton();
        var text = (finalTranscript || interimTranscript).trim();
        finalTranscript = '';
        interimTranscript = '';

        if (recognitionAborted || recognitionError === 'aborted') return;
        if (text) {
          earcons.play('captured');
          deliverTranscript(text);
          return;
        }
        options.onInterim('');
        if (recognitionError === 'not-allowed' || recognitionError === 'service-not-allowed') {
          earcons.play('error');
          announce(copy.denied);
          speak(copy.denied, options.language, false);
        } else if (!recognitionError || recognitionError === 'no-speech') {
          handleNoSpeech();
        } else {
          earcons.play('error');
          announce(copy.failed);
        }
      };

      listening = true;
      updateMicButton();
      announce(copy.listening);
      // Start the recognizer only after the "you can talk" cue has played so the
      // cue itself is never transcribed.
      earcons.play('listen', function () {
        if (!listening || !recognition) {
          recognition = null;
          return;
        }
        try {
          recognition.start();
          recognitionStarted = true;
        } catch {
          recognition = null;
          failListening(copy.failed);
        }
      });
    }

    function stopListening(silent) {
      if (!listening) return;
      listening = false;
      updateMicButton();

      if (capture) {
        // Server recording in progress: stop() submits it, unless discarded.
        capture.discard = !!silent;
        if (silent) captureToken += 1;
        stopRecorder(capture);
        return;
      }

      if (recognition && recognitionStarted) {
        if (silent) {
          // Discard what was heard (panel closed, conversation restarted...).
          recognitionAborted = true;
          try { recognition.abort(); } catch { /* already stopped */ }
        } else {
          // stop() keeps what was already said; `onend` submits it.
          try { recognition.stop(); } catch { /* already stopped */ }
        }
        return;
      }

      // Stopped while waiting for the microphone or during the start cue.
      captureToken += 1;
      recognition = null;
      if (!silent) {
        earcons.play('cancel');
        announce(copy.stopped);
      }
    }

    // Short spoken commands are handled locally, without an AI call. Anything
    // else (including "talk to a person") goes to the agent, whose fallback
    // policy already offers the venue's human contact options.
    function deliverTranscript(text) {
      if (wakeOfferPending) {
        wakeOfferPending = false;
        var answer = getYesNoAnswer(text);
        if (answer) {
          options.onInterim('');
          if (answer === 'yes') setWake(true);
          earcons.play(answer === 'yes' ? 'captured' : 'cancel');
          var reply = answer === 'yes' ? copy.wakeOfferAccepted : copy.wakeOfferDeclined;
          announce(reply);
          speak(reply, options.language, false, continueConversation);
          return;
        }
        // Anything else is a normal question: answer it.
      }
      var command = getVoiceCommand(text);
      if (!command) {
        conversationActive = true;
        options.onTranscript(text);
        return;
      }
      options.onInterim('');
      if (command === 'stop') {
        conversationActive = false;
        stopSpeaking();
        scheduleWake(800);
        earcons.play('cancel');
        announce(copy.speechStopped);
        return;
      }
      if (command === 'write') {
        conversationActive = false;
        stopSpeaking();
        scheduleWake(800);
        speakVoiceReplies = false;
        readAloud = false;
        setStoredValue(readAloudKey, 'off');
        updateSpeakerButton();
        earcons.play('captured');
        announce(copy.writtenOnly);
        return;
      }
      if (command === 'slower') {
        pace = 'slow';
        if (lastReply) {
          speak(copy.slower + ' ' + lastReply.text, lastReply.language, true, continueConversation);
        } else {
          speak(copy.slower, options.language, false);
        }
        return;
      }
      // repeat
      if (lastReply) {
        speak(lastReply.text, lastReply.language, true, continueConversation);
        return;
      }
      earcons.play('cancel');
      announce(copy.nothingToRepeat);
      speak(copy.nothingToRepeat, options.language, false);
    }

    // --- Spoken replies ---------------------------------------------------------

    function speak(text, language, withCue, then) {
      if (!support.synthesis) return;
      var clean = getSpeakableText(text, copy.link);
      if (!clean) return;
      var token = ++speechToken;
      stopCurrentAudio();
      stopWake();
      speaking = true;
      afterSpeech = then || null;
      refreshVisualState();

      function start() {
        if (token !== speechToken) return;
        if (useServerSynthesis) speakWithServer(clean, language, token);
        else speakWithBrowser(clean, language, token);
      }

      if (withCue) earcons.play('reply', start);
      else start();
    }

    function speakWithServer(text, language, token) {
      var context = earcons.getContext();
      if (!context) {
        speakWithBrowser(text, language, token);
        return;
      }
      // A short first chunk starts playback sooner; the rest is prefetched.
      var chunks = splitSpeechChunks(text, 240, 1000);
      var pending = [];

      function fetchChunk(index) {
        if (!pending[index]) {
          pending[index] = fetch(baseUrl + '/api/chat/' + tenantId + '/speech', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              session_id: sessionId,
              text: chunks[index],
              language: getSpeechLanguage(language),
              page_url: getCurrentPageUrl(),
              pace: pace
            })
          })
            .then(function (response) {
              if (!response.ok) throw response.status;
              return response.arrayBuffer();
            })
            .then(function (buffer) {
              return new Promise(function (resolve, reject) {
                context.decodeAudioData(buffer, resolve, reject);
              });
            });
          // Avoid unhandled rejections for prefetched chunks that never play.
          pending[index].catch(noop);
        }
        return pending[index];
      }

      function playChunk(index) {
        if (token !== speechToken) return;
        if (index >= chunks.length) {
          finishSpeech(token);
          return;
        }
        fetchChunk(index)
          .then(function (audioBuffer) {
            if (token !== speechToken) return;
            if (index + 1 < chunks.length) fetchChunk(index + 1);
            if (context.state === 'suspended' && typeof context.resume === 'function') context.resume().catch(noop);
            var source = context.createBufferSource();
            source.buffer = audioBuffer;
            outputMeterStop();
            outputMeterStop = meterOutput(context, source);
            currentSource = source;
            source.onended = function () {
              outputMeterStop();
              outputMeterStop = noop;
              if (currentSource === source) currentSource = null;
              playChunk(index + 1);
            };
            source.start();
          })
          .catch(function (status) {
            if (token !== speechToken) return;
            if (shouldUseBrowserFallback(status)) useServerSynthesis = false;
            // Finish this reply with the browser voice when possible.
            if (support.browserSynthesis) {
              speakWithBrowser(chunks.slice(index).join(' '), language, token);
              return;
            }
            finishSpeech(token, true);
            earcons.play('error');
          });
      }

      playChunk(0);
    }

    function speakWithBrowser(text, language, token) {
      if (!support.browserSynthesis) {
        finishSpeech(token, true);
        return;
      }
      var synth = window.speechSynthesis;
      synth.cancel();
      var chunks = splitSpeechChunks(text, 220, 220);
      var lang = getSpeechLanguage(language);
      var voice = pickSpeechVoice(lang);

      function speakChunk(index) {
        if (token !== speechToken) return;
        if (index >= chunks.length) {
          finishSpeech(token);
          return;
        }
        var utterance = new window.SpeechSynthesisUtterance(chunks[index]);
        utterance.lang = lang;
        if (voice) utterance.voice = voice;
        utterance.rate = pace === 'slow' ? 0.8 : 1;
        utterance.onend = function () { speakChunk(index + 1); };
        utterance.onerror = function () {
          if (token === speechToken) speaking = false;
        };
        synth.speak(utterance);
      }

      speakChunk(0);
    }

    function stopCurrentAudio() {
      if (currentSource) {
        var source = currentSource;
        currentSource = null;
        source.onended = null;
        try { source.stop(); } catch { /* already stopped */ }
      }
      if (support.browserSynthesis) {
        try { window.speechSynthesis.cancel(); } catch { /* ignore */ }
      }
    }

    // Routes TALIA's voice through an analyser so the bars follow it.
    function meterOutput(context, source) {
      var analyser;
      try {
        analyser = context.createAnalyser();
        analyser.fftSize = 512;
        source.connect(analyser);
        analyser.connect(context.destination);
      } catch {
        source.connect(context.destination);
        return noop;
      }
      var samples = new Uint8Array(analyser.fftSize);
      var interval = setInterval(function () {
        analyser.getByteTimeDomainData(samples);
        var sum = 0;
        for (var index = 0; index < samples.length; index += 1) {
          var value = (samples[index] - 128) / 128;
          sum += value * value;
        }
        setLevel(Math.min(1, Math.sqrt(sum / samples.length) * 5));
      }, 70);
      return function () {
        clearInterval(interval);
        setLevel(null);
      };
    }

    // Called when a reply finishes playing on its own (not when stopped).
    function finishSpeech(token, failed) {
      if (token !== speechToken) return;
      speaking = false;
      refreshVisualState();
      var next = afterSpeech;
      afterSpeech = null;
      if (next && !failed) next();
      else scheduleWake(800);
    }

    function stopSpeaking() {
      speechToken += 1;
      speaking = false;
      afterSpeech = null;
      outputMeterStop();
      outputMeterStop = noop;
      stopCurrentAudio();
      refreshVisualState();
    }

    // Explicit, informed opt-in: asked once per browser, only where the
    // browser engine can listen for the phrase, and only by voice to a
    // visitor who is already talking to TALIA.
    function shouldOfferWake() {
      return support.browserRecognition && !wakeEnabled && !getStoredValue(wakeOfferKey)
        && conversationActive && options.isPanelOpen();
    }

    function afterVoiceAnswer() {
      if (!shouldOfferWake()) {
        continueConversation();
        return;
      }
      setStoredValue(wakeOfferKey, 'asked');
      announce(copy.wakeOffer);
      speak(copy.wakeOffer, options.language, false, function () {
        wakeOfferPending = true;
        continueConversation();
      });
    }

    function continueConversation() {
      if (!conversationActive || !options.isPanelOpen()) {
        conversationActive = false;
        scheduleWake(800);
        return;
      }
      // Short pause so the end of the answer is not mistaken for speech.
      setTimeout(function () {
        if (conversationActive && !listening && !speaking && !transcribing && options.isPanelOpen()) {
          startListening(true);
        }
      }, 350);
    }

    // --- Opt-in "Hola TALIA" wake word ------------------------------------------

    function isIdle() {
      return !listening && !speaking && !transcribing;
    }

    function updateWakeIndicator() {
      refreshVisualState();
      var active = wakeEnabled && !!wakeRecognition;
      if (options.wakeButton) options.wakeButton.setAttribute('aria-checked', wakeEnabled ? 'true' : 'false');
      if (options.onWakeChange) options.onWakeChange(wakeEnabled);
      if (options.launcher) {
        options.launcher.classList.toggle('toggle--wake', active);
        options.launcher.setAttribute('aria-label', options.launcherLabel + (active ? ' · ' + copy.wakeLauncher : ''));
      }
    }

    function scheduleWake(delay) {
      clearTimeout(wakeTimer);
      if (!wakeEnabled) return;
      wakeTimer = setTimeout(startWake, delay);
    }

    function startWake() {
      if (!wakeEnabled || wakeRecognition || !isIdle() || document.hidden) return;
      var Recognition = getSpeechRecognitionConstructor();
      if (!Recognition) return;
      var wake;
      try {
        wake = new Recognition();
      } catch {
        return;
      }
      wake.lang = getRecognitionLanguage(options.language);
      wake.continuous = true;
      wake.interimResults = true;
      wake.maxAlternatives = 1;
      wake.onresult = function (event) {
        for (var index = event.resultIndex; index < event.results.length; index += 1) {
          var transcript = event.results[index][0] ? event.results[index][0].transcript : '';
          voiceLog('wake heard', transcript, isWakePhrase(transcript, options.assistantName) ? '(match)' : '');
          if (isWakePhrase(transcript, options.assistantName)) {
            wakeFailures = 0;
            stopWake();
            options.openPanel();
            // Give the browser a moment to release the wake recognizer.
            setTimeout(function () { if (isIdle()) startListening(false); }, 200);
            return;
          }
        }
      };
      wake.onerror = function (event) {
        var error = event && event.error;
        voiceLog('wake error', error);
        if (error === 'not-allowed' || error === 'service-not-allowed') {
          setWake(false);
          announce(copy.denied);
          return;
        }
        if (error !== 'no-speech' && error !== 'aborted') wakeFailures += 1;
      };
      wake.onend = function () {
        if (wakeRecognition !== wake) return;
        wakeRecognition = null;
        updateWakeIndicator();
        // Browsers end continuous recognition periodically: resume with backoff.
        scheduleWake(Math.min(15000, 400 * Math.pow(2, wakeFailures)));
      };
      wakeRecognition = wake;
      voiceLog('wake listening', wake.lang);
      try {
        wake.start();
      } catch {
        wakeRecognition = null;
        wakeFailures += 1;
        scheduleWake(Math.min(15000, 400 * Math.pow(2, wakeFailures)));
      }
      updateWakeIndicator();
    }

    function stopWake() {
      clearTimeout(wakeTimer);
      if (wakeRecognition) {
        var wake = wakeRecognition;
        wakeRecognition = null;
        wake.onend = null;
        wake.onresult = null;
        try { wake.abort(); } catch { /* already stopped */ }
      }
      updateWakeIndicator();
    }

    function setWake(on) {
      wakeEnabled = !!on && support.browserRecognition;
      setStoredValue(wakeKey, wakeEnabled ? 'on' : 'off');
      wakeFailures = 0;
      if (wakeEnabled) startWake();
      else stopWake();
      updateWakeIndicator();
    }

    return {
      toggleListening: toggleListening,
      toggleReadAloud: function () {
        readAloud = !readAloud;
        if (readAloud) speakVoiceReplies = true;
        setStoredValue(readAloudKey, readAloud ? 'on' : 'off');
        updateSpeakerButton();
        if (!readAloud) stopSpeaking();
        earcons.play(readAloud ? 'captured' : 'cancel');
        announce(readAloud ? copy.readAloudOn : copy.readAloudOff);
      },
      stopAll: function (announceStop) {
        var wasActive = listening || speaking || transcribing;
        var wasSpeaking = speaking;
        conversationActive = false;
        awaitingReply = false;
        stopListening(true);
        // Ignore a transcription that is still in flight.
        captureToken += 1;
        stopSpeaking();
        if (announceStop && wasActive) {
          earcons.play('cancel');
          announce(wasSpeaking ? copy.speechStopped : copy.stopped);
        }
        scheduleWake(1000);
      },
      notifyProcessing: function (fromVoice) {
        // A typed submit is a user gesture: unlock audio so a later read-aloud
        // reply can play under browser autoplay rules.
        if (readAloud) earcons.prime();
        if (!fromVoice) return;
        awaitingReply = true;
        refreshVisualState();
        earcons.play('processing');
        announce(copy.processing);
      },
      handleReply: function (text, language, fromVoice, failed) {
        awaitingReply = false;
        refreshVisualState();
        if (!failed) lastReply = { text: text, language: language };
        // Replies are spoken for voice turns (unless the visitor said "write
        // it"), or for every turn when "read answers aloud" is on.
        if (!(fromVoice && speakVoiceReplies) && !readAloud) return;
        if (failed) {
          conversationActive = false;
          earcons.play('error', function () { speak(text, language, false); });
          return;
        }
        speak(text, language, true, fromVoice ? afterVoiceAnswer : null);
      },
      enableWake: function () {
        // Called from the visitor's click on "Activar voz", so the browser can
        // show its microphone permission prompt.
        setWake(true);
        earcons.play('captured');
      },
      disableWake: function () {
        setWake(false);
        earcons.play('cancel');
        announce(copy.wakeOff);
      },
      isWakeEnabled: function () { return wakeEnabled; },
      toggleWake: function () {
        // Turned on from a click, so the browser can ask for the microphone.
        setWake(!wakeEnabled);
        earcons.play(wakeEnabled ? 'captured' : 'cancel');
        announce(wakeEnabled ? copy.wakeOn : copy.wakeOff);
      },
      announceShortcutOnce: function () {
        if (!support.recognition) return;
        if (getStoredValue(shortcutAnnouncedKey)) return;
        setStoredValue(shortcutAnnouncedKey, '1');
        setTimeout(function () {
          // Visitors who already opened with the shortcut don't need the tip.
          if (!voiceUsed) announce(copy.firstOpen);
        }, 600);
      },
      isActive: function () { return listening || speaking || transcribing; }
    };
  }

  // "Hola TALIA", "Hello TALIA", "Hey TALIA", "Olá TALIA"... Recognizers may
  // write the name as Talía or Thalia; the venue's assistant name also works.
  function voiceLog() {
    if (!voiceDebug || !window.console) return;
    var args = Array.prototype.slice.call(arguments);
    args.unshift('[TALIA voice]');
    console.info.apply(console, args);
  }

  function isWakePhrase(text, assistantName) {
    var normalize = function (value) {
      var result = String(value || '').toLowerCase();
      if (typeof result.normalize === 'function') result = result.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      return result.replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
    };
    // Speech engines often "correct" the uncommon name TALIA into a familiar
    // word (Spanish engines hear "Hola Italia", "Natalia", "Dalia"...).
    var names = ['talia', 'thalia', 'tahlia', 'talya', 'tallia', 'tali a', 'tal ia', 'italia', 'natalia', 'dalia', 'thalya'];
    var custom = normalize(assistantName);
    if (custom && custom.indexOf(' ') < 0 && names.indexOf(custom) < 0) names.push(custom);
    var heard = normalize(text);
    var greeting = '(hola|holaa|hello|hallo|hey|hi|ola|oi|ei|ey|eh|bon dia|buenas|buenos dias|ok|okay|oye)';
    var pattern = new RegExp('(^| )' + greeting + ' (' + names.join('|') + ')( |$)');
    if (pattern.test(heard)) return true;
    // The name alone ("¡Talía!") also wakes the agent, but not a longer
    // sentence that merely mentions it.
    return /^(talia|thalia|tahlia|talya)$/.test(heard) || (custom && heard === custom);
  }

  var VOICE_COMMANDS = {
    stop: ['para', 'parar', 'detente', 'calla', 'callate', 'silencio', 'basta', 'stop', 'be quiet', 'quiet', 'atura', 'atura t', 'prou', 'pare', 'chega', 'silencio por favor'],
    repeat: ['repite', 'repitelo', 'repitemelo', 'otra vez', 'puedes repetir', 'repeat', 'repeat that', 'say it again', 'again', 'repeteix', 'repeteix ho', 'una altra vegada', 'repete', 'repita', 'de novo', 'pode repetir'],
    slower: ['mas despacio', 'mas lento', 'habla mas despacio', 'habla mas lento', 'slower', 'more slowly', 'speak slower', 'speak more slowly', 'mes a poc a poc', 'mes lent', 'parla mes a poc a poc', 'mais devagar', 'mais lento', 'fale mais devagar'],
    write: ['escribelo', 'por escrito', 'escribemelo', 'solo por escrito', 'write it', 'write it down', 'in writing', 'escriu ho', 'per escrit', 'escreva', 'por escrito por favor', 'so por escrito']
  };

  var YES_NO_ANSWERS = {
    yes: ['si', 'vale', 'claro', 'de acuerdo', 'venga', 'ok', 'okay', 'por supuesto', 'si gracias', 'si por favor', 'activalo', 'perfecto', 'val', 'd acord', 'si us plau', 'yes', 'yeah', 'yep', 'sure', 'yes please', 'of course', 'sim', 'pode ser', 'sim por favor'],
    no: ['no', 'no gracias', 'ahora no', 'mejor no', 'de momento no', 'no cal', 'ara no', 'no thanks', 'no thank you', 'not now', 'nope', 'nao', 'nao obrigado', 'nao obrigada', 'agora nao']
  };

  function getYesNoAnswer(text) {
    var normalized = String(text || '').toLowerCase();
    if (typeof normalized.normalize === 'function') normalized = normalized.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    normalized = normalized.replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
    if (!normalized || normalized.split(' ').length > 4) return null;
    if (YES_NO_ANSWERS.yes.indexOf(normalized) >= 0) return 'yes';
    if (YES_NO_ANSWERS.no.indexOf(normalized) >= 0) return 'no';
    return null;
  }

  function getVoiceCommand(text) {
    var normalized = String(text || '').toLowerCase();
    if (typeof normalized.normalize === 'function') normalized = normalized.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    normalized = normalized
      .replace(/[^a-z0-9\s]/g, ' ')
      .replace(/\b(por favor|please|si us plau|porfa|talia)\b/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    if (!normalized || normalized.split(' ').length > 6) return null;
    for (var command in VOICE_COMMANDS) {
      if (VOICE_COMMANDS[command].indexOf(normalized) >= 0) return command;
    }
    return null;
  }

  // TALIA voice is unavailable, failing, rate limited or over the venue's
  // usage limit: keep voice working with the browser engine for the rest of
  // the visit instead of failing on every turn.
  function shouldUseBrowserFallback(status) {
    return status === 402 || status === 429 || status === 502 || status === 503;
  }

  function getRecorderMimeType() {
    var candidates = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus'];
    if (typeof window.MediaRecorder.isTypeSupported !== 'function') return '';
    for (var index = 0; index < candidates.length; index += 1) {
      if (window.MediaRecorder.isTypeSupported(candidates[index])) return candidates[index];
    }
    return '';
  }

  function stopStream(stream) {
    if (!stream || typeof stream.getTracks !== 'function') return;
    stream.getTracks().forEach(function (track) {
      try { track.stop(); } catch { /* already stopped */ }
    });
  }

  // Short synthesized tones so no audio files are fetched and the host CSP is
  // unaffected. Each step of the voice flow has a distinct, recognizable cue.
  function createEarconPlayer() {
    var context = null;
    var patterns = {
      listen: [[660, 0, 0.09], [880, 0.11, 0.13]],
      captured: [[880, 0, 0.08], [660, 0.1, 0.1]],
      processing: [[523, 0, 0.07]],
      reply: [[523, 0, 0.08], [659, 0.09, 0.08], [784, 0.18, 0.14]],
      cancel: [[440, 0, 0.12]],
      error: [[330, 0, 0.14], [262, 0.18, 0.2]]
    };

    function getContext() {
      if (context) return context;
      var AudioContextConstructor = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextConstructor) return null;
      try {
        context = new AudioContextConstructor();
      } catch {
        context = null;
      }
      return context;
    }

    function prime() {
      var audio = getContext();
      if (audio && audio.state === 'suspended' && typeof audio.resume === 'function') {
        audio.resume().catch(function () {});
      }
      return audio;
    }

    return {
      getContext: getContext,
      prime: prime,
      play: function (name, done) {
        var pattern = patterns[name];
        var audio = prime();
        var duration = 0;
        if (pattern && audio) {
          var start = audio.currentTime + 0.02;
          pattern.forEach(function (note) {
            var oscillator = audio.createOscillator();
            var gain = audio.createGain();
            var noteStart = start + note[1];
            var noteEnd = noteStart + note[2];
            oscillator.type = name === 'error' ? 'triangle' : 'sine';
            oscillator.frequency.setValueAtTime(note[0], noteStart);
            gain.gain.setValueAtTime(0.0001, noteStart);
            gain.gain.exponentialRampToValueAtTime(0.18, noteStart + 0.015);
            gain.gain.exponentialRampToValueAtTime(0.0001, noteEnd);
            oscillator.connect(gain);
            gain.connect(audio.destination);
            oscillator.start(noteStart);
            oscillator.stop(noteEnd + 0.02);
            duration = Math.max(duration, note[1] + note[2]);
          });
        }
        if (done) setTimeout(done, Math.round((duration + 0.08) * 1000));
      }
    };
  }

  function getRecognitionLanguage(widgetLanguage) {
    // Prefer the language of the page the visitor is reading (multilingual
    // venue sites set it per version), then the browser, then the widget.
    var candidates = [
      document.documentElement && document.documentElement.lang,
      navigator.language,
      getSpeechLanguage(widgetLanguage)
    ];
    for (var index = 0; index < candidates.length; index += 1) {
      var value = typeof candidates[index] === 'string' ? candidates[index].trim() : '';
      if (/^[a-z]{2,3}(-[A-Za-z0-9]{2,8})*$/i.test(value)) {
        return value.indexOf('-') > 0 ? value : getSpeechLanguage(value);
      }
    }
    return 'es-ES';
  }

  function getSpeechLanguage(language) {
    var value = String(language || '').trim();
    var base = value.toLowerCase().split(/[-_]/)[0];
    if (value.indexOf('-') > 0 || value.indexOf('_') > 0) return value.replace('_', '-');
    if (base === 'es') return 'es-ES';
    if (base === 'ca') return 'ca-ES';
    if (base === 'en') return 'en-US';
    if (base === 'pt') return 'pt-BR';
    if (base === 'fr') return 'fr-FR';
    if (base === 'it') return 'it-IT';
    if (base === 'de') return 'de-DE';
    return value || 'es-ES';
  }

  function pickSpeechVoice(lang) {
    try {
      var voices = window.speechSynthesis.getVoices() || [];
      var normalized = lang.toLowerCase();
      var base = normalized.split('-')[0];
      return voices.find(function (voice) { return voice.lang && voice.lang.toLowerCase().replace('_', '-') === normalized; })
        || voices.find(function (voice) { return voice.lang && voice.lang.toLowerCase().split(/[-_]/)[0] === base; })
        || null;
    } catch {
      return null;
    }
  }

  function getSpeakableText(text, linkWord) {
    return String(text || '')
      .replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, '$1')
      .replace(/https?:\/\/\S+/g, linkWord)
      .replace(/[*_`#>~]+/g, '')
      .replace(/^\s*[-•]\s+/gm, '')
      .replace(/\s*\n+\s*/g, '. ')
      .replace(/\.\s*\./g, '.')
      .replace(/\s{2,}/g, ' ')
      .trim();
  }

  // Speak sentence-sized chunks: some browser engines cut long utterances, and
  // TALIA voice starts sooner when the first chunk is short.
  function splitSpeechChunks(text, firstMax, max) {
    var sentences = text.match(/[^.!?¿¡…]+[.!?…]*\s*/g) || [text];
    var chunks = [];
    var current = '';
    sentences.forEach(function (sentence) {
      var limit = chunks.length ? max : firstMax;
      if ((current + sentence).length > limit && current) {
        chunks.push(current.trim());
        current = '';
      }
      // A single very long sentence is hard-split so it never exceeds the API cap.
      while (sentence.length > max) {
        chunks.push(sentence.slice(0, max).trim());
        sentence = sentence.slice(max);
      }
      current += sentence;
    });
    if (current.trim()) chunks.push(current.trim());
    return chunks.filter(function (chunk) { return chunk.length > 0; });
  }

  function getMicIcon() {
    return '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="2" width="6" height="12" rx="3"></rect><path d="M19 10v1a7 7 0 0 1-14 0v-1"></path><path d="M12 18v4"></path><path d="M8 22h8"></path></svg>';
  }

  function getPencilIcon() {
    return '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"></path><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"></path></svg>';
  }

  function getSpeakerIcon() {
    return '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 5 6 9H2v6h4l5 4V5z"></path><path d="M15.5 8.5a5 5 0 0 1 0 7"></path><path d="M19 5a10 10 0 0 1 0 14"></path></svg>';
  }

  // TALIA's face (public/icon.svg). Shown white via a CSS filter, so it needs
  // no CORS on the venue's site.
  function getTaliaFaceIcon(iconUrl) {
    return '<img class="launcher-icon launcher-icon--talia" src="' + escapeHtml(iconUrl) + '" alt="" aria-hidden="true" />';
  }

  // The TALIA monogram: the open "Λ" of the TALIA wordmark, in currentColor.
  function getTaliaMarkIcon() {
    return '<svg class="launcher-icon launcher-icon--mark" viewBox="0 0 100 100" aria-hidden="true" focusable="false"><path d="M43 13h15l27 69q1.5 4 6 5v1H67v-1q4.5-1 3-5L50.5 31 32 82q-1.5 4 3 5v1H13v-1q4.5-1 6-5z"></path></svg>';
  }

  function getLauncherIconMarkup(launcherIcon, iconUrl) {
    if (launcherIcon === 'mark') return getTaliaMarkIcon();

    if (launcherIcon === 'bubble') {
      return '<svg class="launcher-icon launcher-icon--bubble" viewBox="0 0 24 24" aria-hidden="true" focusable="false" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z"></path><path d="M8 12h.01"></path><path d="M12 12h.01"></path><path d="M16 12h.01"></path></svg>';
    }

    if (launcherIcon === 'bot') {
      return '<svg class="launcher-icon launcher-icon--bot" viewBox="0 0 24 24" aria-hidden="true" focusable="false" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect width="16" height="12" x="4" y="8" rx="2"></rect><path d="M9 4h6"></path><path d="M12 4v4"></path><path d="M8 12h.01"></path><path d="M16 12h.01"></path><path d="M9 16h6"></path></svg>';
    }

    if (launcherIcon === 'chat') {
      return '<svg class="launcher-icon launcher-icon--chat" viewBox="0 0 24 24" aria-hidden="true" focusable="false" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z"></path></svg>';
    }

    return getTaliaFaceIcon(iconUrl);
  }

  function getRestartIcon() {
    return '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 3-6.7"></path><path d="M3 4v6h6"></path></svg>';
  }

  function createSessionId() {
    return crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + '-' + Math.random().toString(16).slice(2);
  }

  // Session storage: lasts for the visitor's current visit (browser tab).
  function getSessionValue(key) {
    try {
      return window.sessionStorage.getItem(key);
    } catch {
      return null;
    }
  }

  function setSessionValue(key, value) {
    try {
      window.sessionStorage.setItem(key, value);
    } catch {
      // Without storage the greeting may simply show again on the next page.
    }
  }

  function getStoredValue(key) {
    try {
      return window.localStorage.getItem(key);
    } catch {
      return null;
    }
  }

  function setStoredValue(key, value) {
    try {
      window.localStorage.setItem(key, value);
    } catch {
      // The widget remains usable when storage is disabled by the browser or host page.
    }
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

  function getWidgetChromeCopy(language) {
    if (language === 'ca') {
      return {
        initialMessage: 'Hola, soc la TALIA. En què et puc ajudar?',
        greetingLabel: 'Salutació de l’agent web',
        close: 'Tancar',
        restart: 'Tornar a començar',
        inputPlaceholder: 'Escriu el teu missatge...',
        send: 'Enviar',
        openAssistant: 'Obrir agent web',
        landmark: 'Agent web {name}',
        accessLinkVoice: 'Assistent de veu {name}: prem {keys} o aquest botó per parlar',
        accessLinkOpen: 'Obrir l’assistent {name}'
      };
    }
    if (language === 'en') {
      return {
        initialMessage: 'Hi, I am TALIA. How can I help?',
        greetingLabel: 'Web agent greeting',
        close: 'Close',
        restart: 'Start over',
        inputPlaceholder: 'Type your message...',
        send: 'Send',
        openAssistant: 'Open web agent',
        landmark: '{name} web agent',
        accessLinkVoice: '{name} voice assistant: press {keys} or this button to talk',
        accessLinkOpen: 'Open the {name} assistant'
      };
    }
    if (language === 'pt-BR') {
      return {
        initialMessage: 'Olá, sou a TALIA. Como posso ajudar?',
        greetingLabel: 'Saudação do agente web',
        close: 'Fechar',
        restart: 'Começar novamente',
        inputPlaceholder: 'Digite sua mensagem...',
        send: 'Enviar',
        openAssistant: 'Abrir agente web',
        landmark: 'Agente web {name}',
        accessLinkVoice: 'Assistente de voz {name}: pressione {keys} ou este botão para falar',
        accessLinkOpen: 'Abrir a assistente {name}'
      };
    }
    return {
      initialMessage: 'Hola, soy TALIA. ¿En qué puedo ayudarte?',
      greetingLabel: 'Saludo del agente web',
      close: 'Cerrar',
      restart: 'Volver a comenzar',
      inputPlaceholder: 'Escribe tu mensaje...',
      send: 'Enviar',
      openAssistant: 'Abrir agente web',
      landmark: 'Agente web {name}',
      accessLinkVoice: 'Asistente de voz {name}: pulsa {keys} o este botón para hablar',
      accessLinkOpen: 'Abrir el asistente {name}'
    };
  }

  function mountAccessLink(label, color, onActivate) {
    if (document.getElementById('talia-access-link')) return;
    var linkHost = document.createElement('div');
    linkHost.id = 'talia-access-link';
    linkHost.classList.add('notranslate');
    linkHost.setAttribute('translate', 'no');
    document.body.insertBefore(linkHost, document.body.firstChild);
    var linkRoot = linkHost.attachShadow({ mode: 'open' });
    linkRoot.innerHTML = '<style>'
      + '.access { position: fixed; top: 12px; left: 12px; z-index: 2147483647; padding: 12px 18px; border: 2px solid #fff; border-radius: 10px; background: ' + color + '; color: #fff; font: 600 16px/1.3 system-ui, sans-serif; cursor: pointer; box-shadow: 0 6px 20px rgba(0,0,0,.25); }'
      + '.access:not(:focus):not(:focus-visible) { width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0 0 0 0); clip-path: inset(50%); white-space: nowrap; border: 0; }'
      + '.access:focus-visible { outline: 3px solid #fff; outline-offset: 3px; }'
      + '</style><button class="access" type="button">' + escapeHtml(label) + '</button>';
    linkRoot.querySelector('button').addEventListener('click', onActivate);
  }

  function getProactiveMessage(value, assistantName, language) {
    if (typeof value === 'string' && value.trim()) return value.trim().slice(0, 160);
    if (language === 'ca') return 'Soc ' + assistantName + ". T'ajudo?";
    if (language === 'en') return "I'm " + assistantName + '. Can I help?';
    if (language === 'pt-BR') return 'Sou a ' + assistantName + '. Posso ajudar?';
    return 'Soy ' + assistantName + '. ¿Te ayudo?';
  }

  function getLauncherIcon(value) {
    return value === 'mark' || value === 'chat' || value === 'bubble' || value === 'bot' ? value : 'talia';
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

  // Host sites often run smooth-scroll libraries (Lenis, Locomotive, GSAP ScrollSmoother...)
  // that listen for wheel/touch on window and call preventDefault(), which blocks native
  // trackpad scrolling inside our panels. We opt out explicitly and scroll our own containers.
  function isolateWidgetScroll(host, root) {
    host.setAttribute('data-lenis-prevent', '');
    host.setAttribute('data-scroll-lock-scrollable', '');

    root.addEventListener('wheel', function (event) {
      if (event.ctrlKey) return; // trackpad pinch-zoom
      var scroller = findWidgetScroller(event, root);
      if (!scroller) return;
      var unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? scroller.clientHeight : 1;
      scroller.scrollTop += event.deltaY * unit;
      scroller.scrollLeft += event.deltaX * unit;
      event.preventDefault();
      event.stopPropagation();
    }, { passive: false });

    ['touchstart', 'touchmove'].forEach(function (type) {
      root.addEventListener(type, function (event) {
        if (findWidgetScroller(event, root)) event.stopPropagation();
      }, { passive: true });
    });
  }

  function findWidgetScroller(event, root) {
    var path = event.composedPath ? event.composedPath() : [];
    for (var index = 0; index < path.length; index += 1) {
      var node = path[index];
      if (node === root) return null;
      if (!node || node.nodeType !== 1) continue;
      var style = window.getComputedStyle(node);
      var scrollsY = /(auto|scroll)/.test(style.overflowY) && node.scrollHeight > node.clientHeight;
      var scrollsX = /(auto|scroll)/.test(style.overflowX) && node.scrollWidth > node.clientWidth;
      if (scrollsY || scrollsX) return node;
    }
    return null;
  }
})();
