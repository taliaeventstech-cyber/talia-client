(function () {
  var script = document.currentScript;
  if (!script) return;

  var tenantId = script.getAttribute('data-tenant');
  if (!tenantId) {
    console.warn('[TALIA Accessibility] Missing data-tenant attribute');
    return;
  }
  var explicitEnabled = script.getAttribute('data-enabled') === 'true' || script.getAttribute('data-accessibility') === 'true';
  var baseUrl = new URL(script.src, window.location.href).origin;
  var remoteConfigLoaded = false;

  fetch(baseUrl + '/api/widget/' + tenantId)
    .then(function (response) {
      if (!response.ok) throw new Error('Widget config not available');
      return response.json();
    })
    .then(function (config) {
      remoteConfigLoaded = true;
      var accessibility = config && config.accessibility && typeof config.accessibility === 'object'
        ? config.accessibility
        : null;

      if (accessibility && accessibility.enabled === true) {
        mountWidget(buildConfig(accessibility, true));
        return;
      }

      if (explicitEnabled) {
        mountWidget(buildConfig(accessibility || config || {}, Boolean(accessibility)));
      }
    })
    .catch(function () {
      if (!remoteConfigLoaded && explicitEnabled) {
        mountWidget(buildConfig({}, false));
      }
    });

  function buildConfig(remote, fromAccessibilityConfig) {
    var language = getLanguage(readString(remote.language) || script.getAttribute('data-language') || 'auto');
    var primaryColor = sanitizeColor(
      readString(remote.primaryColor) ||
      script.getAttribute('data-color') ||
      '#00e0c7'
    );
    var highlightColor = sanitizeColor(
      readString(remote.highlightColor) ||
      script.getAttribute('data-highlight-color') ||
      '#fffb00',
      '#fffb00'
    );
    var controls = remote.controls && typeof remote.controls === 'object' ? remote.controls : {};

    return {
      tenantId: tenantId,
      language: language,
      primaryColor: primaryColor,
      highlightColor: highlightColor,
      position: readString(remote.position) || script.getAttribute('data-position') || 'bottom-right',
      showBranding: fromAccessibilityConfig ? remote.showBranding !== false : script.getAttribute('data-branding') !== 'false',
      clearViewEnabled: fromAccessibilityConfig ? remote.clearViewEnabled !== false : script.getAttribute('data-clear-view') !== 'false',
      controls: {
        textSize: controls.textSize !== false,
        contrast: controls.contrast !== false,
        grayscale: controls.grayscale !== false,
        highlightLinks: controls.highlightLinks !== false,
        pauseAnimations: controls.pauseAnimations !== false,
        lineSpacing: controls.lineSpacing !== false,
        readableFont: controls.readableFont !== false,
        lowStimulation: controls.lowStimulation !== false,
        readingMask: controls.readingMask !== false && controls.focusReading !== false,
        readingLine: controls.readingLine !== false,
        highlightContent: controls.highlightContent !== false,
        readAloud: controls.readAloud !== false,
        dyslexiaFont: controls.dyslexiaFont !== false,
        profiles: controls.profiles !== false,
      },
    };
  }

  function mountWidget(config) {
    if (document.getElementById('talia-accessibility-root')) return;

    injectGlobalStyles();

    var overlayHost = document.createElement('div');
    overlayHost.id = 'talia-accessibility-overlay';
    setImportant(overlayHost, 'position', 'fixed');
    setImportant(overlayHost, 'inset', '0');
    setImportant(overlayHost, 'width', '100vw');
    setImportant(overlayHost, 'height', '100vh');
    setImportant(overlayHost, 'display', 'block');
    setImportant(overlayHost, 'pointer-events', 'none');
    setImportant(overlayHost, 'z-index', '2147483647');
    setImportant(overlayHost, 'overflow', 'visible');
    setImportant(overlayHost, 'max-width', 'none');
    setImportant(overlayHost, 'max-height', 'none');
    setImportant(overlayHost, 'margin', '0');
    setImportant(overlayHost, 'padding', '0');
    setImportant(overlayHost, 'border', '0');
    setImportant(overlayHost, 'background', 'transparent');
    setImportant(overlayHost, 'box-sizing', 'border-box');
    setImportant(overlayHost, 'contain', 'none');
    setImportant(overlayHost, 'isolation', 'isolate');
    setImportant(overlayHost, 'transform', 'none');
    setImportant(overlayHost, 'filter', 'none');
    setImportant(overlayHost, 'clip-path', 'none');
    (document.documentElement || document.body).appendChild(overlayHost);
    var overlayElements = createOverlayElements(overlayHost, config);

    var host = document.createElement('div');
    host.id = 'talia-accessibility-root';
    host.style.position = 'relative';
    host.style.zIndex = '2147483647';
    document.body.appendChild(host);
    registerFloatingWidget(host, 'accessibility', config.position);

    var root = host.attachShadow({ mode: 'open' });
    var copy = getCopy(config.language);
    var state = readState(config.tenantId);
    var previousFocus = null;

    root.innerHTML = getTemplate(copy, config);

    var panel = root.querySelector('[data-panel]');
    var toggle = root.querySelector('[data-toggle]');
    var close = root.querySelector('[data-close]');
    var reset = root.querySelector('[data-reset]');
    var increase = root.querySelector('[data-text-increase]');
    var decrease = root.querySelector('[data-text-decrease]');
    var clearViewButton = root.querySelector('[data-clear-view]');
    var controlsView = root.querySelector('[data-controls-view]');
    var aiView = root.querySelector('[data-ai-view]');
    var controlsTab = root.querySelector('[data-tab-controls]');
    var aiTab = root.querySelector('[data-tab-ai]');
    var clearView = root.querySelector('[data-clear-view-panel]');
    var clearViewContent = root.querySelector('[data-clear-view-content]');
    var clearViewBack = root.querySelector('[data-clear-view-back]');
    var clearViewRefresh = root.querySelector('[data-clear-view-refresh]');
    var readAloudButton = root.querySelector('[data-read-aloud]');
    var profileButtons = Array.prototype.slice.call(root.querySelectorAll('[data-profile]'));
    var controlButtons = Array.prototype.slice.call(root.querySelectorAll('[data-control]'));
    var speaking = false;
    var speechKeepAlive = 0;
    var focusTop = overlayElements.focusTop;
    var focusBand = overlayElements.focusBand;
    var focusBottom = overlayElements.focusBottom;
    var readingLine = overlayElements.readingLine;
    var contentHighlight = overlayElements.contentHighlight;
    var targetReadingY = Math.round(window.innerHeight / 2);
    var currentReadingY = targetReadingY;
    var focusFrame = 0;
    var highlightTarget = null;
    var highlightFrame = 0;

    applyState(state);
    renderState();

    toggle.addEventListener('click', function () {
      if (panel.classList.contains('panel--open')) {
        closePanel();
      } else {
        openPanel();
      }
    });

    close.addEventListener('click', function () {
      closePanel();
      toggle.focus();
    });

    reset.addEventListener('click', function () {
      stopSpeaking();
      state = getDefaultState();
      saveState(config.tenantId, state);
      applyState(state);
      renderState();
    });

    if (readAloudButton) {
      readAloudButton.addEventListener('click', function () {
        if (speaking) {
          stopSpeaking();
        } else {
          startSpeaking();
        }
      });
    }

    profileButtons.forEach(function (button) {
      button.addEventListener('click', function () {
        applyProfile(button.getAttribute('data-profile'));
      });
    });

    if (increase) {
      increase.addEventListener('click', function () {
        state.textScale = Math.min(4, state.textScale + 1);
        saveState(config.tenantId, state);
        applyState(state);
        renderState();
      });
    }

    if (decrease) {
      decrease.addEventListener('click', function () {
        state.textScale = Math.max(0, state.textScale - 1);
        saveState(config.tenantId, state);
        applyState(state);
        renderState();
      });
    }

    controlButtons.forEach(function (button) {
      button.addEventListener('click', function () {
        var key = button.getAttribute('data-control');
        state[key] = !state[key];
        saveState(config.tenantId, state);
        applyState(state);
        renderState();
      });
    });

    document.addEventListener('mousemove', function (event) {
      if (event.target && event.target.closest && event.target.closest('#talia-accessibility-root, #talia-widget-root')) return;
      if (state.readingMask || state.readingLine) setReadingTarget(event.clientY, false);
      if (state.highlightContent) setHighlightTarget(event.target);
    }, { passive: true });

    document.addEventListener('focusin', function (event) {
      if ((!state.readingMask && !state.readingLine && !state.highlightContent) || !event.target || !event.target.getBoundingClientRect) return;
      if (event.target.closest && event.target.closest('#talia-accessibility-root, #talia-widget-root')) return;
      var rect = event.target.getBoundingClientRect();
      if ((state.readingMask || state.readingLine) && rect.height > 0) {
        setReadingTarget(Math.round(rect.top + (rect.height / 2)), true);
      }
      if (state.highlightContent) setHighlightTarget(event.target);
    });

    window.addEventListener('scroll', function () {
      scheduleFocusReading(false);
      scheduleContentHighlight();
    }, { passive: true });
    window.addEventListener('resize', function () {
      setReadingTarget(currentReadingY, true);
      scheduleContentHighlight();
    }, { passive: true });

    if (clearViewButton && clearView && clearViewContent && clearViewBack && clearViewRefresh) {
      if (controlsTab && aiTab && aiView) {
        controlsTab.addEventListener('click', function () {
          showTab('controls');
        });

        aiTab.addEventListener('click', function () {
          showTab('ai');
        });
      }

      clearViewButton.addEventListener('click', function () {
        var content = extractClearViewContent(copy);
        controlsView.hidden = true;
        if (aiView) aiView.hidden = true;
        clearView.hidden = false;
        clearViewButton.setAttribute('aria-expanded', 'true');
        clearViewBack.focus();
        renderAiClearView(content, copy, config, clearViewContent, false);
      });

      clearViewRefresh.addEventListener('click', function () {
        clearViewContent.innerHTML = '<p class="clear-summary">' + escapeHtml(copy.clearViewLoading) + '</p>';
        clearClearViewCache(config.tenantId, config.language);
        renderAiClearView(extractClearViewContent(copy), copy, config, clearViewContent, true);
      });

      clearViewBack.addEventListener('click', function () {
        clearView.hidden = true;
        clearViewButton.setAttribute('aria-expanded', 'false');
        showTab('ai');
        clearViewButton.focus();
      });
    }

    root.addEventListener('keydown', function (event) {
      if (event.key === 'Tab' && panel.classList.contains('panel--open')) {
        trapPanelFocus(event);
        return;
      }

      if (isTabKeyEvent(event)) {
        handleTabKeyNavigation(event);
        return;
      }

      if (event.key === 'Escape' && panel.classList.contains('panel--open')) {
        closePanel();
        focusPanelReturnTarget();
      }
    });

    function applyProfile(name) {
      var presets = {
        dyslexia: { dyslexiaFont: true, lineSpacing: true, readingLine: true, textScale: 1 },
        adhd: { lowStimulation: true, pauseAnimations: true, readingMask: true },
        lowvision: { textScale: 3, contrast: true, readableFont: true },
        calm: { lowStimulation: true, pauseAnimations: true, grayscale: true },
      };
      var preset = presets[name];
      if (!preset) return;

      stopSpeaking();
      state = getDefaultState();
      Object.keys(preset).forEach(function (key) {
        state[key] = preset[key];
      });
      saveState(config.tenantId, state);
      applyState(state);
      renderState();
    }

    function startSpeaking() {
      if (!('speechSynthesis' in window) || !readAloudButton) return;
      stopSpeaking();

      var chunks = collectSpeechChunks();
      if (!chunks.length) return;

      var lang = getSpeechLang(config.language);
      var voice = pickSpeechVoice(lang);
      speaking = true;
      readAloudButton.setAttribute('aria-pressed', 'true');
      readAloudButton.classList.add('control--active');

      chunks.forEach(function (text, index) {
        var utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = lang;
        if (voice) utterance.voice = voice;
        if (index === chunks.length - 1) {
          utterance.onend = function () { if (speaking) stopSpeaking(); };
        }
        window.speechSynthesis.speak(utterance);
      });

      // Chrome pauses long synthesis queues after ~15s; keep it alive while active.
      speechKeepAlive = window.setInterval(function () {
        if (!speaking || !window.speechSynthesis.speaking) return;
        window.speechSynthesis.resume();
      }, 10000);
    }

    function stopSpeaking() {
      speaking = false;
      if (speechKeepAlive) {
        window.clearInterval(speechKeepAlive);
        speechKeepAlive = 0;
      }
      if ('speechSynthesis' in window) window.speechSynthesis.cancel();
      if (readAloudButton) {
        readAloudButton.setAttribute('aria-pressed', 'false');
        readAloudButton.classList.remove('control--active');
      }
    }

    function openPanel() {
      previousFocus = root.activeElement || toggle;
      panel.classList.add('panel--open');
      panel.setAttribute('aria-hidden', 'false');
      panel.inert = false;
      toggle.setAttribute('aria-expanded', 'true');
      setTimeout(function () {
        var firstControl = root.querySelector('[data-tab-controls]') || root.querySelector('[data-text-increase]') || root.querySelector('[data-control]') || reset;
        if (firstControl) firstControl.focus();
      }, 50);
    }

    function closePanel() {
      panel.classList.remove('panel--open');
      panel.setAttribute('aria-hidden', 'true');
      panel.inert = true;
      toggle.setAttribute('aria-expanded', 'false');
      if (clearViewButton) clearViewButton.setAttribute('aria-expanded', 'false');
    }

    function focusPanelReturnTarget() {
      if (previousFocus && typeof previousFocus.focus === 'function') {
        previousFocus.focus();
        return;
      }

      toggle.focus();
    }

    function showTab(tab) {
      if (!controlsView || !aiView || !controlsTab || !aiTab) return;

      var isAi = tab === 'ai';
      controlsView.hidden = isAi;
      aiView.hidden = !isAi;
      clearView.hidden = true;
      controlsTab.classList.toggle('tab--active', !isAi);
      aiTab.classList.toggle('tab--active', isAi);
      controlsTab.setAttribute('aria-selected', isAi ? 'false' : 'true');
      aiTab.setAttribute('aria-selected', isAi ? 'true' : 'false');
      controlsView.setAttribute('aria-hidden', isAi ? 'true' : 'false');
      aiView.setAttribute('aria-hidden', isAi ? 'false' : 'true');
    }

    function trapPanelFocus(event) {
      var focusable = getFocusablePanelElements();
      if (!focusable.length) {
        event.preventDefault();
        panel.focus();
        return;
      }

      var first = focusable[0];
      var last = focusable[focusable.length - 1];
      var active = root.activeElement;

      if (event.shiftKey && active === first) {
        event.preventDefault();
        last.focus();
        return;
      }

      if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    }

    function getFocusablePanelElements() {
      return Array.prototype.slice.call(panel.querySelectorAll('a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'))
        .filter(function (element) {
          return !element.closest('[hidden]') && element.offsetWidth > 0 && element.offsetHeight > 0;
        });
    }

    function isTabKeyEvent(event) {
      return (event.key === 'ArrowLeft' || event.key === 'ArrowRight' || event.key === 'Home' || event.key === 'End') &&
        event.target &&
        event.target.getAttribute &&
        event.target.getAttribute('role') === 'tab';
    }

    function handleTabKeyNavigation(event) {
      if (!controlsTab || !aiTab) return;
      var tabs = [controlsTab, aiTab];
      var currentIndex = tabs.indexOf(event.target);
      if (currentIndex < 0) return;

      event.preventDefault();
      var nextIndex = currentIndex;
      if (event.key === 'ArrowRight') nextIndex = (currentIndex + 1) % tabs.length;
      if (event.key === 'ArrowLeft') nextIndex = (currentIndex + tabs.length - 1) % tabs.length;
      if (event.key === 'Home') nextIndex = 0;
      if (event.key === 'End') nextIndex = tabs.length - 1;
      tabs[nextIndex].click();
      tabs[nextIndex].focus();
    }

    function renderState() {
      if (increase) {
        increase.disabled = state.textScale >= 4;
        increase.setAttribute('aria-pressed', state.textScale > 0 ? 'true' : 'false');
      }

      if (decrease) {
        decrease.disabled = state.textScale <= 0;
        decrease.setAttribute('aria-pressed', 'false');
      }

      controlButtons.forEach(function (button) {
        var key = button.getAttribute('data-control');
        var active = Boolean(state[key]);
        button.classList.toggle('control--active', active);
        button.setAttribute('aria-pressed', active ? 'true' : 'false');
      });

      var textLevel = root.querySelector('[data-text-level]');
      if (textLevel) textLevel.textContent = copy.textLevel(state.textScale);
      scheduleFocusReading(true);
      renderContentHighlight();
    }

    function setReadingTarget(value, immediate) {
      targetReadingY = clampReadingY(value);
      if (immediate) currentReadingY = targetReadingY;
      scheduleFocusReading(immediate);
    }

    function scheduleFocusReading(immediate) {
      if (immediate) {
        renderFocusReading(true);
        return;
      }

      if (focusFrame) return;
      focusFrame = window.requestAnimationFrame(function () {
        focusFrame = 0;
        renderFocusReading(false);
      });
    }

    function renderFocusReading(immediate) {
      if (!focusTop || !focusBand || !focusBottom || !readingLine) return;

      var maskEnabled = Boolean(state.readingMask);
      var lineEnabled = Boolean(state.readingLine);
      var displayMask = maskEnabled ? 'block' : 'none';
      setImportant(focusTop, 'display', displayMask);
      setImportant(focusBand, 'display', displayMask);
      setImportant(focusBottom, 'display', displayMask);
      setImportant(readingLine, 'display', lineEnabled ? 'block' : 'none');
      if (!maskEnabled && !lineEnabled) return;

      var viewportWidth = getViewportWidth();
      var viewportHeight = getViewportHeight();
      var viewportWidthCss = viewportWidth + 'px';
      var bandHeight = Math.max(96, Math.min(140, Math.round(viewportHeight * 0.16)));
      var halfBand = Math.round(bandHeight / 2);
      var safeY = clampReadingY(targetReadingY);
      var distance = safeY - currentReadingY;
      currentReadingY = immediate || Math.abs(distance) < 0.5
        ? safeY
        : currentReadingY + (distance * 0.65);
      var visualY = clampReadingY(currentReadingY);
      var topHeight = Math.max(0, visualY - halfBand);
      var bottomTop = Math.min(viewportHeight, visualY + halfBand);

      setImportant(focusTop, 'width', viewportWidthCss);
      setImportant(focusTop, 'height', topHeight + 'px');
      setImportant(focusBand, 'width', viewportWidthCss);
      setImportant(focusBand, 'top', topHeight + 'px');
      setImportant(focusBand, 'height', bandHeight + 'px');
      setImportant(focusBottom, 'width', viewportWidthCss);
      setImportant(focusBottom, 'top', bottomTop + 'px');
      setImportant(focusBottom, 'height', Math.max(0, viewportHeight - bottomTop) + 'px');
      setImportant(readingLine, 'width', viewportWidthCss);
      setImportant(readingLine, 'min-width', viewportWidthCss);
      setImportant(readingLine, 'transform', 'translate3d(0,' + visualY + 'px,0) translateY(-50%)');
      if (!immediate && Math.abs(safeY - visualY) >= 0.5 && (maskEnabled || lineEnabled)) {
        scheduleFocusReading(false);
      }
    }

    function clampReadingY(value) {
      return Math.max(0, Math.min(getViewportHeight(), Math.round(value)));
    }

    function setHighlightTarget(element) {
      var nextTarget = findHighlightElement(element);
      if (nextTarget === highlightTarget) return;
      highlightTarget = nextTarget;
      scheduleContentHighlight();
    }

    function scheduleContentHighlight() {
      if (highlightFrame) return;
      highlightFrame = window.requestAnimationFrame(function () {
        highlightFrame = 0;
        renderContentHighlight();
      });
    }

    function renderContentHighlight() {
      if (!contentHighlight) return;

      var enabled = Boolean(state.highlightContent && highlightTarget && highlightTarget.isConnected);
      setImportant(contentHighlight, 'display', enabled ? 'block' : 'none');
      if (!enabled) return;

      var rect = highlightTarget.getBoundingClientRect();
      var viewportWidth = getViewportWidth();
      var viewportHeight = getViewportHeight();
      if (rect.width < 24 || rect.height < 18 || rect.bottom < 0 || rect.top > viewportHeight) {
        setImportant(contentHighlight, 'display', 'none');
        return;
      }

      var padding = 8;
      var left = Math.max(8, rect.left - padding);
      var top = Math.max(8, rect.top - padding);
      var right = Math.min(viewportWidth - 8, rect.right + padding);
      var bottom = Math.min(viewportHeight - 8, rect.bottom + padding);

      setImportant(contentHighlight, 'width', Math.max(0, Math.round(right - left)) + 'px');
      setImportant(contentHighlight, 'height', Math.max(0, Math.round(bottom - top)) + 'px');
      setImportant(contentHighlight, 'transform', 'translate3d(' + Math.round(left) + 'px,' + Math.round(top) + 'px,0)');
    }

    function findHighlightElement(element) {
      if (!element || !element.closest) return null;

      var candidate = element.closest('article, section, main, aside, form, fieldset, nav, header, footer, li, p, blockquote, figure, table, details, [role="article"], [role="region"], [role="group"], [class*="card"], [class*="item"], [class*="panel"], [class*="block"]');
      if (!candidate || candidate.closest('#talia-accessibility-root, #talia-widget-root')) return null;

      var rect = candidate.getBoundingClientRect();
      while (
        candidate.parentElement &&
        candidate.parentElement !== document.body &&
        (rect.width < 80 || rect.height < 36)
      ) {
        candidate = candidate.parentElement;
        rect = candidate.getBoundingClientRect();
      }

      if (rect.width > getViewportWidth() * 0.96 && rect.height > getViewportHeight() * 0.8) {
        return element.closest('section, article, form, li, p, blockquote, figure, table, details, [class*="card"], [class*="item"]') || null;
      }

      return candidate;
    }
  }

  function injectGlobalStyles() {
    if (document.getElementById('talia-accessibility-styles')) return;

    var style = document.createElement('style');
    style.id = 'talia-accessibility-styles';
    style.textContent = '\
      html.talia-a11y-text-1 body :where(p, li, a, button, input, textarea, select, label, span, dd, dt, figcaption, blockquote) { font-size: 125% !important; }\
      html.talia-a11y-text-2 body :where(p, li, a, button, input, textarea, select, label, span, dd, dt, figcaption, blockquote) { font-size: 150% !important; }\
      html.talia-a11y-text-3 body :where(p, li, a, button, input, textarea, select, label, span, dd, dt, figcaption, blockquote) { font-size: 175% !important; }\
      html.talia-a11y-text-4 body :where(p, li, a, button, input, textarea, select, label, span, dd, dt, figcaption, blockquote) { font-size: 200% !important; }\
      html.talia-a11y-contrast body { background: #000 !important; color: #fff !important; }\
      html.talia-a11y-contrast body :where(main, section, article, aside, header, footer, nav, div, p, li, h1, h2, h3, h4, h5, h6, label, span) { background-color: #000 !important; color: #fff !important; border-color: #fff !important; }\
      html.talia-a11y-contrast body :where(a, button) { color: #ffff00 !important; }\
      html.talia-a11y-grayscale body > :not(#talia-accessibility-root):not(#talia-widget-root) { filter: grayscale(1) !important; }\
      html.talia-a11y-highlight-links body a { text-decoration: underline !important; text-decoration-thickness: max(2px, .12em) !important; text-underline-offset: .18em !important; outline: 2px solid currentColor !important; outline-offset: 2px !important; }\
      html.talia-a11y-pause-animations *, html.talia-a11y-pause-animations *::before, html.talia-a11y-pause-animations *::after { animation-duration: .001ms !important; animation-iteration-count: 1 !important; scroll-behavior: auto !important; transition-duration: .001ms !important; }\
      html.talia-a11y-line-spacing body :where(p, li, blockquote, dd, dt) { line-height: 1.75 !important; letter-spacing: .02em !important; margin-bottom: 1em !important; }\
      html.talia-a11y-readable-font body :where(p, li, a, button, input, textarea, select, label, span, dd, dt, h1, h2, h3, h4, h5, h6, blockquote) { font-family: Arial, Helvetica, system-ui, sans-serif !important; }\
      html.talia-a11y-dyslexia-font body :where(p, li, a, button, input, textarea, select, label, span, dd, dt, h1, h2, h3, h4, h5, h6, blockquote) { font-family: "OpenDyslexic", "Comic Sans MS", "Comic Sans", Verdana, Tahoma, sans-serif !important; letter-spacing: .06em !important; word-spacing: .16em !important; line-height: 1.6 !important; }\
      html.talia-a11y-reading-mask body :where(p, li, dd, dt, blockquote):not(#talia-accessibility-root *):not(#talia-widget-root *) { line-height: 1.68 !important; }\
      html.talia-a11y-low-stimulation, html.talia-a11y-low-stimulation body { scroll-behavior: auto !important; }\
      html.talia-a11y-low-stimulation body { background: #f7f6f0 !important; color: #1f2933 !important; }\
      html.talia-a11y-low-stimulation body *:not(#talia-accessibility-root):not(#talia-accessibility-root *):not(#talia-widget-root):not(#talia-widget-root *) { animation-duration: .001ms !important; animation-iteration-count: 1 !important; caret-color: #1f2933 !important; text-shadow: none !important; transition-duration: .001ms !important; }\
      html.talia-a11y-low-stimulation body :where(main, section, article, aside, header, footer, nav):not(#talia-accessibility-root):not(#talia-widget-root) { background: #fbfaf6 !important; background-image: none !important; border-color: #d8d5ca !important; box-shadow: none !important; color: #1f2933 !important; }\
      html.talia-a11y-low-stimulation body :where(h1, h2, h3, h4, h5, h6, p, li, dd, dt, label, span):not(#talia-accessibility-root *):not(#talia-widget-root *) { color: #1f2933 !important; }\
      html.talia-a11y-low-stimulation body :where(a, button, input, textarea, select):not(#talia-accessibility-root *):not(#talia-widget-root *) { border-color: #9ca3af !important; box-shadow: none !important; outline-color: #374151 !important; }\
      html.talia-a11y-low-stimulation body :where(img, video, canvas, picture):not(#talia-accessibility-root *):not(#talia-widget-root *) { filter: saturate(.72) contrast(.94) !important; }\
      html.talia-a11y-low-stimulation body :where([class*="gradient"], [class*="marquee"], [class*="ticker"], [class*="carousel"], [class*="slider"], [class*="pulse"], [class*="animate"]):not(#talia-accessibility-root *):not(#talia-widget-root *) { animation: none !important; background-image: none !important; transform: none !important; }\
      html.talia-a11y-low-stimulation body main :where([class*="grid"], [class*="columns"], [class*="cards"], [class*="carousel"], [class*="slider"]):not(#talia-accessibility-root *):not(#talia-widget-root *) { display: block !important; }\
      html.talia-a11y-low-stimulation body main :where(section, article):not(#talia-accessibility-root *):not(#talia-widget-root *) { max-width: 920px !important; margin-left: auto !important; margin-right: auto !important; padding-left: max(16px, 4vw) !important; padding-right: max(16px, 4vw) !important; }\
      html.talia-a11y-low-stimulation body main :where(section, article) + :where(section, article):not(#talia-accessibility-root *):not(#talia-widget-root *) { margin-top: 24px !important; }\
      html.talia-a11y-low-stimulation body :where([class*="badge"], [class*="pill"], [class*="alert"], [class*="urgent"], [class*="countdown"]):not(#talia-accessibility-root *):not(#talia-widget-root *) { background: #eef1ed !important; color: #1f2933 !important; border-color: #cbd5ce !important; }\
    ';
    document.head.appendChild(style);
  }

  function applyState(state) {
    var root = document.documentElement;
    var classes = [
      'talia-a11y-text-1',
      'talia-a11y-text-2',
      'talia-a11y-text-3',
      'talia-a11y-text-4',
      'talia-a11y-contrast',
      'talia-a11y-grayscale',
      'talia-a11y-highlight-links',
      'talia-a11y-pause-animations',
      'talia-a11y-line-spacing',
      'talia-a11y-readable-font',
      'talia-a11y-dyslexia-font',
      'talia-a11y-low-stimulation',
      'talia-a11y-reading-mask',
      'talia-a11y-reading-line',
    ];

    classes.forEach(function (className) {
      root.classList.remove(className);
    });

    if (state.textScale >= 1 && state.textScale <= 4) root.classList.add('talia-a11y-text-' + state.textScale);
    if (state.contrast) root.classList.add('talia-a11y-contrast');
    if (state.grayscale) root.classList.add('talia-a11y-grayscale');
    if (state.highlightLinks) root.classList.add('talia-a11y-highlight-links');
    if (state.pauseAnimations) root.classList.add('talia-a11y-pause-animations');
    if (state.lineSpacing) root.classList.add('talia-a11y-line-spacing');
    if (state.readableFont) root.classList.add('talia-a11y-readable-font');
    if (state.dyslexiaFont) root.classList.add('talia-a11y-dyslexia-font');
    if (state.lowStimulation) root.classList.add('talia-a11y-low-stimulation');
    if (state.readingMask) root.classList.add('talia-a11y-reading-mask');
    if (state.readingLine) root.classList.add('talia-a11y-reading-line');
  }

  function getTemplate(copy, config) {
    var controls = config.controls;
    var togglePosition = getAccessibilityTogglePositionCss(config.position);
    var panelPosition = getAccessibilityPanelPositionCss(config.position);
    var primaryTextColor = getReadableTextColor(config.primaryColor);
    var primaryBorderColor = getAccessibleBorderColor(config.primaryColor);
    var transformOrigin = config.position.indexOf('left') >= 0
      ? (config.position.indexOf('top') >= 0 ? 'top left' : 'bottom left')
      : (config.position.indexOf('top') >= 0 ? 'top right' : 'bottom right');

    return '\
      <style>\
        :host { all: initial; color-scheme: light; font-family: Arial, Helvetica, system-ui, sans-serif; --talia-a11y-primary: ' + config.primaryColor + '; --talia-a11y-primary-text: ' + primaryTextColor + '; --talia-a11y-primary-border: ' + primaryBorderColor + '; --talia-a11y-primary-soft: ' + hexToRgba(config.primaryColor, 0.16) + '; --talia-a11y-highlight: ' + config.highlightColor + '; --talia-a11y-highlight-soft: ' + hexToRgba(config.highlightColor, 0.12) + '; }\
        *, *::before, *::after { box-sizing: border-box; }\
        .toggle { position: fixed; ' + togglePosition + ' z-index: 2147483647; width: 56px; height: 56px; border: 2px solid rgba(17,24,39,.18); border-radius: 999px; background: ' + config.primaryColor + '; color: var(--talia-a11y-primary-text); cursor: pointer; display: grid; place-items: center; box-shadow: 0 6px 20px rgba(0,0,0,.22); transition: transform 150ms ease, box-shadow 150ms ease; }\
        .toggle:hover { transform: scale(1.06); box-shadow: 0 8px 24px rgba(0,0,0,.26); }\
        .toggle:active { transform: scale(.96); }\
        .toggle:focus-visible, button:focus-visible, a:focus-visible { outline: 3px solid #111827; outline-offset: 3px; box-shadow: 0 0 0 6px rgba(255,255,255,.92), 0 0 0 9px #111827; }\
        .toggle svg { width: 38px; height: 38px; display: block; }\
        .panel { position: fixed; ' + panelPosition + ' z-index: 2147483647; width: min(390px, calc(100vw - 32px)); max-height: min(680px, calc(100vh - 136px)); overflow: auto; border: 1px solid #d9dde6; border-radius: 8px; background: #fff; color: #111827; box-shadow: 0 22px 64px rgba(15,23,42,.24); opacity: 0; transform: translateY(10px) scale(.98); transform-origin: ' + transformOrigin + '; pointer-events: none; transition: opacity 180ms ease, transform 180ms ease; }\
        .panel--open { opacity: 1; transform: translateY(0) scale(1); pointer-events: auto; }\
        .header { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; padding: 16px 16px 14px; border-bottom: 1px solid #e7eaf0; background: linear-gradient(180deg, #ffffff 0%, #f8fafc 100%); }\
        .header-main { min-width: 0; display: grid; grid-template-columns: auto 1fr; gap: 11px; align-items: start; }\
        .header-mark { width: 38px; height: 38px; border-radius: 8px; background: var(--talia-a11y-primary-soft); color: #111827; display: grid; place-items: center; }\
        .header-mark svg { width: 25px; height: 25px; }\
        .title { margin: 0 0 3px; font: 800 19px/1.12 Arial, Helvetica, system-ui, sans-serif; color: #111827; }\
        .description { margin: 0; font: 500 13px/1.4 Arial, Helvetica, system-ui, sans-serif; color: #526071; }\
        .close { width: 38px; height: 38px; flex: 0 0 auto; border: 1px solid #d8dde6; border-radius: 8px; background: #fff; color: #111827; font: 28px/1 Arial, Helvetica, system-ui, sans-serif; cursor: pointer; display: grid; place-items: center; box-shadow: 0 1px 2px rgba(15,23,42,.04); }\
        .close:hover { background: #f8fafc; }\
        .body { display: grid; gap: 12px; padding: 14px; }\
        [hidden] { display: none !important; }\
        .view { display: grid; gap: 12px; }\
        .tabs { display: grid; grid-template-columns: 1fr 1fr; gap: 4px; border: 1px solid #e1e5ec; border-radius: 8px; background: #f6f7f9; padding: 4px; }\
        .tab { min-height: 36px; border: 0; border-radius: 6px; background: transparent; color: #4f5b6b; cursor: pointer; font: 800 13px/1 Arial, Helvetica, system-ui, sans-serif; }\
        .tab--active { background: #111827; color: #fff; box-shadow: 0 1px 3px rgba(17,24,39,.18); }\
        .ai-empty { margin: 0; color: #4b5563; font: 500 13px/1.45 Arial, Helvetica, system-ui, sans-serif; }\
        .clear-launch { width: 100%; min-height: 92px; border: 1px solid #111827; border-radius: 8px; background: #111827; color: #fff; cursor: pointer; display: grid; grid-template-columns: auto 1fr; gap: 12px; align-items: center; padding: 15px; text-align: left; box-shadow: 0 10px 24px rgba(17,24,39,.14); }\
        .clear-launch:hover { transform: translateY(-1px); }\
        .clear-launch svg { width: 25px; height: 25px; }\
        .clear-launch strong { display: block; font: 800 16px/1.15 Arial, Helvetica, system-ui, sans-serif; }\
        .clear-launch span { display: block; margin-top: 4px; color: rgba(255,255,255,.8); font: 600 13px/1.4 Arial, Helvetica, system-ui, sans-serif; }\
        .text-row { display: grid; grid-template-columns: 1fr auto auto; gap: 8px; align-items: center; border: 1px solid #e1e5ec; border-radius: 8px; background: #f9fafb; padding: 10px; }\
        .text-level { color: #253041; font: 800 13px/1.2 Arial, Helvetica, system-ui, sans-serif; }\
        .icon-button { width: 40px; height: 40px; border: 1px solid #cfd5df; border-radius: 8px; background: #fff; color: #111827; cursor: pointer; font: 800 20px/1 Arial, Helvetica, system-ui, sans-serif; box-shadow: 0 1px 2px rgba(15,23,42,.04); }\
        .icon-button:hover { border-color: #9aa4b2; background: #f8fafc; }\
        .icon-button:disabled { opacity: .45; cursor: not-allowed; }\
        .profiles { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }\
        .profile { min-height: 44px; border: 1px solid #e1e5ec; border-radius: 8px; background: #f6f7f9; color: #111827; cursor: pointer; padding: 8px 10px; text-align: left; font: 800 13px/1.15 Arial, Helvetica, system-ui, sans-serif; box-shadow: 0 1px 2px rgba(15,23,42,.04); }\
        .profile:hover { background: var(--talia-a11y-primary-soft); border-color: var(--talia-a11y-primary-border); }\
        .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }\
        .control { min-height: 54px; border: 1px solid #d5dae4; border-radius: 8px; background: #fff; color: #111827; cursor: pointer; display: grid; grid-template-columns: auto 1fr; gap: 9px; align-items: center; padding: 10px; text-align: left; font: 800 13px/1.18 Arial, Helvetica, system-ui, sans-serif; box-shadow: 0 1px 2px rgba(15,23,42,.035); }\
        .control:hover { border-color: #9aa4b2; background: #fbfcfe; }\
        .control svg { width: 19px; height: 19px; color: #111827; }\
        .control--active { border-color: var(--talia-a11y-primary-border); background: var(--talia-a11y-primary-soft); color: #111827; box-shadow: inset 0 0 0 1px var(--talia-a11y-primary-border); }\
        .control--active svg { color: #111827; }\
        .reset { width: 100%; border: 1px solid #cfd5df; border-radius: 8px; background: #fff; color: #111827; padding: 12px; cursor: pointer; font: 800 14px/1 Arial, Helvetica, system-ui, sans-serif; }\
        .reset:hover { border-color: #111827; background: #f8fafc; }\
        .clear-toolbar { display: flex; align-items: center; justify-content: space-between; gap: 8px; flex-wrap: wrap; }\
        .clear-back, .clear-refresh { width: fit-content; border: 1px solid #c5c9d0; border-radius: 8px; background: #fff; color: #111827; padding: 9px 11px; cursor: pointer; font: 800 13px/1 Arial, Helvetica, system-ui, sans-serif; }\
        .clear-view-content { display: grid; gap: 14px; }\
        .clear-meta { margin: 0; color: #6b7280; font: 700 11px/1.3 Arial, Helvetica, system-ui, sans-serif; text-transform: uppercase; }\
        .clear-title { margin: 0; color: #111827; font: 800 22px/1.15 Arial, Helvetica, system-ui, sans-serif; }\
        .clear-summary { margin: 0; color: #374151; font: 500 15px/1.55 Arial, Helvetica, system-ui, sans-serif; }\
        .clear-section { display: grid; gap: 8px; border-top: 1px solid #e5e7eb; padding-top: 12px; }\
        .clear-section-heading { display: flex; align-items: center; justify-content: space-between; gap: 10px; }\
        .clear-section h3 { margin: 0; color: #111827; font: 800 15px/1.2 Arial, Helvetica, system-ui, sans-serif; }\
        .clear-tag { flex: 0 0 auto; border-radius: 999px; background: #ecfdf5; color: #065f46; padding: 4px 8px; font: 800 10px/1 Arial, Helvetica, system-ui, sans-serif; text-transform: uppercase; }\
        .clear-section ul { display: grid; gap: 7px; margin: 0; padding-left: 20px; }\
        .clear-section li { color: #374151; font: 500 14px/1.45 Arial, Helvetica, system-ui, sans-serif; }\
        .clear-actions { display: grid; gap: 8px; }\
        .clear-action { display: block; border: 1px solid #111827; border-radius: 8px; padding: 11px 12px; background: #f9fafb; color: #111827; text-decoration: none; font: 800 14px/1.2 Arial, Helvetica, system-ui, sans-serif; }\
        .clear-action:focus-visible { outline: 3px solid #111827; outline-offset: 3px; }\
        .branding { margin: 0; color: #6b7280; text-align: center; font: 600 11px/1.2 Arial, Helvetica, system-ui, sans-serif; }\
        @media (max-width: 420px) { .panel { width: calc(100vw - 24px); max-height: calc(100vh - 168px); } .grid { grid-template-columns: 1fr; } }\
        @media (prefers-reduced-motion: reduce) { .toggle, .panel, .clear-launch { transition: none !important; } .toggle:hover, .toggle:active, .clear-launch:hover { transform: none !important; } }\
      </style>\
      <section class="panel" data-panel id="talia-a11y-panel" role="dialog" aria-modal="true" aria-hidden="true" inert aria-labelledby="talia-a11y-title" aria-describedby="talia-a11y-description" tabindex="-1">\
        <div class="header">\
          <div class="header-main">\
            <span class="header-mark" aria-hidden="true"><svg viewBox="0 0 24 24" focusable="false" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="7.5" r="1.2" fill="currentColor" stroke="none"></circle><path d="M7.5 10.5h9"></path><path d="M12 10.5v4"></path><path d="m9 19 3-4.5 3 4.5"></path></svg></span>\
            <div><h2 class="title" id="talia-a11y-title">' + escapeHtml(copy.title) + '</h2><p class="description" id="talia-a11y-description">' + escapeHtml(copy.description) + '</p></div>\
          </div>\
          <button class="close" data-close type="button" aria-label="' + escapeHtml(copy.close) + '">×</button>\
        </div>\
        <div class="body">\
          ' + (config.clearViewEnabled ? '<div class="tabs" role="tablist" aria-label="' + escapeHtml(copy.tabsLabel) + '">\
            <button class="tab tab--active" id="talia-a11y-tab-controls" data-tab-controls type="button" role="tab" aria-selected="true" aria-controls="talia-a11y-controls">' + escapeHtml(copy.controlsTab) + '</button>\
            <button class="tab" id="talia-a11y-tab-ai" data-tab-ai type="button" role="tab" aria-selected="false" aria-controls="talia-a11y-ai">' + escapeHtml(copy.aiTab) + '</button>\
          </div>' : '') + '\
          <div class="view" data-controls-view id="talia-a11y-controls"' + (config.clearViewEnabled ? ' role="tabpanel" aria-labelledby="talia-a11y-tab-controls" aria-hidden="false"' : '') + '>\
            ' + (controls.profiles ? '<div class="profiles" role="group" aria-label="' + escapeHtml(copy.profilesLabel) + '">\
              <button class="profile" data-profile="dyslexia" type="button">' + escapeHtml(copy.profileDyslexia) + '</button>\
              <button class="profile" data-profile="adhd" type="button">' + escapeHtml(copy.profileAdhd) + '</button>\
              <button class="profile" data-profile="lowvision" type="button">' + escapeHtml(copy.profileLowVision) + '</button>\
              <button class="profile" data-profile="calm" type="button">' + escapeHtml(copy.profileCalm) + '</button>\
            </div>' : '') + '\
            ' + (controls.textSize ? '<div class="text-row"><span class="text-level" data-text-level aria-live="polite"></span><button class="icon-button" data-text-decrease type="button" aria-label="' + escapeHtml(copy.decreaseText) + '">A-</button><button class="icon-button" data-text-increase type="button" aria-label="' + escapeHtml(copy.increaseText) + '">A+</button></div>' : '') + '\
            <div class="grid">\
              ' + (controls.readAloud && ('speechSynthesis' in window) ? '<button class="control" data-read-aloud type="button" aria-pressed="false"><svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9v6h4l5 4V5L8 9H4z"></path><path d="M15.5 8.8a4 4 0 0 1 0 6.4"></path><path d="M18 6.5a8 8 0 0 1 0 11"></path></svg><span>' + escapeHtml(copy.readAloud) + '</span></button>' : '') + '\
              ' + controlTemplate(controls.contrast, 'contrast', copy.contrast, 'M4 4h16v16H4z M8 8h8v8H8z') + '\
              ' + controlTemplate(controls.grayscale, 'grayscale', copy.grayscale, 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z M12 3v18') + '\
              ' + controlTemplate(controls.highlightLinks, 'highlightLinks', copy.highlightLinks, 'M10 13a5 5 0 0 0 7.07 0l2.12-2.12a5 5 0 0 0-7.07-7.07L11 4.93 M14 11a5 5 0 0 0-7.07 0L4.81 13.12a5 5 0 0 0 7.07 7.07L13 19.07') + '\
              ' + controlTemplate(controls.pauseAnimations, 'pauseAnimations', copy.pauseAnimations, 'M8 5h3v14H8z M15 5h3v14h-3z') + '\
              ' + controlTemplate(controls.lineSpacing, 'lineSpacing', copy.lineSpacing, 'M7 6h13 M7 12h13 M7 18h13 M4 5v14') + '\
              ' + controlTemplate(controls.readableFont, 'readableFont', copy.readableFont, 'M4 19 10 5h4l6 14 M7 14h10') + '\
              ' + controlTemplate(controls.dyslexiaFont, 'dyslexiaFont', copy.dyslexiaFont, 'M6 5h9a3 3 0 0 1 0 6H6z M6 11h10a3 3 0 0 1 0 6H6z M6 5v12') + '\
              ' + controlTemplate(controls.lowStimulation, 'lowStimulation', copy.lowStimulation, 'M5 6h14 M7 12h10 M9 18h6') + '\
              ' + controlTemplate(controls.readingMask, 'readingMask', copy.readingMask, 'M4 7h16 M4 17h16 M4 12h16') + '\
              ' + controlTemplate(controls.readingLine, 'readingLine', copy.readingLine, 'M3 12h18') + '\
              ' + controlTemplate(controls.highlightContent, 'highlightContent', copy.highlightContent, 'M6 6h12v12H6z') + '\
            </div>\
            <button class="reset" data-reset type="button">' + escapeHtml(copy.reset) + '</button>\
          </div>\
          ' + (config.clearViewEnabled ? '<div class="view" data-ai-view id="talia-a11y-ai" role="tabpanel" aria-labelledby="talia-a11y-tab-ai" aria-hidden="true" hidden>\
            <button class="clear-launch" data-clear-view type="button" aria-expanded="false" aria-controls="talia-a11y-clear-view-panel">\
              <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 5h16"></path><path d="M4 12h10"></path><path d="M4 19h16"></path></svg>\
              <span><strong>' + escapeHtml(copy.clearView) + '</strong><span>' + escapeHtml(copy.clearViewDescription) + '</span></span>\
            </button>\
          </div>' : '') + '\
          ' + (config.clearViewEnabled ? '<div class="view" data-clear-view-panel id="talia-a11y-clear-view-panel" hidden>\
            <div class="clear-toolbar">\
              <button class="clear-back" data-clear-view-back type="button">' + escapeHtml(copy.backToControls) + '</button>\
              <button class="clear-refresh" data-clear-view-refresh type="button">' + escapeHtml(copy.refreshClearView) + '</button>\
            </div>\
            <div class="clear-view-content" data-clear-view-content role="status" aria-live="polite" aria-atomic="false"></div>\
          </div>' : '') + '\
          ' + (config.showBranding ? '<p class="branding">TALIA Accessibility</p>' : '') + '\
        </div>\
      </section>\
      <button class="toggle" data-toggle type="button" aria-label="' + escapeHtml(copy.open) + '" aria-expanded="false" aria-controls="talia-a11y-panel">\
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">\
          <circle cx="12" cy="7.5" r="1.2" fill="currentColor" stroke="none"></circle><path d="M7.5 10.5h9"></path><path d="M12 10.5v4"></path><path d="m9 19 3-4.5 3 4.5"></path>\
        </svg>\
      </button>';
  }

  function createOverlayElements(host, config) {
    var highlightColor = config.highlightColor || '#fffb00';
    var focusTop = createOverlayNode();
    var focusBand = createOverlayNode();
    var focusBottom = createOverlayNode();
    var readingLine = createOverlayNode();
    var contentHighlight = createOverlayNode();

    focusTop.setAttribute('data-focus-top', '');
    focusBand.setAttribute('data-focus-band', '');
    focusBottom.setAttribute('data-focus-bottom', '');
    readingLine.setAttribute('data-reading-line', '');
    contentHighlight.setAttribute('data-content-highlight', '');

    setImportant(focusTop, 'background', 'rgba(10,14,22,.46)');
    setImportant(focusTop, 'backdrop-filter', 'saturate(.75)');
    setImportant(focusTop, '-webkit-backdrop-filter', 'saturate(.75)');
    setImportant(focusTop, 'width', '100vw');

    setImportant(focusBand, 'width', '100vw');
    setImportant(focusBand, 'border-top', '2px solid rgba(255,255,255,.74)');
    setImportant(focusBand, 'border-bottom', '2px solid rgba(255,255,255,.74)');
    setImportant(focusBand, 'box-shadow', 'inset 0 1px 0 rgba(17,24,39,.28), inset 0 -1px 0 rgba(17,24,39,.28)');

    setImportant(focusBottom, 'background', 'rgba(10,14,22,.46)');
    setImportant(focusBottom, 'backdrop-filter', 'saturate(.75)');
    setImportant(focusBottom, '-webkit-backdrop-filter', 'saturate(.75)');
    setImportant(focusBottom, 'width', '100vw');

    setImportant(readingLine, 'width', '100vw');
    setImportant(readingLine, 'min-width', '100vw');
    setImportant(readingLine, 'right', 'auto');
    setImportant(readingLine, 'height', '6px');
    setImportant(readingLine, 'background', highlightColor);
    setImportant(readingLine, 'border', '1px solid rgba(17,24,39,.9)');
    setImportant(readingLine, 'border-radius', '999px');
    setImportant(readingLine, 'box-shadow', '0 0 0 2px rgba(255,255,255,.85), 0 3px 14px rgba(0,0,0,.34)');
    setImportant(readingLine, 'transform', 'translate3d(0,50vh,0) translateY(-50%)');
    setImportant(readingLine, 'will-change', 'transform');

    setImportant(contentHighlight, 'width', '0');
    setImportant(contentHighlight, 'height', '0');
    setImportant(contentHighlight, 'border', '3px solid ' + highlightColor);
    setImportant(contentHighlight, 'border-radius', '10px');
    setImportant(contentHighlight, 'background', hexToRgba(highlightColor, 0.12));
    setImportant(contentHighlight, 'box-shadow', '0 0 0 2px rgba(17,24,39,.74), 0 10px 32px rgba(0,0,0,.18)');
    setImportant(contentHighlight, 'will-change', 'transform, width, height');

    host.appendChild(focusTop);
    host.appendChild(focusBand);
    host.appendChild(focusBottom);
    host.appendChild(readingLine);
    host.appendChild(contentHighlight);

    return {
      focusTop: focusTop,
      focusBand: focusBand,
      focusBottom: focusBottom,
      readingLine: readingLine,
      contentHighlight: contentHighlight,
    };
  }

  function createOverlayNode() {
    var node = document.createElement('div');
    setImportant(node, 'position', 'fixed');
    setImportant(node, 'display', 'none');
    setImportant(node, 'left', '0');
    setImportant(node, 'top', '0');
    setImportant(node, 'z-index', '2147483647');
    setImportant(node, 'pointer-events', 'none');
    setImportant(node, 'transition', 'opacity 120ms ease');
    setImportant(node, 'max-width', 'none');
    setImportant(node, 'max-height', 'none');
    setImportant(node, 'margin', '0');
    setImportant(node, 'padding', '0');
    setImportant(node, 'box-sizing', 'border-box');
    setImportant(node, 'visibility', 'visible');
    setImportant(node, 'opacity', '1');
    setImportant(node, 'float', 'none');
    setImportant(node, 'clear', 'none');
    setImportant(node, 'clip-path', 'none');
    return node;
  }

  function setImportant(element, property, value) {
    element.style.setProperty(property, value, 'important');
  }

  function getViewportWidth() {
    return Math.max(
      document.documentElement ? document.documentElement.clientWidth : 0,
      window.innerWidth || 0
    );
  }

  function getViewportHeight() {
    return Math.max(
      document.documentElement ? document.documentElement.clientHeight : 0,
      window.innerHeight || 0
    );
  }

  function controlTemplate(enabled, key, label, path) {
    if (!enabled) return '';
    return '\
      <button class="control" data-control="' + key + '" type="button" aria-pressed="false">\
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="' + path + '"></path></svg>\
        <span>' + escapeHtml(label) + '</span>\
      </button>';
  }

  function extractClearViewContent(copy) {
    var scope = document.querySelector('main') || document.body;
    var title = getText(document.querySelector('h1')) || document.title || copy.clearViewTitle;
    var paragraphs = uniqueText(Array.prototype.slice.call(scope.querySelectorAll('p, li, dd, .show-desc, .show-extra, .info-value, .faq-body-inner'))
      .filter(isUsableContentElement)
      .map(getText)
      .filter(function (text) { return text.length >= 18; }))
      .slice(0, 8);
    var actions = extractClearViewActions(scope).slice(0, 6);
    var sections = extractClearViewSections(scope, paragraphs);

    return {
      title: title,
      summary: paragraphs.slice(0, 2),
      actions: actions,
      sections: sections,
    };
  }

  function extractClearViewActions(scope) {
    var candidates = Array.prototype.slice.call(scope.querySelectorAll('a[href]'))
      .filter(isUsableContentElement)
      .map(function (link) {
        return {
          label: getText(link),
          href: getSafeHref(link.getAttribute('href')),
        };
      })
      .filter(function (action) {
        return action.label && action.href && action.label.length <= 80;
      });

    return uniqueActions(candidates);
  }

  function extractClearViewSections(scope, fallbackParagraphs) {
    var headings = Array.prototype.slice.call(scope.querySelectorAll('h2, h3'))
      .filter(isUsableContentElement)
      .slice(0, 6);
    var sections = headings.map(function (heading) {
      return {
        type: 'other',
        title: getText(heading),
        items: collectSectionItems(heading),
      };
    }).filter(function (section) {
      return section.title && section.items.length > 0;
    });

    if (sections.length > 0) return sections.slice(0, 5);

    return fallbackParagraphs.length > 0
      ? [{ type: 'other', title: copy.usefulInfo, items: fallbackParagraphs.slice(0, 5) }]
      : [];
  }

  function collectSectionItems(heading) {
    var items = [];
    var node = heading.parentElement;
    var container = node && node.matches('article, section, .show-info, .info-panel, .faq-item')
      ? node
      : heading.parentElement;
    var candidates = container
      ? Array.prototype.slice.call(container.querySelectorAll('p, li, dd, .show-date, .show-desc, .show-extra, .info-value, .faq-body-inner'))
      : [];

    candidates.forEach(function (candidate) {
      var text = getText(candidate);
      if (text.length >= 12 && items.indexOf(text) === -1) items.push(text);
    });

    if (items.length === 0) {
      var sibling = heading.nextElementSibling;
      while (sibling && items.length < 4 && !sibling.matches('h2, h3')) {
        if (isUsableContentElement(sibling)) {
          var siblingText = getText(sibling);
          if (siblingText.length >= 12 && items.indexOf(siblingText) === -1) items.push(siblingText);
        }
        sibling = sibling.nextElementSibling;
      }
    }

    return items.slice(0, 4);
  }

  function renderClearViewContent(content, copy, source) {
    if (!content.summary.length && !content.sections.length && !content.actions.length) {
      return '<p class="clear-summary">' + escapeHtml(copy.noClearContent) + '</p>';
    }

    return '\
      <p class="clear-meta">' + escapeHtml(getClearViewSourceLabel(source, copy)) + '</p>\
      <div>\
        <h3 class="clear-title">' + escapeHtml(content.title || copy.clearViewTitle) + '</h3>\
        ' + content.summary.map(function (item) {
          return '<p class="clear-summary">' + escapeHtml(item) + '</p>';
        }).join('') + '\
      </div>\
      ' + renderActions(content.actions, copy) + '\
      ' + sortClearViewSections(content.sections).map(function (section) {
        var type = getSectionType(section);
        return '\
          <section class="clear-section">\
            <div class="clear-section-heading"><h3>' + escapeHtml(section.title) + '</h3><span class="clear-tag">' + escapeHtml(getSectionTypeLabel(type, copy)) + '</span></div>\
            <ul>' + section.items.map(function (item) {
              return '<li>' + escapeHtml(item) + '</li>';
            }).join('') + '</ul>\
          </section>';
      }).join('');
  }

  function renderAiClearView(content, copy, config, container, refresh) {
    container.setAttribute('aria-busy', 'true');
    container.innerHTML = '<p class="clear-summary">' + escapeHtml(copy.clearViewLoading) + '</p>';
    var cached = readClearViewCache(config.tenantId, config.language);
    if (cached && !refresh) {
      container.innerHTML = renderClearViewContent(cached.clearView || cached, copy, cached.source || 'cached');
      container.setAttribute('aria-busy', 'false');
      return;
    }

    fetch(baseUrl + '/api/accessibility/clear-view', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tenantId: config.tenantId,
        url: window.location.href.split('#')[0],
        language: config.language,
        page: content,
      }),
    })
      .then(function (response) {
        if (!response.ok) throw new Error('Clear view unavailable');
        return response.json();
      })
      .then(function (data) {
        var clearView = data && data.clearView && typeof data.clearView === 'object'
          ? data.clearView
          : content;
        var source = data && data.source === 'ai' ? 'ai' : 'local';
        saveClearViewCache(config.tenantId, config.language, { clearView: clearView, source: source });
        container.innerHTML = renderClearViewContent(clearView, copy, source);
        container.setAttribute('aria-busy', 'false');
      })
      .catch(function () {
        container.innerHTML = renderClearViewContent(content, copy, 'local');
        container.setAttribute('aria-busy', 'false');
      });
  }

  function getClearViewSourceLabel(source, copy) {
    if (source === 'ai') return copy.clearViewSourceAi;
    if (source === 'cached') return copy.clearViewSourceCached;
    return copy.clearViewSourceLocal;
  }

  function renderActions(actions, copy) {
    if (!actions.length) return '';

    return '\
      <section class="clear-section">\
        <h3>' + escapeHtml(copy.mainActions) + '</h3>\
        <div class="clear-actions">' + actions.map(function (action) {
          return '<a class="clear-action" href="' + escapeAttribute(action.href) + '">' + escapeHtml(action.label) + '</a>';
        }).join('') + '</div>\
      </section>';
  }

  function sortClearViewSections(sections) {
    return sections.slice().sort(function (a, b) {
      return getSectionTypeRank(getSectionType(a)) - getSectionTypeRank(getSectionType(b));
    });
  }

  function getSectionType(section) {
    var type = section && typeof section.type === 'string' ? section.type : 'other';
    return getSectionTypeRank(type) >= 0 ? type : 'other';
  }

  function getSectionTypeRank(type) {
    var ranks = {
      important: 0,
      steps: 1,
      dates: 2,
      pricing: 3,
      location: 4,
      accessibility: 5,
      contact: 6,
      other: 7,
    };
    return typeof ranks[type] === 'number' ? ranks[type] : 7;
  }

  function getSectionTypeLabel(type, copy) {
    return copy.sectionTypes[type] || copy.sectionTypes.other;
  }

  function isUsableContentElement(element) {
    if (!element || !element.isConnected) return false;
    if (element.closest('#talia-accessibility-root, #talia-widget-root, script, style, noscript, template, svg')) return false;
    var rect = element.getBoundingClientRect();
    var style = window.getComputedStyle(element);
    return rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden' && style.display !== 'none';
  }

  function getText(element) {
    return normalizeText(element ? element.textContent : '');
  }

  function normalizeText(value) {
    return String(value || '').replace(/\s+/g, ' ').trim();
  }

  function collectSpeechChunks() {
    var scope = document.querySelector('main') || document.body;
    if (!scope) return [];

    var selector = 'h1, h2, h3, h4, h5, h6, p, li, dd, dt, blockquote, figcaption';
    var chunks = [];
    var seen = {};

    Array.prototype.forEach.call(scope.querySelectorAll(selector), function (node) {
      if (!isUsableContentElement(node)) return;
      // Only read leaf text blocks so a container is not spoken together with its children.
      if (node.querySelector(selector)) return;
      var text = getText(node);
      if (text.length < 2) return;
      var key = text.toLowerCase();
      if (seen[key]) return;
      seen[key] = true;
      chunks.push(text);
    });

    if (!chunks.length && document.title) chunks.push(normalizeText(document.title));
    return chunks.slice(0, 300);
  }

  function getSpeechLang(language) {
    if (language === 'ca') return 'ca-ES';
    if (language === 'en') return 'en-US';
    return 'es-ES';
  }

  function pickSpeechVoice(lang) {
    if (!('speechSynthesis' in window)) return null;
    var voices = window.speechSynthesis.getVoices() || [];
    var base = lang.slice(0, 2).toLowerCase();
    var exact = null;
    var partial = null;

    voices.forEach(function (voice) {
      var voiceLang = String(voice.lang || '').toLowerCase();
      if (voiceLang === lang.toLowerCase() && !exact) exact = voice;
      else if (voiceLang.slice(0, 2) === base && !partial) partial = voice;
    });

    return exact || partial || null;
  }

  function uniqueText(items) {
    var seen = {};
    return items.filter(function (item) {
      var key = item.toLowerCase();
      if (seen[key]) return false;
      seen[key] = true;
      return true;
    });
  }

  function uniqueActions(actions) {
    var seen = {};
    return actions.filter(function (action) {
      var key = action.href + '|' + action.label.toLowerCase();
      if (seen[key]) return false;
      seen[key] = true;
      return true;
    });
  }

  function getSafeHref(value) {
    try {
      var url = new URL(value || '', window.location.href);
      if (url.protocol === 'http:' || url.protocol === 'https:' || url.protocol === 'mailto:' || url.protocol === 'tel:') {
        return url.href;
      }
    } catch {
      return '';
    }

    return '';
  }

  function getClearViewCacheKey(tenantId, language) {
    return 'talia-a11y-clear-view-' + tenantId + '-' + language + '-' + window.location.href.split('#')[0];
  }

  function readClearViewCache(tenantId, language) {
    try {
      var stored = sessionStorage.getItem(getClearViewCacheKey(tenantId, language));
      if (!stored) return null;
      var parsed = JSON.parse(stored);
      return parsed && typeof parsed === 'object' ? parsed : null;
    } catch {
      return null;
    }
  }

  function saveClearViewCache(tenantId, language, value) {
    try {
      sessionStorage.setItem(getClearViewCacheKey(tenantId, language), JSON.stringify(value));
    } catch {
      // Session storage can be unavailable in locked-down embeds.
    }
  }

  function clearClearViewCache(tenantId, language) {
    try {
      sessionStorage.removeItem(getClearViewCacheKey(tenantId, language));
    } catch {
      // Session storage can be unavailable in locked-down embeds.
    }
  }

  function getCopy(language) {
    var copies = {
      es: {
        title: 'Accesibilidad',
        description: 'Ajusta la lectura y visualización de esta web.',
        open: 'Abrir ajustes de accesibilidad',
        close: 'Cerrar ajustes de accesibilidad',
        tabsLabel: 'Secciones de accesibilidad',
        controlsTab: 'Ajustes',
        aiTab: 'IA',
        increaseText: 'Aumentar texto',
        decreaseText: 'Reducir texto',
        contrast: 'Alto contraste',
        grayscale: 'Escala de grises',
        highlightLinks: 'Resaltar enlaces',
        pauseAnimations: 'Pausar animaciones',
        lineSpacing: 'Más espaciado',
        readableFont: 'Fuente legible',
        lowStimulation: 'Baja estimulación',
        readingMask: 'Máscara de lectura',
        readingLine: 'Línea de lectura',
        highlightContent: 'Resaltar contenido',
        readAloud: 'Leer en voz alta',
        dyslexiaFont: 'Fuente para dislexia',
        profilesLabel: 'Perfiles rápidos',
        profileDyslexia: 'Dislexia',
        profileAdhd: 'Concentración',
        profileLowVision: 'Baja visión',
        profileCalm: 'Bajo estímulo',
        reset: 'Restablecer',
        clearView: 'Vista clara',
        clearViewDescription: 'Resume esta página en una lectura simple y ordenada.',
        clearViewLoading: 'Preparando una vista clara de esta página...',
        clearViewTitle: 'Información clara',
        backToControls: 'Volver a IA',
        refreshClearView: 'Actualizar vista',
        clearViewSourceAi: 'Generada con IA',
        clearViewSourceLocal: 'Vista local',
        clearViewSourceCached: 'Vista guardada',
        mainActions: 'Acciones principales',
        usefulInfo: 'Información útil',
        noClearContent: 'No he encontrado contenido suficiente para crear una vista clara.',
        sectionTypes: {
          important: 'Clave',
          steps: 'Pasos',
          dates: 'Fechas',
          location: 'Lugar',
          pricing: 'Precio',
          accessibility: 'Accesible',
          contact: 'Contacto',
          other: 'Info',
        },
        textLevel: function (value) { return value === 0 ? 'Texto normal' : 'Texto ' + ['', '125%', '150%', '175%', '200%'][value]; },
      },
      ca: {
        title: 'Accessibilitat',
        description: "Ajusta la lectura i visualització d'aquest web.",
        open: "Obre els ajustos d'accessibilitat",
        close: "Tanca els ajustos d'accessibilitat",
        tabsLabel: "Seccions d'accessibilitat",
        controlsTab: 'Ajustos',
        aiTab: 'IA',
        increaseText: 'Augmenta el text',
        decreaseText: 'Redueix el text',
        contrast: 'Alt contrast',
        grayscale: 'Escala de grisos',
        highlightLinks: 'Ressalta enllaços',
        pauseAnimations: 'Pausa animacions',
        lineSpacing: 'Més espaiat',
        readableFont: 'Font llegible',
        lowStimulation: 'Baixa estimulació',
        readingMask: 'Màscara de lectura',
        readingLine: 'Línia de lectura',
        highlightContent: 'Ressalta contingut',
        readAloud: 'Llegir en veu alta',
        dyslexiaFont: 'Font per a dislèxia',
        profilesLabel: 'Perfils ràpids',
        profileDyslexia: 'Dislèxia',
        profileAdhd: 'Concentració',
        profileLowVision: 'Baixa visió',
        profileCalm: 'Baix estímul',
        reset: 'Restableix',
        clearView: 'Vista clara',
        clearViewDescription: 'Resumeix aquesta pàgina en una lectura simple i ordenada.',
        clearViewLoading: 'Preparant una vista clara d’aquesta pàgina...',
        clearViewTitle: 'Informació clara',
        backToControls: 'Torna a IA',
        refreshClearView: 'Actualitza vista',
        clearViewSourceAi: 'Generada amb IA',
        clearViewSourceLocal: 'Vista local',
        clearViewSourceCached: 'Vista desada',
        mainActions: 'Accions principals',
        usefulInfo: 'Informació útil',
        noClearContent: 'No he trobat prou contingut per crear una vista clara.',
        sectionTypes: {
          important: 'Clau',
          steps: 'Passos',
          dates: 'Dates',
          location: 'Lloc',
          pricing: 'Preu',
          accessibility: 'Accessible',
          contact: 'Contacte',
          other: 'Info',
        },
        textLevel: function (value) { return value === 0 ? 'Text normal' : 'Text ' + ['', '125%', '150%', '175%', '200%'][value]; },
      },
      en: {
        title: 'Accessibility',
        description: 'Adjust reading and visual display for this website.',
        open: 'Open accessibility settings',
        close: 'Close accessibility settings',
        tabsLabel: 'Accessibility sections',
        controlsTab: 'Settings',
        aiTab: 'AI',
        increaseText: 'Increase text',
        decreaseText: 'Decrease text',
        contrast: 'High contrast',
        grayscale: 'Grayscale',
        highlightLinks: 'Highlight links',
        pauseAnimations: 'Pause animations',
        lineSpacing: 'More spacing',
        readableFont: 'Readable font',
        lowStimulation: 'Low stimulation',
        readingMask: 'Reading mask',
        readingLine: 'Reading line',
        highlightContent: 'Highlight content',
        readAloud: 'Read aloud',
        dyslexiaFont: 'Dyslexia font',
        profilesLabel: 'Quick profiles',
        profileDyslexia: 'Dyslexia',
        profileAdhd: 'Focus',
        profileLowVision: 'Low vision',
        profileCalm: 'Low stimulation',
        reset: 'Reset',
        clearView: 'Clear view',
        clearViewDescription: 'Summarize this page into a simple, ordered reading view.',
        clearViewLoading: 'Preparing a clear view of this page...',
        clearViewTitle: 'Clear information',
        backToControls: 'Back to AI',
        refreshClearView: 'Refresh view',
        clearViewSourceAi: 'Generated with AI',
        clearViewSourceLocal: 'Local view',
        clearViewSourceCached: 'Saved view',
        mainActions: 'Main actions',
        usefulInfo: 'Useful information',
        noClearContent: 'I could not find enough content to create a clear view.',
        sectionTypes: {
          important: 'Key',
          steps: 'Steps',
          dates: 'Dates',
          location: 'Place',
          pricing: 'Price',
          accessibility: 'Access',
          contact: 'Contact',
          other: 'Info',
        },
        textLevel: function (value) { return value === 0 ? 'Normal text' : 'Text ' + ['', '125%', '150%', '175%', '200%'][value]; },
      },
    };

    return copies[language] || copies.es;
  }

  function getLanguage(value) {
    var candidate = value === 'auto'
      ? detectDocumentLanguage()
      : String(value || '').slice(0, 2).toLowerCase();

    return candidate === 'ca' || candidate === 'en' || candidate === 'es' ? candidate : 'es';
  }

  function detectDocumentLanguage() {
    var candidates = [
      document.documentElement.getAttribute('lang'),
      getMetaContent('property', 'og:locale'),
      getMetaContent('name', 'twitter:locale'),
      getMetaContent('http-equiv', 'Content-Language'),
      navigator.language,
    ];

    for (var index = 0; index < candidates.length; index += 1) {
      var normalized = normalizeLanguage(candidates[index]);
      if (normalized) return normalized;
    }

    return 'es';
  }

  function getMetaContent(attribute, value) {
    var element = document.querySelector('meta[' + attribute + '="' + value + '"]');
    return element ? element.getAttribute('content') : '';
  }

  function normalizeLanguage(value) {
    var candidate = String(value || '').trim().replace('_', '-').slice(0, 2).toLowerCase();
    return candidate === 'ca' || candidate === 'en' || candidate === 'es' ? candidate : '';
  }

  function getAccessibilityTogglePositionCss(position) {
    if (position === 'bottom-left') return 'left: var(--talia-floating-inline-offset, 20px); bottom: var(--talia-floating-toggle-offset, 20px);';
    if (position === 'top-right') return 'right: var(--talia-floating-inline-offset, 20px); top: var(--talia-floating-toggle-offset, 20px);';
    if (position === 'top-left') return 'left: var(--talia-floating-inline-offset, 20px); top: var(--talia-floating-toggle-offset, 20px);';
    return 'right: var(--talia-floating-inline-offset, 20px); bottom: var(--talia-floating-toggle-offset, 20px);';
  }

  function getAccessibilityPanelPositionCss(position) {
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

  function getDefaultState() {
    return {
      textScale: 0,
      contrast: false,
      grayscale: false,
      highlightLinks: false,
      pauseAnimations: false,
      lineSpacing: false,
      readableFont: false,
      dyslexiaFont: false,
      lowStimulation: false,
      readingMask: false,
      readingLine: false,
      highlightContent: false,
    };
  }

  function readState(tenantId) {
    try {
      var stored = localStorage.getItem('talia-a11y-' + tenantId);
      if (!stored) return getDefaultState();
      var parsed = JSON.parse(stored);
      var state = getDefaultState();
      state.textScale = parsed.textScale >= 1 && parsed.textScale <= 4 ? Math.round(parsed.textScale) : 0;
      state.contrast = parsed.contrast === true;
      state.grayscale = parsed.grayscale === true;
      state.highlightLinks = parsed.highlightLinks === true;
      state.pauseAnimations = parsed.pauseAnimations === true;
      state.lineSpacing = parsed.lineSpacing === true;
      state.readableFont = parsed.readableFont === true;
      state.dyslexiaFont = parsed.dyslexiaFont === true;
      state.lowStimulation = parsed.lowStimulation === true;
      state.readingMask = parsed.readingMask === true || parsed.focusReading === true;
      state.readingLine = parsed.readingLine === true;
      state.highlightContent = parsed.highlightContent === true;
      return state;
    } catch {
      return getDefaultState();
    }
  }

  function saveState(tenantId, state) {
    try {
      localStorage.setItem('talia-a11y-' + tenantId, JSON.stringify(state));
    } catch {
      // Storage can be unavailable in private browsing or locked-down embeds.
    }
  }

  function readString(value) {
    return typeof value === 'string' && value.trim() ? value.trim() : '';
  }

  function sanitizeColor(value, fallback) {
    var color = readString(value);
    return /^#[0-9a-fA-F]{6}$/.test(color) ? color : fallback || '#00e0c7';
  }

  function hexToRgba(hex, alpha) {
    var color = sanitizeColor(hex, '#fffb00').slice(1);
    var red = parseInt(color.slice(0, 2), 16);
    var green = parseInt(color.slice(2, 4), 16);
    var blue = parseInt(color.slice(4, 6), 16);
    return 'rgba(' + red + ',' + green + ',' + blue + ',' + alpha + ')';
  }

  function getReadableTextColor(background) {
    var blackContrast = getContrastRatio('#111827', background);
    var whiteContrast = getContrastRatio('#ffffff', background);
    return blackContrast >= whiteContrast ? '#111827' : '#ffffff';
  }

  function getAccessibleBorderColor(color) {
    return getContrastRatio(color, '#ffffff') >= 3 ? color : '#111827';
  }

  function getContrastRatio(first, second) {
    var firstLum = getRelativeLuminance(first);
    var secondLum = getRelativeLuminance(second);
    var lighter = Math.max(firstLum, secondLum);
    var darker = Math.min(firstLum, secondLum);
    return (lighter + 0.05) / (darker + 0.05);
  }

  function getRelativeLuminance(hex) {
    var color = sanitizeColor(hex, '#000000').slice(1);
    var channels = [
      parseInt(color.slice(0, 2), 16),
      parseInt(color.slice(2, 4), 16),
      parseInt(color.slice(4, 6), 16),
    ].map(function (channel) {
      var value = channel / 255;
      return value <= 0.03928
        ? value / 12.92
        : Math.pow((value + 0.055) / 1.055, 2.4);
    });

    return (0.2126 * channels[0]) + (0.7152 * channels[1]) + (0.0722 * channels[2]);
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, function (char) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char];
    });
  }

  function escapeAttribute(value) {
    return escapeHtml(value).replace(/`/g, '&#96;');
  }
})();
