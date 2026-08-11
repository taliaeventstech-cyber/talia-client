#!/usr/bin/env node

const options = parseArgs(process.argv.slice(2))
if (!options.site) {
  console.error('Uso: npm run widget:smoke -- --site https://example.org [--origin https://example.org] [--tenant UUID] [--app https://agora.talia.events]')
  process.exit(2)
}

const siteUrl = new URL(options.site)
const installationOrigin = options.origin ? new URL(options.origin).origin : siteUrl.origin
const appOrigin = new URL(options.app ?? 'https://agora.talia.events').origin
const failures = []

const siteResponse = await checkFetch('landing', siteUrl, { redirect: 'follow' })
if (siteResponse) {
  const csp = siteResponse.headers.get('content-security-policy')
  if (!csp) {
    pass('La landing no declara CSP; no necesita allowlist adicional')
  } else {
    checkCspDirective(csp, 'script-src-elem', appOrigin, installationOrigin)
    checkCspDirective(csp, 'connect-src', appOrigin, installationOrigin)
  }
}

const widgetResponse = await checkFetch('widget.js', `${appOrigin}/widget.js`, {
  headers: { Origin: installationOrigin },
})
if (widgetResponse) {
  const contentType = widgetResponse.headers.get('content-type') ?? ''
  if (contentType.includes('javascript')) pass('widget.js se sirve como JavaScript')
  else fail(`widget.js devuelve Content-Type inesperado: ${contentType || '(vacío)'}`)
  checkCors(widgetResponse, installationOrigin, 'widget.js')
}

if (options.tenant) {
  const configResponse = await checkFetch('configuración del tenant', `${appOrigin}/api/widget/${encodeURIComponent(options.tenant)}`, {
    headers: { Origin: installationOrigin, Referer: `${installationOrigin}/` },
  })
  if (configResponse) {
    checkCors(configResponse, installationOrigin, 'configuración del tenant')
    try {
      const config = await configResponse.json()
      pass(`Tenant encontrado; widget ${config.enabled === false ? 'inactivo' : 'activo'}`)
    } catch {
      fail('La configuración del tenant no devuelve JSON válido')
    }
  }
}

if (failures.length) {
  console.error(`\nWidget no instalable: ${failures.length} comprobación(es) fallida(s).`)
  process.exit(1)
}

console.log('\nWidget instalable: todas las comprobaciones han pasado.')

async function checkFetch(label, url, init) {
  let lastError = null
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const response = await fetch(url, { ...init, signal: AbortSignal.timeout(10_000) })
      if (response.ok) {
        pass(`${label} responde HTTP ${response.status}${attempt > 1 ? ` tras ${attempt} intentos` : ''}`)
        return response
      }
      if (response.status < 500 || attempt === 3) {
        fail(`${label} responde HTTP ${response.status}`)
        return null
      }
    } catch (error) {
      lastError = error
    }
  }
  fail(`${label} no responde: ${lastError instanceof Error ? lastError.message : String(lastError)}`)
  return null
}

function checkCspDirective(csp, directiveName, requiredOrigin, siteOrigin) {
  const directives = new Map(csp.split(';').map((part) => {
    const [name, ...values] = part.trim().split(/\s+/)
    return [name, values]
  }))
  const fallbackDirective = directiveName === 'script-src-elem' ? 'script-src' : null
  const effectiveDirective = directives.has(directiveName)
    ? directiveName
    : fallbackDirective && directives.has(fallbackDirective)
      ? fallbackDirective
      : directives.has('default-src')
        ? 'default-src'
        : null

  if (!effectiveDirective) {
    pass(`CSP no restringe ${directiveName}; no necesita allowlist adicional`)
    return
  }

  const values = directives.get(effectiveDirective) ?? []
  if (values.some((value) => cspSourceAllows(value, requiredOrigin, siteOrigin))) {
    pass(`CSP ${effectiveDirective} permite ${requiredOrigin}`)
  } else {
    fail(`CSP ${effectiveDirective} debe permitir ${requiredOrigin}`)
  }
}

function cspSourceAllows(source, requiredOrigin, siteOrigin) {
  if (source === '*' || source === requiredOrigin) return true
  if (source === "'self'") return requiredOrigin === siteOrigin
  if (source === 'https:') return requiredOrigin.startsWith('https://')
  if (!source.includes('*')) return false
  const escaped = source.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replaceAll('*', '.*')
  return new RegExp(`^${escaped}$`).test(requiredOrigin)
}

function checkCors(response, siteOrigin, label) {
  const allowedOrigin = response.headers.get('access-control-allow-origin')
  if (allowedOrigin === '*' || allowedOrigin === siteOrigin) pass(`CORS de ${label} permite ${siteOrigin}`)
  else fail(`CORS de ${label} no permite ${siteOrigin}`)
}

function parseArgs(args) {
  const parsed = {}
  for (let index = 0; index < args.length; index += 1) {
    const key = args[index]
    if (!key?.startsWith('--')) continue
    parsed[key.slice(2)] = args[index + 1]
    index += 1
  }
  return parsed
}

function pass(message) {
  console.log(`✓ ${message}`)
}

function fail(message) {
  failures.push(message)
  console.error(`✗ ${message}`)
}
