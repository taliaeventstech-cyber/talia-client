import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const migration = readFileSync(
  join(process.cwd(), 'supabase/migrations/20261012100000_meta_marketing_ad_image_uploads.sql'),
  'utf8',
).toLowerCase()

describe('Meta Marketing direct ad-image upload migration', () => {
  it('stores only bounded image metadata and provider references', () => {
    expect(migration).toContain('image_sha256 text')
    expect(migration).toContain('image_mime_type text')
    expect(migration).toContain('image_size_bytes integer')
    expect(migration).toContain('provider_image_hash text')
    expect(migration).not.toContain('image_bytes')
    expect(migration).not.toContain('bytea')
  })

  it('keeps the uploaded-image request idempotent and server-authorized', () => {
    expect(migration).toContain('claim_meta_marketing_ad_upload_creation')
    expect(migration).toContain('v_request.image_sha256 <> lower(trim(p_image_sha256))')
    expect(migration).toContain('connection.rollout_enabled = true')
    expect(migration).toContain("connection.scopes @> array['ads_management']::text[]")
    expect(migration).toContain('on conflict (request_id) do nothing')
  })

  it('audits bounded metadata without content or digest', () => {
    expect(migration).toContain("'media_source', 'meta_upload'")
    expect(migration).not.toContain("'image_sha256', v_request.image_sha256")
    expect(migration).not.toContain("'primary_text', v_request.primary_text")
  })
})
