(function () {
  var script = document.currentScript;
  if (!script) return;

  var tenantId = script.getAttribute('data-tenant') || 'demo';
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
    var controls = remote.controls && typeof remote.controls === 'object' ? remote.controls : {};

    return {
      tenantId: tenantId,
      language: language,
      primaryColor: primaryColor,
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
        focusReading: controls.focusReading !== false,
      },
    };
  }

  function mountWidget(config) {
    if (document.getElementById('talia-accessibility-root')) return;

    injectGlobalStyles();

    var host = document.createElement('div');
    host.id = 'talia-accessibility-root';
    document.body.appendChild(host);

    var root = host.attachShadow({ mode: 'open' });
    var copy = getCopy(config.language);
    var state = readState(config.tenantId);

    root.innerHTML = getTemplate(copy, config);

    var panel = root.querySelector('[data-panel]');
    var toggle = root.querySelector('[data-toggle]');
    var close = root.querySelector('[data-close]');
    var reset = root.querySelector('[data-reset]');
    var increase = root.querySelector('[data-text-increase]');
    var decrease = root.querySelector('[data-text-decrease]');
    var clearViewButton = root.querySelector('[data-clear-view]');
    var controlsView = root.querySelector('[data-controls-view]');
    var clearView = root.querySelector('[data-clear-view-panel]');
    var clearViewContent = root.querySelector('[data-clear-view-content]');
    var clearViewBack = root.querySelector('[data-clear-view-back]');
    var clearViewRefresh = root.querySelector('[data-clear-view-refresh]');
    var controlButtons = Array.prototype.slice.call(root.querySelectorAll('[data-control]'));
    var focusTop = root.querySelector('[data-focus-top]');
    var focusBand = root.querySelector('[data-focus-band]');
    var focusBottom = root.querySelector('[data-focus-bottom]');
    var lastFocusY = Math.round(window.innerHeight / 2);

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
      state = getDefaultState();
      saveState(config.tenantId, state);
      applyState(state);
      renderState();
    });

    if (increase) {
      increase.addEventListener('click', function () {
        state.textScale = Math.min(2, state.textScale + 1);
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
      if (!state.focusReading) return;
      if (event.target && event.target.closest && event.target.closest('#talia-accessibility-root, #talia-widget-root')) return;
      lastFocusY = event.clientY;
      renderFocusReading();
    }, { passive: true });

    document.addEventListener('focusin', function (event) {
      if (!state.focusReading || !event.target || !event.target.getBoundingClientRect) return;
      if (event.target.closest && event.target.closest('#talia-accessibility-root, #talia-widget-root')) return;
      var rect = event.target.getBoundingClientRect();
      if (rect.height > 0) {
        lastFocusY = Math.round(rect.top + (rect.height / 2));
        renderFocusReading();
      }
    });

    window.addEventListener('scroll', renderFocusReading, { passive: true });
    window.addEventListener('resize', renderFocusReading, { passive: true });

    if (clearViewButton && clearView && clearViewContent && clearViewBack && clearViewRefresh) {
      clearViewButton.addEventListener('click', function () {
        var content = extractClearViewContent(copy);
        controlsView.hidden = true;
        clearView.hidden = false;
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
        controlsView.hidden = false;
        clearViewButton.focus();
      });
    }

    root.addEventListener('keydown', function (event) {
      if (event.key === 'Escape' && panel.classList.contains('panel--open')) {
        closePanel();
        toggle.focus();
      }
    });

    function openPanel() {
      panel.classList.add('panel--open');
      toggle.setAttribute('aria-expanded', 'true');
      setTimeout(function () {
        var firstControl = root.querySelector('[data-clear-view]') || root.querySelector('[data-text-increase]') || root.querySelector('[data-control]') || reset;
        if (firstControl) firstControl.focus();
      }, 50);
    }

    function closePanel() {
      panel.classList.remove('panel--open');
      toggle.setAttribute('aria-expanded', 'false');
    }

    function renderState() {
      if (increase) {
        increase.disabled = state.textScale >= 2;
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
      renderFocusReading();
    }

    function renderFocusReading() {
      if (!focusTop || !focusBand || !focusBottom) return;

      var enabled = Boolean(state.focusReading);
      focusTop.hidden = !enabled;
      focusBand.hidden = !enabled;
      focusBottom.hidden = !enabled;
      if (!enabled) return;

      var bandHeight = Math.max(96, Math.min(140, Math.round(window.innerHeight * 0.16)));
      var halfBand = Math.round(bandHeight / 2);
      var safeY = Math.max(halfBand, Math.min(window.innerHeight - halfBand, lastFocusY));
      var topHeight = Math.max(0, safeY - halfBand);
      var bottomTop = Math.min(window.innerHeight, safeY + halfBand);

      focusTop.style.height = topHeight + 'px';
      focusBand.style.top = topHeight + 'px';
      focusBand.style.height = bandHeight + 'px';
      focusBottom.style.top = bottomTop + 'px';
      focusBottom.style.height = Math.max(0, window.innerHeight - bottomTop) + 'px';
    }
  }

  function injectGlobalStyles() {
    if (document.getElementById('talia-accessibility-styles')) return;

    var style = document.createElement('style');
    style.id = 'talia-accessibility-styles';
    style.textContent = '\
      html.talia-a11y-text-lg body :where(p, li, a, button, input, textarea, select, label, span, dd, dt, figcaption, blockquote) { font-size: 112.5% !important; }\
      html.talia-a11y-text-xl body :where(p, li, a, button, input, textarea, select, label, span, dd, dt, figcaption, blockquote) { font-size: 125% !important; }\
      html.talia-a11y-contrast body { background: #000 !important; color: #fff !important; }\
      html.talia-a11y-contrast body :where(main, section, article, aside, header, footer, nav, div, p, li, h1, h2, h3, h4, h5, h6, label, span) { background-color: #000 !important; color: #fff !important; border-color: #fff !important; }\
      html.talia-a11y-contrast body :where(a, button) { color: #ffff00 !important; }\
      html.talia-a11y-grayscale body > :not(#talia-accessibility-root):not(#talia-widget-root) { filter: grayscale(1) !important; }\
      html.talia-a11y-highlight-links body a { text-decoration: underline !important; text-decoration-thickness: max(2px, .12em) !important; text-underline-offset: .18em !important; outline: 2px solid currentColor !important; outline-offset: 2px !important; }\
      html.talia-a11y-pause-animations *, html.talia-a11y-pause-animations *::before, html.talia-a11y-pause-animations *::after { animation-duration: .001ms !important; animation-iteration-count: 1 !important; scroll-behavior: auto !important; transition-duration: .001ms !important; }\
      html.talia-a11y-line-spacing body :where(p, li, blockquote, dd, dt) { line-height: 1.75 !important; letter-spacing: .02em !important; margin-bottom: 1em !important; }\
      html.talia-a11y-readable-font body :where(p, li, a, button, input, textarea, select, label, span, dd, dt, h1, h2, h3, h4, h5, h6, blockquote) { font-family: Arial, Helvetica, system-ui, sans-serif !important; }\
      html.talia-a11y-focus-reading body :where(p, li, dd, dt, blockquote):not(#talia-accessibility-root *):not(#talia-widget-root *) { line-height: 1.68 !important; }\
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
      'talia-a11y-text-lg',
      'talia-a11y-text-xl',
      'talia-a11y-contrast',
      'talia-a11y-grayscale',
      'talia-a11y-highlight-links',
      'talia-a11y-pause-animations',
      'talia-a11y-line-spacing',
      'talia-a11y-readable-font',
      'talia-a11y-low-stimulation',
      'talia-a11y-focus-reading',
    ];

    classes.forEach(function (className) {
      root.classList.remove(className);
    });

    if (state.textScale === 1) root.classList.add('talia-a11y-text-lg');
    if (state.textScale === 2) root.classList.add('talia-a11y-text-xl');
    if (state.contrast) root.classList.add('talia-a11y-contrast');
    if (state.grayscale) root.classList.add('talia-a11y-grayscale');
    if (state.highlightLinks) root.classList.add('talia-a11y-highlight-links');
    if (state.pauseAnimations) root.classList.add('talia-a11y-pause-animations');
    if (state.lineSpacing) root.classList.add('talia-a11y-line-spacing');
    if (state.readableFont) root.classList.add('talia-a11y-readable-font');
    if (state.lowStimulation) root.classList.add('talia-a11y-low-stimulation');
    if (state.focusReading) root.classList.add('talia-a11y-focus-reading');
  }

  function getTemplate(copy, config) {
    var controls = config.controls;
    var togglePosition = getAccessibilityTogglePositionCss(config.position);
    var panelPosition = getAccessibilityPanelPositionCss(config.position);
    var transformOrigin = config.position.indexOf('left') >= 0
      ? (config.position.indexOf('top') >= 0 ? 'top left' : 'bottom left')
      : (config.position.indexOf('top') >= 0 ? 'top right' : 'bottom right');

    return '\
      <style>\
        :host { all: initial; color-scheme: light; font-family: Arial, Helvetica, system-ui, sans-serif; }\
        *, *::before, *::after { box-sizing: border-box; }\
        .toggle { position: fixed; ' + togglePosition + ' z-index: 2147483647; width: 52px; height: 52px; border: 0; border-radius: 999px; background: ' + config.primaryColor + '; color: #fff; cursor: pointer; display: grid; place-items: center; box-shadow: 0 6px 20px rgba(0,0,0,.22); transition: transform 150ms ease, box-shadow 150ms ease; }\
        .toggle:hover { transform: scale(1.06); box-shadow: 0 8px 24px rgba(0,0,0,.26); }\
        .toggle:active { transform: scale(.96); }\
        .toggle:focus-visible, button:focus-visible { outline: 3px solid #111827; outline-offset: 3px; }\
        .toggle svg { width: 32px; height: 32px; display: block; }\
        .panel { position: fixed; ' + panelPosition + ' z-index: 2147483647; width: min(360px, calc(100vw - 40px)); max-height: min(620px, calc(100vh - 180px)); overflow: auto; border: 1px solid #d5d7db; border-radius: 8px; background: #fff; color: #111827; box-shadow: 0 18px 48px rgba(17,24,39,.22); opacity: 0; transform: translateY(10px) scale(.98); transform-origin: ' + transformOrigin + '; pointer-events: none; transition: opacity 180ms ease, transform 180ms ease; }\
        .panel--open { opacity: 1; transform: translateY(0) scale(1); pointer-events: auto; }\
        .header { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; padding: 16px; border-bottom: 1px solid #e5e7eb; }\
        .title { margin: 0 0 4px; font: 700 18px/1.2 Arial, Helvetica, system-ui, sans-serif; color: #111827; }\
        .description { margin: 0; font: 400 13px/1.45 Arial, Helvetica, system-ui, sans-serif; color: #4b5563; }\
        .close { width: 36px; height: 36px; flex: 0 0 auto; border: 1px solid #d1d5db; border-radius: 8px; background: #fff; color: #111827; font: 24px/1 Arial, Helvetica, system-ui, sans-serif; cursor: pointer; }\
        .body { display: grid; gap: 14px; padding: 16px; }\
        [hidden] { display: none !important; }\
        .view { display: grid; gap: 14px; }\
        .clear-launch { width: 100%; border: 1px solid #111827; border-radius: 8px; background: #111827; color: #fff; cursor: pointer; display: grid; grid-template-columns: auto 1fr; gap: 10px; align-items: center; padding: 12px; text-align: left; }\
        .clear-launch svg { width: 22px; height: 22px; }\
        .clear-launch strong { display: block; font: 800 14px/1.2 Arial, Helvetica, system-ui, sans-serif; }\
        .clear-launch span { display: block; margin-top: 3px; color: rgba(255,255,255,.78); font: 500 12px/1.35 Arial, Helvetica, system-ui, sans-serif; }\
        .text-row { display: grid; grid-template-columns: 1fr auto auto; gap: 8px; align-items: center; }\
        .text-level { color: #374151; font: 600 13px/1.2 Arial, Helvetica, system-ui, sans-serif; }\
        .icon-button { width: 42px; height: 42px; border: 1px solid #c5c9d0; border-radius: 8px; background: #f9fafb; color: #111827; cursor: pointer; font: 700 20px/1 Arial, Helvetica, system-ui, sans-serif; }\
        .icon-button:disabled { opacity: .45; cursor: not-allowed; }\
        .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }\
        .control { min-height: 58px; border: 1px solid #c5c9d0; border-radius: 8px; background: #fff; color: #111827; cursor: pointer; display: grid; grid-template-columns: auto 1fr; gap: 8px; align-items: center; padding: 10px; text-align: left; font: 700 13px/1.2 Arial, Helvetica, system-ui, sans-serif; }\
        .control svg { width: 20px; height: 20px; }\
        .control--active { border-color: #111827; background: #111827; color: #fff; box-shadow: inset 0 0 0 2px #fff; }\
        .reset { width: 100%; border: 1px solid #111827; border-radius: 8px; background: #fff; color: #111827; padding: 12px; cursor: pointer; font: 700 14px/1 Arial, Helvetica, system-ui, sans-serif; }\
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
        .focus-mask, .focus-band { position: fixed; left: 0; right: 0; z-index: 2147483646; pointer-events: none; transition: top 90ms linear, height 90ms linear, opacity 120ms ease; }\
        .focus-mask { background: rgba(10,14,22,.46); backdrop-filter: saturate(.75); }\
        .focus-mask-top { top: 0; }\
        .focus-band { border-top: 2px solid rgba(255,255,255,.74); border-bottom: 2px solid rgba(255,255,255,.74); box-shadow: inset 0 1px 0 rgba(17,24,39,.28), inset 0 -1px 0 rgba(17,24,39,.28); }\
        .branding { margin: 0; color: #6b7280; text-align: center; font: 600 11px/1.2 Arial, Helvetica, system-ui, sans-serif; }\
        @media (max-width: 420px) { .panel { width: calc(100vw - 24px); max-height: calc(100vh - 168px); } .grid { grid-template-columns: 1fr; } }\
      </style>\
      <section class="panel" data-panel id="talia-a11y-panel" role="dialog" aria-labelledby="talia-a11y-title" aria-describedby="talia-a11y-description">\
        <div class="header">\
          <div><h2 class="title" id="talia-a11y-title">' + escapeHtml(copy.title) + '</h2><p class="description" id="talia-a11y-description">' + escapeHtml(copy.description) + '</p></div>\
          <button class="close" data-close aria-label="' + escapeHtml(copy.close) + '">×</button>\
        </div>\
        <div class="body">\
          <div class="view" data-controls-view>\
            ' + (config.clearViewEnabled ? '<button class="clear-launch" data-clear-view type="button">\
              <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 5h16"></path><path d="M4 12h10"></path><path d="M4 19h16"></path></svg>\
              <span><strong>' + escapeHtml(copy.clearView) + '</strong><span>' + escapeHtml(copy.clearViewDescription) + '</span></span>\
            </button>' : '') + '\
            ' + (controls.textSize ? '<div class="text-row"><span class="text-level" data-text-level></span><button class="icon-button" data-text-decrease type="button" aria-label="' + escapeHtml(copy.decreaseText) + '">A-</button><button class="icon-button" data-text-increase type="button" aria-label="' + escapeHtml(copy.increaseText) + '">A+</button></div>' : '') + '\
            <div class="grid">\
              ' + controlTemplate(controls.contrast, 'contrast', copy.contrast, 'M4 4h16v16H4z M8 8h8v8H8z') + '\
              ' + controlTemplate(controls.grayscale, 'grayscale', copy.grayscale, 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z M12 3v18') + '\
              ' + controlTemplate(controls.highlightLinks, 'highlightLinks', copy.highlightLinks, 'M10 13a5 5 0 0 0 7.07 0l2.12-2.12a5 5 0 0 0-7.07-7.07L11 4.93 M14 11a5 5 0 0 0-7.07 0L4.81 13.12a5 5 0 0 0 7.07 7.07L13 19.07') + '\
              ' + controlTemplate(controls.pauseAnimations, 'pauseAnimations', copy.pauseAnimations, 'M8 5h3v14H8z M15 5h3v14h-3z') + '\
              ' + controlTemplate(controls.lineSpacing, 'lineSpacing', copy.lineSpacing, 'M7 6h13 M7 12h13 M7 18h13 M4 5v14') + '\
              ' + controlTemplate(controls.readableFont, 'readableFont', copy.readableFont, 'M4 19 10 5h4l6 14 M7 14h10') + '\
              ' + controlTemplate(controls.lowStimulation, 'lowStimulation', copy.lowStimulation, 'M5 6h14 M7 12h10 M9 18h6') + '\
              ' + controlTemplate(controls.focusReading, 'focusReading', copy.focusReading, 'M4 7h16 M4 12h16 M4 17h16') + '\
            </div>\
            <button class="reset" data-reset type="button">' + escapeHtml(copy.reset) + '</button>\
          </div>\
          ' + (config.clearViewEnabled ? '<div class="view" data-clear-view-panel hidden>\
            <div class="clear-toolbar">\
              <button class="clear-back" data-clear-view-back type="button">' + escapeHtml(copy.backToControls) + '</button>\
              <button class="clear-refresh" data-clear-view-refresh type="button">' + escapeHtml(copy.refreshClearView) + '</button>\
            </div>\
            <div class="clear-view-content" data-clear-view-content></div>\
          </div>' : '') + '\
          ' + (config.showBranding ? '<p class="branding">TALIA Accessibility</p>' : '') + '\
        </div>\
      </section>\
      <div class="focus-mask focus-mask-top" data-focus-top hidden></div>\
      <div class="focus-band" data-focus-band hidden></div>\
      <div class="focus-mask" data-focus-bottom hidden></div>\
      <button class="toggle" data-toggle type="button" aria-label="' + escapeHtml(copy.open) + '" aria-expanded="false" aria-controls="talia-a11y-panel">\
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">\
          <circle cx="12" cy="7.5" r="1.2" fill="currentColor" stroke="none"></circle><path d="M7.5 10.5h9"></path><path d="M12 10.5v4"></path><path d="m9 19 3-4.5 3 4.5"></path>\
        </svg>\
      </button>';
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
    container.innerHTML = '<p class="clear-summary">' + escapeHtml(copy.clearViewLoading) + '</p>';
    var cached = readClearViewCache(config.tenantId, config.language);
    if (cached && !refresh) {
      container.innerHTML = renderClearViewContent(cached.clearView || cached, copy, cached.source || 'cached');
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
      })
      .catch(function () {
        container.innerHTML = renderClearViewContent(content, copy, 'local');
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
        increaseText: 'Aumentar texto',
        decreaseText: 'Reducir texto',
        contrast: 'Alto contraste',
        grayscale: 'Escala de grises',
        highlightLinks: 'Resaltar enlaces',
        pauseAnimations: 'Pausar animaciones',
        lineSpacing: 'Más espaciado',
        readableFont: 'Fuente legible',
        lowStimulation: 'Baja estimulación',
        focusReading: 'Lectura enfocada',
        reset: 'Restablecer',
        clearView: 'Vista clara',
        clearViewDescription: 'Resume esta página en una lectura simple y ordenada.',
        clearViewLoading: 'Preparando una vista clara de esta página...',
        clearViewTitle: 'Información clara',
        backToControls: 'Volver a ajustes',
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
        textLevel: function (value) { return value === 0 ? 'Texto normal' : value === 1 ? 'Texto grande' : 'Texto muy grande'; },
      },
      ca: {
        title: 'Accessibilitat',
        description: "Ajusta la lectura i visualització d'aquest web.",
        open: "Obre els ajustos d'accessibilitat",
        close: "Tanca els ajustos d'accessibilitat",
        increaseText: 'Augmenta el text',
        decreaseText: 'Redueix el text',
        contrast: 'Alt contrast',
        grayscale: 'Escala de grisos',
        highlightLinks: 'Ressalta enllaços',
        pauseAnimations: 'Pausa animacions',
        lineSpacing: 'Més espaiat',
        readableFont: 'Font llegible',
        lowStimulation: 'Baixa estimulació',
        focusReading: 'Lectura enfocada',
        reset: 'Restableix',
        clearView: 'Vista clara',
        clearViewDescription: 'Resumeix aquesta pàgina en una lectura simple i ordenada.',
        clearViewLoading: 'Preparant una vista clara d’aquesta pàgina...',
        clearViewTitle: 'Informació clara',
        backToControls: 'Torna als ajustos',
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
        textLevel: function (value) { return value === 0 ? 'Text normal' : value === 1 ? 'Text gran' : 'Text molt gran'; },
      },
      en: {
        title: 'Accessibility',
        description: 'Adjust reading and visual display for this website.',
        open: 'Open accessibility settings',
        close: 'Close accessibility settings',
        increaseText: 'Increase text',
        decreaseText: 'Decrease text',
        contrast: 'High contrast',
        grayscale: 'Grayscale',
        highlightLinks: 'Highlight links',
        pauseAnimations: 'Pause animations',
        lineSpacing: 'More spacing',
        readableFont: 'Readable font',
        lowStimulation: 'Low stimulation',
        focusReading: 'Focused reading',
        reset: 'Reset',
        clearView: 'Clear view',
        clearViewDescription: 'Summarize this page into a simple, ordered reading view.',
        clearViewLoading: 'Preparing a clear view of this page...',
        clearViewTitle: 'Clear information',
        backToControls: 'Back to settings',
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
        textLevel: function (value) { return value === 0 ? 'Normal text' : value === 1 ? 'Large text' : 'Very large text'; },
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
    if (position === 'bottom-left') return 'left: 20px; bottom: 88px;';
    if (position === 'top-right') return 'right: 20px; top: 88px;';
    if (position === 'top-left') return 'left: 20px; top: 88px;';
    return 'right: 20px; bottom: 88px;';
  }

  function getAccessibilityPanelPositionCss(position) {
    if (position === 'bottom-left') return 'left: 20px; bottom: 152px;';
    if (position === 'top-right') return 'right: 20px; top: 152px;';
    if (position === 'top-left') return 'left: 20px; top: 152px;';
    return 'right: 20px; bottom: 152px;';
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
      lowStimulation: false,
      focusReading: false,
    };
  }

  function readState(tenantId) {
    try {
      var stored = localStorage.getItem('talia-a11y-' + tenantId);
      if (!stored) return getDefaultState();
      var parsed = JSON.parse(stored);
      var state = getDefaultState();
      state.textScale = parsed.textScale === 1 || parsed.textScale === 2 ? parsed.textScale : 0;
      state.contrast = parsed.contrast === true;
      state.grayscale = parsed.grayscale === true;
      state.highlightLinks = parsed.highlightLinks === true;
      state.pauseAnimations = parsed.pauseAnimations === true;
      state.lineSpacing = parsed.lineSpacing === true;
      state.readableFont = parsed.readableFont === true;
      state.lowStimulation = parsed.lowStimulation === true;
      state.focusReading = parsed.focusReading === true;
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

  function sanitizeColor(value) {
    var color = readString(value);
    return /^#[0-9a-fA-F]{6}$/.test(color) ? color : '#00e0c7';
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
