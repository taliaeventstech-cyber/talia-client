#!/usr/bin/env node
// Post-processing step for `npm run db:types`.
//
// Postgres does not record nullability for function arguments or for the
// columns of a `returns table (...)`, so from CLI 2.106 onwards the Supabase
// type generator emits every one of them as non-null. That is wrong for the
// functions listed below: their arguments are declared `text` (several with
// `default null`) and the alert rows genuinely carry nulls — a tenant-level
// quota alert has no source, and a successful sync has no error code.
//
// Editing the generated file by hand is what let it drift for months, so the
// corrections live here instead: explicit, reviewed, and reapplied on every
// regeneration. If a target disappears (a function renamed, an argument
// dropped, or the generator starting to emit nullability itself) this script
// exits non-zero so the mismatch is noticed instead of silently skipped.

import { readFileSync, writeFileSync } from 'node:fs'

const TARGET = 'src/types/database.types.ts'

/** @type {{ fn: string, section: 'Args' | 'Returns', fields: string[], why: string }[]} */
const CORRECTIONS = [
  {
    fn: 'get_backstage_response_traces',
    section: 'Args',
    fields: ['p_channel'],
    why: 'p_channel text default null — null means "every channel"',
  },
  {
    fn: 'disconnect_instagram_connection',
    section: 'Args',
    fields: ['p_provider_error_code'],
    why: 'p_provider_error_code text default null — null means the provider call succeeded',
  },
  {
    fn: 'disconnect_whatsapp_connection',
    section: 'Args',
    fields: ['p_provider_error_code'],
    why: 'p_provider_error_code text default null — null means the provider call succeeded',
  },
  {
    fn: 'save_meta_marketing_connection',
    section: 'Args',
    fields: ['p_ad_account_currency'],
    why: 'p_ad_account_currency text — Meta omits the currency on some ad accounts',
  },
  {
    fn: 'save_whatsapp_embedded_connection',
    section: 'Args',
    fields: ['p_display_phone_number', 'p_verified_name', 'p_error_code'],
    why: 'text arguments Meta may omit; p_error_code defaults to null',
  },
  {
    fn: 'get_knowledge_web_operational_alerts',
    section: 'Returns',
    fields: ['source_id', 'source_name', 'latest_status', 'error_code'],
    why: 'quota alerts carry no source, and a clean sync carries no status or error',
  },
]

const source = readFileSync(TARGET, 'utf8')
const lines = source.split('\n')

/**
 * Index of the line opening `<name>: {`, searched only inside the generated
 * `Functions:` section so a table of the same name can never be matched.
 */
function findFunctionBlock(name) {
  const functionsAt = lines.findIndex((line) => /^\s{4}Functions: \{$/.test(line))
  if (functionsAt === -1) throw new Error('no `Functions:` section in the generated types')

  const open = new RegExp(`^(\\s+)${name}: \\{$`)
  for (let i = functionsAt + 1; i < lines.length; i += 1) {
    const match = open.exec(lines[i])
    if (match) return { start: i, indent: match[1].length }
    // The section ends at a closing brace shallower than its members.
    if (/^\s{4}\}$/.test(lines[i])) break
  }
  return null
}

/** Range of lines belonging to the `Args: {` / `Returns: {` object of a block. */
function findSection(blockStart, blockIndent, section) {
  const open = new RegExp(`^\\s{${blockIndent + 2}}${section}: \\{$`)
  const close = new RegExp(`^\\s{${blockIndent + 2}}\\}`)
  let start = -1
  for (let i = blockStart + 1; i < lines.length; i += 1) {
    if (start === -1) {
      if (open.test(lines[i])) start = i
      // Left the block without finding the section.
      else if (new RegExp(`^\\s{${blockIndent}}\\}`).test(lines[i])) return null
      continue
    }
    if (close.test(lines[i])) return { start, end: i }
  }
  return null
}

const problems = []
let changed = 0
let alreadyCorrect = 0

for (const correction of CORRECTIONS) {
  const block = findFunctionBlock(correction.fn)
  if (!block) {
    problems.push(`${correction.fn}: function not found in the generated types`)
    continue
  }

  const section = findSection(block.start, block.indent, correction.section)
  if (!section) {
    problems.push(`${correction.fn}: no ${correction.section} object found`)
    continue
  }

  for (const field of correction.fields) {
    // The generator marks arguments with a default as optional (`field?:`).
    const fieldLine = new RegExp(`^(\\s+${field}\\??: )(.+)$`)
    let found = false

    for (let i = section.start + 1; i < section.end; i += 1) {
      const match = fieldLine.exec(lines[i])
      if (!match) continue
      found = true
      if (match[2].endsWith(' | null')) {
        alreadyCorrect += 1
      } else {
        lines[i] = `${match[1]}${match[2]} | null`
        changed += 1
      }
      break
    }

    if (!found) {
      problems.push(`${correction.fn}.${correction.section}.${field}: field not found`)
    }
  }
}

if (problems.length) {
  console.error('restore-nullable-db-types: the corrections no longer match the schema:')
  for (const problem of problems) console.error(`  - ${problem}`)
  console.error('\nUpdate CORRECTIONS in scripts/restore-nullable-db-types.mjs to match.')
  process.exit(1)
}

if (changed) writeFileSync(TARGET, lines.join('\n'))

const skipped = alreadyCorrect ? `, ${alreadyCorrect} already nullable` : ''
console.log(`restore-nullable-db-types: ${changed} field(s) restored to nullable${skipped}.`)
