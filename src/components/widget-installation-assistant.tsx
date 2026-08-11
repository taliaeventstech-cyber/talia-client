'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { CheckCircle2, ExternalLink, RefreshCcw, ShieldCheck, TriangleAlert } from 'lucide-react'
import { CopyScriptButton } from '@/components/copy-script-button'

type InstallationPlatform = 'nextjs' | 'wordpress' | 'webflow' | 'shopify' | 'other'

export type WidgetInstallationAssistantLabels = {
  title: string
  description: string
  platform: string
  platforms: Readonly<Record<InstallationPlatform, string>>
  steps: Readonly<Record<InstallationPlatform, readonly string[]>>
  detected: string
  notDetected: string
  detectedAt: string
  openWebsite: string
  recheck: string
  checking: string
}

export function WidgetInstallationAssistant({
  websiteUrl,
  installation,
  security,
  labels,
}: {
  websiteUrl: string | null
  installation: { origin: string; lastSeenAt: string } | null
  security: {
    title: string
    help: string
    instructions: string
    copy: string
    copied: string
  }
  labels: WidgetInstallationAssistantLabels
}) {
  const router = useRouter()
  const [platform, setPlatform] = useState<InstallationPlatform>('other')
  const [checking, startChecking] = useTransition()

  return (
    <div className="widget-installation-assistant">
      <div className="widget-installation-assistant-heading">
        <div>
          <h3>{labels.title}</h3>
          <p className="muted">{labels.description}</p>
        </div>
        <div className={installation ? 'widget-installation-detection widget-installation-detection-ready' : 'widget-installation-detection'}>
          {installation ? <CheckCircle2 size={18} aria-hidden="true" /> : <TriangleAlert size={18} aria-hidden="true" />}
          <span>
            <strong>{installation ? labels.detected : labels.notDetected}</strong>
            {installation ? (
              <>
                <small>{installation.origin}</small>
                <small>{labels.detectedAt.replace('{date}', formatInstallationDate(installation.lastSeenAt))}</small>
              </>
            ) : null}
          </span>
        </div>
      </div>

      <label className="field widget-installation-platform">
        <span>{labels.platform}</span>
        <select value={platform} onChange={(event) => setPlatform(event.target.value as InstallationPlatform)}>
          {Object.entries(labels.platforms).map(([value, label]) => (
            <option value={value} key={value}>{label}</option>
          ))}
        </select>
      </label>

      <ol className="widget-installation-steps">
        {labels.steps[platform].map((step) => <li key={step}>{step}</li>)}
      </ol>

      <div className="widget-installation-security">
        <div className="widget-installation-security-heading">
          <ShieldCheck size={19} aria-hidden="true" />
          <div>
            <h4>{security.title}</h4>
            <p className="muted">{security.help}</p>
          </div>
        </div>
        <div className="script-code-panel">
          <CopyScriptButton
            value={security.instructions}
            label={security.copy}
            copiedLabel={security.copied}
          />
          <pre className="ai-output script-code-block">{security.instructions}</pre>
        </div>
      </div>

      <div className="widget-installation-assistant-actions">
        {websiteUrl ? (
          <a className="button-outline button-fit" href={websiteUrl} target="_blank" rel="noreferrer">
            {labels.openWebsite}
            <ExternalLink size={16} aria-hidden="true" />
          </a>
        ) : null}
        <button
          className="button-outline button-fit"
          type="button"
          disabled={checking}
          onClick={() => startChecking(() => router.refresh())}
        >
          <RefreshCcw size={16} className={checking ? 'spin' : undefined} aria-hidden="true" />
          {checking ? labels.checking : labels.recheck}
        </button>
      </div>
    </div>
  )
}

function formatInstallationDate(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date)
}
