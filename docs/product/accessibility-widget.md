# Accessibility Widget

Status: functional technical MVP with initial product hardening.

Goal: develop a lightweight accessibility widget, independent of the TALIA chatbot, aimed at improving the end-user experience and helping cultural clients move toward better accessibility practices. It must not be sold as certification or as an automatic guarantee of legal compliance.

## Positioning

The module should be communicated as:

- an accessibility improvement tool;
- operational support to reduce common barriers;
- an independent module within the TALIA ecosystem;
- prior or complementary help to human audits.

It should not be communicated as:

- automatic WCAG compliance;
- certified compliance;
- a substitute for a legal or technical audit;
- a complete solution for EAA, ADA, EN 301 549, or equivalent regulations.

Recommended commercial message:

> TALIA Accessibility improves navigation, reading, and visual adaptation of the website through accessible controls for visitors. It helps reduce friction and better prepare the website for audits, without replacing a professional accessibility audit.

## References

OneTap sells an accessibility plugin for WordPress with quick installation, floating widget, toggleable modules, preconfigured profiles, visual customization, multi-language support, an accessibility statement generator, and pricing by number of websites or agency.

Product references:

- https://wponetap.com/pricing/
- https://wponetap.com/features/
- https://wponetap.com/modules/

Regulatory and technical references:

- W3C WCAG 2.2: https://www.w3.org/TR/WCAG22/
- European Accessibility Act, Directive (EU) 2019/882: https://eur-lex.europa.eu/eli/dir/2019/882/oj

## Fit within TALIA

The module must live within the TALIA ecosystem, but separate from the chatbot:

- it is distributed from `public/accessibility-widget.js`;
- it is not mixed with the chatbot's conversational launcher;
- it can reuse TALIA's tenant/configuration/branding;
- it is configured from `widget_config.accessibility` or from a dedicated table/configuration if the product grows;
- it is activated per tenant/venue;
- it coexists with the web chatbot;
- it is initially tested on demo pages such as `public/olympia.html`.

It is not planned as a standalone WordPress plugin in the MVP.

Product decision: the chatbot and the accessibility widget must be distinct widgets. The end user should not interpret a chatbot as an accessibility tool, nor should visual adjustments be understood as part of a conversation. They can share branding, positioning, and configuration, but must have separate buttons, labels, and states.

## MVP

The MVP must be small, reversible, and safe on external websites.

### Features

- Its own floating accessibility button, independent of the chatbot launcher.
- Accessible panel with controls:
  - increase text size;
  - decrease text size;
  - high contrast;
  - grayscale;
  - highlight links;
  - pause animations;
  - increase spacing;
  - readable font;
  - reset.
- Local persistence per browser via `localStorage`.
- Initial support in Spanish, Catalan, and English.
- Full keyboard navigation.
- Visible focus.
- Clear ARIA labels.
- No cookies.
- No collection of personal data.

### Out of scope for the MVP

Note (Jul 2026): Text-to-speech was implemented after the MVP (see audit); the rest
remains out of scope.

- Text-to-speech. (implemented Jul 2026, no longer applies)
- Automatic WCAG audit.
- Legal accessibility statement generator.
- Page crawling.
- Compliance certificate.
- WordPress plugin.
- Advanced reporting panel.

## Clear View

Clear View is a simplified reading view of the public page within the widget.
It is designed to reduce cognitive load and organize useful information, not to
certify accessibility.

Implemented:

- Local extraction of title, summary, actions, and visible sections.
- Endpoint `POST /api/accessibility/clear-view`.
- AI generation when `OPENAI_API_KEY` is available.
- Local fallback if AI is not configured or fails.
- Strict schema for the response.
- Sanitization of actions to prevent the AI from inventing new links.
- Per-page cache in `sessionStorage`.
- Separate activation via `widget_config.accessibility.clearViewEnabled`.
- Basic rate limit per tenant and IP.
- Excessive payload truncation before calling the AI provider.

## Neurodivergent / low-stimulation mode

Reversible visual mode within the widget. It does not replace Clear View: Clear View
reorders the reading content within the panel, while low stimulation adapts the
current page without leaving it.

Implemented:

- Pauses animations and transitions.
- Reduces saturation/contrast of images and media.
- Removes intense backgrounds, gradients, shadows, and visual urgency effects.
- Softens badges, alerts, counters, and eye-catching elements.
- Makes grid, carousel, or slider-type layouts more linear when the user activates it.
- Keeps TALIA roots excluded so as not to break the chatbot or the widget itself.

## Reading orientation

Reversible modes to reduce distraction during reading without modifying the page's
DOM. They can be used separately or together.

Implemented:

- Reading mask: darkens the top and bottom, leaving a central band.
- Reading line: thin line that follows the mouse or focus.
- Repositioning on keyboard focus, scroll, and resize.
- Slight line-spacing adjustment while the mask is active.
- Persistence in `localStorage` along with the rest of the settings.

## Highlight content

Reversible mode to orient the user around the current block without altering the
website's structure.

Implemented:

- Detects the semantic block under the mouse or keyboard focus.
- Prioritizes containers such as `section`, `article`, `form`, `li`, `p`, cards, and items.
- Draws an overlay in Shadow DOM with a border and soft background.
- Repositions the overlay with `requestAnimationFrame`, scroll, and resize.
- Excludes TALIA roots so as not to highlight the widget or the chatbot.

Rules:

- If `accessibility.enabled !== true`, the widget does not mount.
- If `clearViewEnabled === false`, the Clear View button does not appear.
- The endpoint also blocks Clear View when the tenant has it disabled.
- Clear View must maintain cautious copy: reading aid, not legal compliance.

## UX

### Launcher

Options considered:

1. Separate accessibility button.
2. Access within the chatbot panel.
3. Combined launcher with two actions.

Decision: a separate, small button, close to the chatbot launcher when both are installed. It is clearer for end users and avoids mixing conversation with visual settings.

When it coexists with the chatbot:

- the accessibility button should sit slightly above the chatbot button;
- both buttons must have distinct ARIA labels;
- the accessibility panel must not open or close the chatbot;
- the chatbot must not contain accessibility controls in the MVP.

### Panel

The panel must:

- open as a non-blocking floating modal;
- have a clear title: `Accessibility`;
- have a close button;
- have large, scannable controls;
- show the active state of each control;
- include a `Reset` button;
- not cover the main content more than necessary.

### Initial copy

Spanish:

- Title: `Accesibilidad`
- Description: `Ajusta la lectura y visualización de esta web.`
- Reset: `Restablecer`

Catalan:

- Title: `Accessibilitat`
- Description: `Ajusta la lectura i visualització d'aquest web.`
- Reset: `Restableix`

English:

- Title: `Accessibility`
- Description: `Adjust reading and visual display for this website.`
- Reset: `Reset`

## Configuration

Proposed `widget_config`:

```json
{
  "accessibility": {
    "enabled": true,
    "position": "bottom-right",
    "language": "auto",
    "primaryColor": "#00e0c7",
    "highlightColor": "#fffb00",
    "showBranding": true,
    "controls": {
      "textSize": true,
      "contrast": true,
      "grayscale": true,
      "highlightLinks": true,
      "pauseAnimations": true,
      "lineSpacing": true,
      "readableFont": true,
      "lowStimulation": true,
      "readingMask": true,
      "readingLine": true,
      "highlightContent": true,
      "readAloud": true,
      "dyslexiaFont": true,
      "profiles": true
    }
  }
}
```

Rules:

- If `accessibility.enabled !== true`, the module does not mount.
- If there is no remote configuration, the module must not appear unless the script has an explicit attribute.
- The `auto` language should take `document.documentElement.lang`, with a fallback to Spanish.

## Embed API

Stable installation. Changes made in Agora are reflected upon reloading the
public website because the script queries `/api/widget/{tenantId}`.

```html
<script
  src="https://agora.talia.events/accessibility-widget.js"
  data-tenant="TENANT_ID">
</script>
```

If a website also uses the chatbot:

```html
<script
  src="https://agora.talia.events/widget.js"
  data-tenant="TENANT_ID">
</script>

<script
  src="https://agora.talia.events/accessibility-widget.js"
  data-tenant="TENANT_ID">
</script>
```

Priority:

1. Tenant's remote configuration.
2. Script attributes only as an advanced override or manual fallback.
3. Safe defaults.

## Technical architecture

The current chatbot uses Shadow DOM in `public/widget.js`. The accessibility widget must have its own Shadow DOM in `public/accessibility-widget.js`. Accessibility settings must affect the host page, so they cannot remain solely within the Shadow DOM.

Strategy:

- mount the panel UI in an independent root: `talia-accessibility-root`;
- apply visual state to the host document via classes on `document.documentElement`;
- inject a global stylesheet with `id="talia-accessibility-styles"`;
- limit styles to `talia-a11y-*` prefixed classes;
- save preferences in `localStorage`.

Proposed classes:

```txt
talia-a11y-text-lg
talia-a11y-text-xl
talia-a11y-contrast
talia-a11y-grayscale
talia-a11y-highlight-links
talia-a11y-pause-animations
talia-a11y-line-spacing
talia-a11y-readable-font
```

Persistence:

```txt
localStorage key: talia-a11y-{tenantId}
```

Example state:

```json
{
  "textScale": 1,
  "contrast": true,
  "grayscale": false,
  "highlightLinks": true,
  "pauseAnimations": false,
  "lineSpacing": false,
  "readableFont": false,
  "lowStimulation": false,
  "readingMask": false,
  "readingLine": false,
  "highlightContent": false
}
```

## Control implementation

### Text

Should use a conservative approach:

- do not touch elements inside the TALIA widget;
- apply `font-size` relative to common elements;
- maximum of two increase steps;
- allow reverting.

### Contrast

Should prioritize readability:

- consistent light/dark background;
- high-contrast text;
- avoid breaking images and logos.

### Grayscale

Apply:

```css
filter: grayscale(1);
```

taking care to exclude the TALIA panel to keep controls clear.

### Highlight links

Apply:

- visible underline;
- outline or soft background;
- without aggressively changing layout.

### Pause animations

Apply:

```css
animation-duration: 0.001ms !important;
animation-iteration-count: 1 !important;
transition-duration: 0.001ms !important;
scroll-behavior: auto !important;
```

### Spacing

Increase:

- `line-height`;
- `letter-spacing` only if it doesn't break things too much;
- spacing between paragraphs.

### Readable font

Apply system stack:

```css
font-family: Arial, Helvetica, system-ui, sans-serif;
```

## Accessibility of the panel itself

Requirements:

- launcher button with `aria-label`;
- `aria-expanded`;
- panel with `role="dialog"` or labeled region;
- title associated via `aria-labelledby`;
- close with Escape;
- initial focus on the panel or first control;
- visible focus;
- controls as real buttons;
- states with `aria-pressed`;
- not relying solely on color.

## Security and privacy

The MVP module:

- does not send personal data;
- does not read sensitive content;
- does not use cookies;
- does not perform fingerprinting;
- does not send events until there is a legal basis and clear configuration.

If analytics is instrumented later, events must be aggregated:

- panel opened;
- control activated/deactivated;
- reset;
- tenant;
- normalized page without sensitive query params.

## Risks

- Breaking the client website's styles.
- Creating a false sense of compliance.
- Making the panel itself inaccessible.
- Affecting performance due to excessive global CSS.
- Conflicts with themes, builders, and third-party plugins.

Mitigations:

- prefixed styles;
- reversible controls;
- testing on real pages;
- cautious legal copy;
- not promising certification;
- activating per tenant, not globally.

## MVP acceptance criteria

- The module only appears when enabled.
- The panel opens/closes with mouse and keyboard.
- Escape closes the panel.
- Controls have visible state and `aria-pressed`.
- Settings persist on reload.
- Reset removes classes and preferences.
- The chatbot keeps working.
- `public/olympia.html` is not broken.
- No console errors when loading without configuration.
- The module does not block the main content.

## Development Plan

### Phase 1: prototype in `public/accessibility-widget.js` - completed

- Create separate file `public/accessibility-widget.js`.
- Create local configuration via script attributes.
- Create launcher and panel within the Shadow DOM.
- Inject prefixed global CSS.
- Implement local state.
- Implement MVP controls.
- Test on `public/olympia.html` alongside the chatbot without interference.

### Phase 2: configuration from TALIA - completed

- Expand `widget_config`.
- Expose activation in settings/backstage.
- Show preview in widget configuration.
- Save language and color.

### Phase 3: product - in progress

- Harden Clear View with cost protection.
- Cover contract and sanitization with tests.
- Define pricing/add-on.
- Document legal limits.
- Create a commercial checklist.
- Prepare a demo for cultural venues.

### Phase 4: optional reporting

- Aggregated events.
- Basic usage dashboard.
- Monthly report.

## Open Questions

- Will it be sold as an add-on or included in higher-tier plans?
- What exact visual separation should it have from the chatbot button?
- Should we allow white-labeling from the first MVP?
- Which clients will we use as pilots?
- Do we enable analytics from the start or leave it out?
- Will an editable accessibility statement be needed later on?

## Recommended Decision

Keep the module as a product independent of the chatbot and move to a controlled
pilot with cultural venues. Before broad sales, finalize pricing, AI usage-limit
policy, and visual testing on real websites.

---

# Accessibility and Compliance Audit (July 2026)

Audit of the module as currently implemented in `public/accessibility-widget.js`
(1,451 lines), the Clear View backend (`src/lib/accessibility/*`), and its regulatory
fit, using OneTap (https://wponetap.com/modules/) as a market reference.

The focus of this audit is twofold:

1. Whether the module **actually serves end users with difficulties** (those who
   should benefit), by profile.
2. Whether the **widget itself** complies with WCAG 2.2 AA (an inaccessible
   accessibility tool fails its own audience).

## 1. Regulatory reality (read before selling)

Regulations relevant to cultural venues (many are public/municipal entities):

- **WCAG 2.2 AA** (W3C, Oct 2023): the reference technical standard.
- **EAA - European Accessibility Act**, Directive (EU) 2019/882, applicable from
  **June 28, 2025** to consumer products/services. It relies on **EN 301 549**
  (which references WCAG 2.1 AA).
- **Directive (EU) 2016/2102** (public sector web): requires EN 301 549 conformity **and**
  publishing an **accessibility statement** with a feedback mechanism. Applies to
  municipal/public theatres.
- **ADA** (US, Title III) and **Section 508**: reference WCAG 2.x AA.

**Central, non-negotiable truth:** no widget/overlay "enforces" regulatory compliance.
WCAG conformance depends on the HTML/ARIA/semantics of the website itself, not an
overlaid bar. Expert consensus (overlayfalseclaims.com, +900 signatories) and lawsuits
against overlays like accessiBe/UserWay confirm this. **Selling the widget as "automatic
compliance" legally exposes TALIA and its clients.** The current positioning in this
document (the "Positioning" and "Risks" sections) is correct and must be maintained.

Conclusion regarding "complying with all possible regulations": it is not achievable with a widget.
What is achievable, and what TALIA should pursue, is:

1. Making the **widget itself** WCAG 2.2 AA conformant.
2. **Genuinely helping** the profiles that an overlay actually can help (see §2).
3. Offering an editable **accessibility statement generator** (an artifact that
   Directive 2016/2102 requires from the public sector) as real compliance aid, without
   promising conformance.
4. Cautious copy and remediation guidance for the host site.

## 2. Real effectiveness by end-user profile

Legend: ✅ well served · 🟡 partial · ❌ not served / cannot be served

| Profile | Status | Detail |
|--------|:------:|---------|
| **Dyslexia / reading difficulty** | ✅ | Readable font, **dyslexia font** (Jul 2026), more spacing (WCAG 1.4.12), **reading mask and reading line**, read-aloud, Clear View, and a **1-click "Dyslexia" profile**. One of the best-served profiles. |
| **ADHD / attention** | ✅ | **Low stimulation** (removes animations, gradients, urgency, linearizes layout), pause animations, reading mask/line, Clear View. Good real-world fit. |
| **Neurodivergence / sensory sensitivity** | 🟡 | Low stimulation and pause animations help. Missing **mute sounds** (autoplay) and **hide images**. |
| **Elderly users** | ✅ | Combination of text + contrast + readable font + spacing. Large targets (>=54px) make it easier to use. |
| **Low vision** | 🟡 | High contrast, readable font, **scaling up to 200%** (Jul 2026), and **read-aloud** help quite a bit. A magnifier and large cursor are still pending. |
| **Color blindness** | 🟡 | Grayscale and "highlight links" (underline + outline, not color-dependent, WCAG 1.4.1). No color-type-specific filters. |
| **Epilepsy / photosensitivity** | 🟡 | Pause animations + low stimulation (reduces media saturation) help, but there is no one-click "safe mode" that stops flashing/GIFs/video. WCAG 2.3.1 depends on the site. |
| **Motor / keyboard-only / tremor** | 🟡 | Panel operable by keyboard and large targets (exceeds WCAG 2.5.8). But (a) the widget does **not** add keyboard navigation to the host site, and (b) there is a focus bug (Finding 1). |
| **Blindness / screen reader** | ❌ | An overlay **cannot** improve the host site's semantics; these users benefit from the site's own HTML/ARIA, not from the bar. It must not be communicated as a solution for blindness. TALIA does the right thing by **not** injecting an alternative reader (overlays that do interfere with the user's own assistive technology). |
| **Low literacy / audio** | ✅ | Covered (Jul 2026) with **"Read aloud"** (Web Speech API): reads the main content in the detected language, with no data leaving the browser. Also benefits low vision and dyslexia. |

Reading: the widget serves **well** dyslexia, ADHD, neurodivergence, and the elderly; **partially**
low vision, color blindness, epilepsy, and motor impairments; and **cannot** serve screen reader
users (nor should it try to). The two highest-impact gaps previously flagged for the target
audience —**limited text scaling (125%)** and **absence of text-to-speech**— have now been
**resolved** (Jul 2026), along with the **dyslexia font** and the **1-click profiles**. With this,
Block 1 and Block 2 of the roadmap are complete; the **profiles** also improve discoverability
for users who don't know exactly which setting they need.

## 3. WCAG 2.2 findings for the widget itself

### What it already meets (credit due)

- `role="dialog"`, `aria-modal`, `aria-labelledby`, `aria-describedby`, `tabindex="-1"`.
- Correct **focus trap** (uses `shadowRoot.activeElement`), closes with **Escape**, and
  **returns focus** to the launcher.
- `aria-expanded` on the launcher, `aria-pressed` on controls, tabs with `role="tab"` +
  arrow-key navigation + Home/End.
- Reinforced visible focus (`:focus-visible` with double outline).
- Real buttons, not clickable divs.
- **Large targets**: controls >=54px, launcher 56px (exceeds WCAG 2.5.8 AA's 24px).
- **Calculated contrast**: `getReadableTextColor`/relative luminance for the brand color.
- Live regions (`aria-live`) for text level and for Clear View (`aria-busy`).
- Shadow DOM isolation and exclusion of TALIA roots.
- No cookies, no PII, no fingerprinting; local `localStorage` (favorable to GDPR).

### Findings to fix

| # | Sev. | Finding | WCAG | Proposed fix |
|---|------|----------|------|---------------|
| 1 | **High** | When the panel is closed, its controls remain **focusable** (only `opacity:0` + `pointer-events:none` + `aria-hidden`, without `display/visibility/inert`). A keyboard/screen-reader user tabs into invisible controls. | 1.3.1, 2.4.3, 4.1.2 | Set `panel.inert = true` on close and `false` on open (or `visibility:hidden`). |
| 2 | Medium | The widget does not respect `prefers-reduced-motion` in **its own** animations (panel/launcher). Ironic for the vestibular/epilepsy audience. | 2.3.3 | `@media (prefers-reduced-motion: reduce)` to cancel transitions. |
| 3 | Medium | Text scaling capped at 125% (2 steps). Insufficient for low vision. | 1.4.4 | Extend to 150-200% (3-4 steps). |
| 4 | ~~Medium~~ **DONE** | No **text-to-speech**. High value for the target audience. | — (enhancement) | Applied (Jul 2026): "Read aloud" control using the browser's Web Speech API, reads the main content in the detected language, stops on re-press, never auto-starts (complies with 1.4.2). No data leaves the browser. |
| 5 | ~~Medium~~ **DONE** | No real **dyslexia font** (only Arial). | — (enhancement) | Applied (Jul 2026): "Dyslexia font" control with stack `OpenDyslexic → Comic Sans MS → Verdana` (no external requests) + letter/word/line spacing per BDA guidance. |
| 6 | Low | "AI" tab label unclear for users with cognitive difficulties; Clear View is not very discoverable. | 3.2.4 | Rename to "Easy reading"/"Clear view" and increase its visibility. |
| 7 | Low | Per-tenant/per-browser preferences in `localStorage`: the user must reconfigure at every venue. | — (UX) | Consider a key shared by the script's domain. |
| 8 | Low | No keyboard shortcut to open (parity with OneTap's Alt+.). | 2.1.4 if added | Configurable shortcut with the option to disable it. |
| 9 | Info | The widget does not improve the host's semantics: screen reader users do not benefit. | — | Document the limitation; do not communicate it as a solution for blindness. |
| 10 | Medium (priv.) | Clear View sends page content to OpenAI when configured (12k char cap, rate limit, no invented links). This is a relationship with a US subprocessor. | GDPR | Reflect this in the DPA and in the accessibility/privacy statement. |

## 4. Module comparison vs. OneTap

Legend: ✅ present · 🟡 partial · ❌ absent

| OneTap module | TALIA | Note |
|---------------|:-----:|------|
| Text Size | ✅ | Scaling up to 200% in 4 steps (Jul 2026) |
| Line Height / Spacing | ✅ | `lineSpacing` combines line height + spacing |
| Readable Font | ✅ | Arial/system |
| Dyslexic Font | ✅ | Applied: "Dyslexia font" (OpenDyslexic/Comic Sans/Verdana + BDA spacing) |
| Letter Spacing (separate) | 🟡 | Included in `lineSpacing`, not separate |
| Font Weight / Align Text | ❌ | — |
| Highlight Links | ✅ | Underline + outline |
| Big Cursor | ❌ | Useful for low vision/motor |
| Text Magnifier | ❌ | Useful for low vision |
| High/Dark/Light Contrast | 🟡 | Only one high-contrast mode (black/white) |
| Monochrome / Grayscale | ✅ | `grayscale` |
| Saturation | 🟡 | Only within low stimulation |
| Reading Line / Reading Mask | ✅ | Own strong points |
| Keyboard Navigation (host) | ❌ | An overlay cannot guarantee this |
| Highlight Titles | 🟡 | There is `highlightContent`, not titles separately |
| Highlight Content | ✅ | Own semantic overlay |
| Text-to-Speech | ✅ | Applied: "Read aloud" (Web Speech API, no data leaves the browser) |
| Mute Sounds | ❌ | Useful for neurodivergence |
| Hide Images | ❌ | Useful for ADHD/cognitive |
| Stop Animations | ✅ | `pauseAnimations` |
| Profiles (Vision/Seizure/ADHD/Epilepsy/Blind) | ✅ | Applied (Jul 2026): 4 one-click profiles — Dyslexia, Focus (ADHD), Low vision, Low stimulation. No profile that simulates a screen reader (intentionally) |
| Low stimulation / neurodivergent | ✅⭐ | Own differentiator, OneTap does not have an equivalent |
| Clear View (AI reading) | ✅⭐ | Own differentiator |
| +40 languages | 🟡 | Only es/ca/en |
| Statement generator | ❌ | Recommended by §1 point 3 |
| Keyboard shortcut | ❌ | Finding 8 |
| No data collection | ✅ | Correct |

## 5. Prioritized roadmap (compliance + effectiveness)

**Block 1 - conformance of the widget itself (mandatory before selling) — APPLIED (Jul 2026):**

1. Finding 1 (`inert` on close) — done: `panel.inert` is enabled on close and
   disabled on open; the panel starts with the `inert` attribute.
2. Finding 2 (`prefers-reduced-motion`) — done: media query that cancels
   transitions of the launcher, panel, and Clear View.
3. Finding 3 (scaling to 200%) — done: 4 steps (125/150/175/200%) with classes
   `talia-a11y-text-1..4` and a level label in percentage.

**Block 2 - effectiveness for the target audience (high value):**

4. Text-to-speech (Finding 4) — **DONE (Jul 2026)**: "Read aloud" control
   using the Web Speech API, reading the main content in the detected language,
   play/stop via toggle, no auto-start, no data leaving the browser.
5. Dyslexia font (Finding 5) — **DONE (Jul 2026)**: "Dyslexia font" control
   with stack `OpenDyslexic → Comic Sans MS → Verdana` (no external requests) and letter/word/line
   spacing per British Dyslexia Association guidance.
6. One-click profiles — **DONE (Jul 2026)**: 4 profiles (Dyslexia, Focus/ADHD,
   Low vision, Low stimulation) that apply a predefined combination of settings on a
   clean state; improves usability for those who don't know which setting they need. No profile
   that simulates a screen reader (counterproductive and risky, see §3 Finding 9).

**Block 3 - parity and commercial compliance:**

7. Mute sounds, hide images, large cursor, magnifier.
8. Editable accessibility statement generator (§1 point 3).
9. Reflect Clear View/OpenAI in the DPA and policy (Finding 10).
10. Copy and commercial checklist that separate "help" from "compliance".

**Do not do:** profiles that simulate a screen reader or promise automatic
conformance. This is counterproductive for assistive technology users and legally risky.
