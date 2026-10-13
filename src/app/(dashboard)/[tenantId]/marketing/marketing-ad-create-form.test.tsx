import { getMarketingCopy } from '@/lib/i18n/marketing-copy'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { MarketingAdCreateForm } from './marketing-ad-create-form'

describe('MarketingAdCreateForm', () => {
  it('renders provider-authorized identities and no delivery control', () => {
    const markup = renderToStaticMarkup(
      <MarketingAdCreateForm
        adSets={[{
          ad_set_id: '987654321',
          campaign_id: '123456789',
          name: 'Spain traffic',
          status: 'PAUSED',
        }]}
        adsManagerUrl="https://business.facebook.com/adsmanager/manage/campaigns?act=123"
        canCreate
        copy={getMarketingCopy('es')}
        initialRequestId="8ced31cc-e703-42f2-aa38-e657f1c484f4"
        pages={[{ id: '444555666', name: 'TALIA Events' }]}
        tenantId="657c9c3e-bf4a-45ce-868d-45a2f48db2fb"
      />,
    )

    expect(markup).toContain('Preparar el anuncio final')
    expect(markup).toContain('Spain traffic · PAUSED')
    expect(markup).toContain('TALIA Events')
    expect(markup).toContain('Imagen del anuncio')
    expect(markup).toContain('type="file"')
    expect(markup).toContain('accept="image/jpeg,image/png,.jpg,.jpeg,.png"')
    expect(markup).toContain('PAUSED')
    expect(markup).not.toContain('ACTIVE')
    expect(markup).not.toContain('name="status"')
  })

  it('explains when Meta exposes no promotable Page', () => {
    const markup = renderToStaticMarkup(
      <MarketingAdCreateForm
        adSets={[{
          ad_set_id: '987654321',
          campaign_id: '123456789',
          name: 'Spain traffic',
          status: 'PAUSED',
        }]}
        adsManagerUrl="https://business.facebook.com/adsmanager/manage/campaigns?act=123"
        canCreate
        copy={getMarketingCopy('es')}
        initialRequestId="8ced31cc-e703-42f2-aa38-e657f1c484f4"
        pages={[]}
        tenantId="657c9c3e-bf4a-45ce-868d-45a2f48db2fb"
      />,
    )

    expect(markup).toContain('No hay una Página autorizada disponible.')
    expect(markup).not.toContain('name="primaryText"')
  })
})
