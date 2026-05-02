# Talía — Design System
> Reference document for the coding agent. Apply every rule in this file strictly across the entire dashboard and all product UI.

---

## 1. Product context

Talía is a SaaS platform for the cultural sector (theatres, festivals, promoters).
Three modules: **Attention** (active), **Data**, **Marketing**.
The Attention module is an AI agent for customer support via web, email, WhatsApp and Instagram.

---

## 2. Typography

Import via Google Fonts:

```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Syne:wght@400;500;600;700;800&family=Space+Grotesk:wght@300;400;500&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
```

```js
// tailwind.config.ts
fontFamily: {
  display: ['Syne', 'sans-serif'],
  sans:    ['Space Grotesk', 'sans-serif'],
  mono:    ['JetBrains Mono', 'monospace'],
},
```

### Type scale

| Token          | Family         | Size  | Weight | Line-height | Usage                            |
|----------------|----------------|-------|--------|-------------|----------------------------------|
| `text-display` | Syne           | 48px  | 700    | 1.05        | Hero, landing only               |
| `text-h1`      | Syne           | 36px  | 700    | 1.1         | Page titles                      |
| `text-h2`      | Syne           | 24px  | 600    | 1.2         | Section headings                 |
| `text-h3`      | Space Grotesk  | 18px  | 500    | 1.3         | Card headers, subtitles          |
| `text-h4`      | Space Grotesk  | 16px  | 500    | 1.4         | Widget titles, sidebar items     |
| `text-body`    | Space Grotesk  | 15px  | 400    | 1.7         | Paragraphs, descriptions         |
| `text-ui`      | Space Grotesk  | 13px  | 400    | 1.5         | Nav, buttons, dropdowns          |
| `text-label`   | Space Grotesk  | 11px  | 500    | 1.4         | Uppercase labels, tracking 0.07em|
| `text-caption` | Space Grotesk  | 11px  | 400    | 1.4         | Timestamps, metadata             |
| `text-mono`    | JetBrains Mono | 12px  | 400    | 1.8         | AI outputs, logs, data values    |

### Rules
- **Syne** → headings only (H1, H2, page titles). Never in functional UI.
- **Space Grotesk** → everything else: nav, body, buttons, labels, forms, tables.
- **JetBrains Mono** → AI agent outputs, system logs, timestamps, numeric KPIs in data widgets.
- `text-label` always uppercase + `letter-spacing: 0.07em`.
- `text-display` and `text-h1`: `letter-spacing: -0.02em`.

---

## 3. Color system

Define as CSS custom properties. Apply theme via `data-theme` attribute on `<html>`.

```css
:root {
  /* Backgrounds */
  --color-base:           #F5F2EC;
  --color-surface:        #FFFFFF;
  --color-surface-2:      #EDEAE3;

  /* Brand */
  --color-brand:          #6B0F2B;
  --color-brand-hover:    #5a0c24;

  /* Gold accent */
  --color-gold:           #96720F;

  /* AI accent */
  --color-ia:             #006B61;
  --color-ia-bg:          #E8F5F3;

  /* Text */
  --color-text-primary:   #1A1A2E;
  --color-text-secondary: #4A4A5A;
  --color-text-tertiary:  #8888A0;

  /* Borders */
  --color-border:         rgba(26, 26, 46, 0.12);
  --color-border-strong:  rgba(26, 26, 46, 0.25);

  /* Status */
  --color-success:        #006B61;
  --color-warning:        #96720F;
  --color-error:          #6B0F2B;
}

[data-theme="dark"] {
  /* Backgrounds */
  --color-base:           #1A1A2E;
  --color-surface:        #252542;
  --color-surface-2:      #2E2E50;

  /* Brand */
  --color-brand:          #6B0F2B;
  --color-brand-hover:    #7d1232;

  /* Gold accent */
  --color-gold:           #C9A84C;

  /* AI accent */
  --color-ia:             #00E5C8;
  --color-ia-bg:          rgba(0, 229, 200, 0.10);

  /* Text */
  --color-text-primary:   #F5F2EC;
  --color-text-secondary: #9090B8;
  --color-text-tertiary:  #5A5A7A;

  /* Borders */
  --color-border:         rgba(245, 242, 236, 0.08);
  --color-border-strong:  rgba(245, 242, 236, 0.18);

  /* Status */
  --color-success:        #00E5C8;
  --color-warning:        #C9A84C;
  --color-error:          #f5a0a0;
}
```

```js
// tailwind.config.ts
colors: {
  brand:    'var(--color-brand)',
  gold:     'var(--color-gold)',
  ia:       'var(--color-ia)',
  'ia-bg':  'var(--color-ia-bg)',
  base:     'var(--color-base)',
  surface:  'var(--color-surface)',
  surface2: 'var(--color-surface-2)',
  'text-primary':   'var(--color-text-primary)',
  'text-secondary': 'var(--color-text-secondary)',
  'text-tertiary':  'var(--color-text-tertiary)',
  border:         'var(--color-border)',
  'border-strong':'var(--color-border-strong)',
},
```

---

## 4. Day / Night toggle

```ts
// On app load
const saved = localStorage.getItem('talia-theme');
const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
document.documentElement.setAttribute('data-theme', saved ?? (prefersDark ? 'dark' : 'light'));

// Toggle function
function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme');
  const next = current === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  localStorage.setItem('talia-theme', next);
}
```

- Apply theme on `<html>`, never on a child component.
- Do NOT use Tailwind's `dark:` prefix — use CSS custom properties only.

---

## 5. Components

### Cards
```css
background: var(--color-surface);
border: 0.5px solid var(--color-border);
border-radius: 12px;
padding: 20px;
/* No shadow */
```

### Primary button
```css
background: var(--color-brand);
color: #ffffff;
font-family: 'Space Grotesk', sans-serif;
font-size: 13px;
font-weight: 500;
border-radius: 6px;
padding: 8px 18px;
border: none;
/* No shadow */
```
Hover: `background: var(--color-brand-hover)`

### Outline button
```css
background: transparent;
border: 0.5px solid var(--color-border-strong);
color: var(--color-text-primary);
font-family: 'Space Grotesk', sans-serif;
font-size: 13px;
font-weight: 400;
border-radius: 6px;
padding: 8px 18px;
```
Hover: `background: var(--color-surface-2)`

### AI active badge
```css
background: var(--color-ia-bg);
color: var(--color-ia);
font-family: 'Space Grotesk', sans-serif;
font-size: 11px;
font-weight: 500;
border-radius: 20px;
padding: 3px 10px;
```

### Section label
```css
font-family: 'Space Grotesk', sans-serif;
font-size: 11px;
font-weight: 500;
text-transform: uppercase;
letter-spacing: 0.07em;
color: var(--color-text-tertiary);
```

### AI output block
```css
font-family: 'JetBrains Mono', monospace;
font-size: 12px;
font-weight: 400;
line-height: 1.8;
background: var(--color-surface);
color: var(--color-text-secondary);
border-radius: 8px;
padding: 14px 18px;
```
- Highlighted values: `color: var(--color-ia)`
- Alerts/errors: `color: var(--color-error)`
- Accent values (gold KPIs): `color: var(--color-gold)`

### Sidebar navigation
```css
background: var(--color-surface);
border-right: 0.5px solid var(--color-border);
width: 240px;
```
Active nav item:
```css
background: var(--color-surface-2);
color: var(--color-brand);
font-weight: 500;
border-left: 2px solid var(--color-brand);
```
Inactive nav item:
```css
color: var(--color-text-secondary);
font-weight: 400;
```

### KPI metric card
```css
/* Card wrapper */
background: var(--color-surface);
border: 0.5px solid var(--color-border);
border-radius: 12px;
padding: 20px;

/* Value */
font-family: 'JetBrains Mono', monospace;
font-size: 32px;
font-weight: 500;
color: var(--color-text-primary);

/* Label */
font-family: 'Space Grotesk', sans-serif;
font-size: 11px;
font-weight: 500;
text-transform: uppercase;
letter-spacing: 0.07em;
color: var(--color-text-tertiary);

/* Trend positive */
color: var(--color-success);

/* Trend negative */
color: var(--color-error);
```

### Data table
```css
/* Header row */
background: var(--color-surface-2);
font-family: 'Space Grotesk', sans-serif;
font-size: 11px;
font-weight: 500;
text-transform: uppercase;
letter-spacing: 0.07em;
color: var(--color-text-tertiary);

/* Body rows */
border-bottom: 0.5px solid var(--color-border);
font-size: 13px;
color: var(--color-text-primary);

/* Row hover */
background: var(--color-surface-2);
```

---

## 6. Module naming

| Module       | Description                                                   | Status   |
|--------------|---------------------------------------------------------------|----------|
| **Attention**  | AI agent — web chatbot, email, WhatsApp, Instagram           | Active   |
| **Data**       | Audience profiles, segmentation, propensity models           | Upcoming |
| **Marketing**  | Automated and personalised campaigns                         | Upcoming |

---

## 7. Dashboard layout

```
┌─────────────────────────────────────────────────┐
│  TOPBAR — logo + module name + user + toggle    │
├──────────┬──────────────────────────────────────┤
│          │                                      │
│ SIDEBAR  │  MAIN CONTENT AREA                  │
│ 240px    │  padding: 32px                       │
│          │                                      │
│ - Home   │  Page title (Syne 700, 28px)         │
│ - Attn   │                                      │
│ - Data   │  KPI row (4 cards)                   │
│ - Mktg   │                                      │
│          │  Content grid (charts, tables, logs) │
│ ─────    │                                      │
│ Settings │                                      │
│ Help     │                                      │
└──────────┴──────────────────────────────────────┘
```

- Page background: `var(--color-base)`
- Sidebar + topbar: `var(--color-surface)`
- Content cards: `var(--color-surface)`
- Max content width: 1280px

---

## 8. Spacing scale

| Token  | Value |
|--------|-------|
| `xs`   | 4px   |
| `sm`   | 8px   |
| `md`   | 16px  |
| `lg`   | 24px  |
| `xl`   | 32px  |
| `2xl`  | 48px  |
| `3xl`  | 64px  |

---

## 9. Border radius scale

| Element        | Radius  |
|----------------|---------|
| Cards          | 12px    |
| Buttons        | 6px     |
| Badges / pills | 20px    |
| Inputs         | 6px     |
| Modals         | 16px    |
| Tooltips       | 6px     |

---

## 10. Do / Don't

| Do | Don't |
|----|-------|
| Use Syne for H1, H2, page titles | Use Syne in buttons, labels or body text |
| Use Space Grotesk for all functional UI | Use JetBrains Mono for UI labels |
| Use JetBrains Mono for AI outputs and KPI numbers | Mix font families in the same UI element |
| Apply colors via CSS custom properties | Hardcode hex values in components |
| Use 0.5px borders, no shadows on cards | Add box-shadow to cards |
| Keep cards border-radius 12px | Use different radii per component arbitrarily |
| Gold `--color-gold` for premium accents only | Use gold as a primary action color |
| IA cyan `--color-ia` for agent status only | Use IA color for general success states |