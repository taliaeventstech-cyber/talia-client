'use client'

import type { WhatsappConnectionCopy } from '@/lib/i18n/whatsapp-connection-copy'
import {
  parseMetaEmbeddedSignupMessage,
  type MetaEmbeddedSignupMessage,
} from '@/lib/whatsapp/embedded-signup-message'
import Script from 'next/script'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useRef, useState, useTransition } from 'react'
import { completeWhatsappEmbeddedSignupAction } from './actions'

type FacebookLoginResponse = {
  authResponse?: { code?: string }
}

type FacebookSdk = {
  init(options: { appId: string; autoLogAppEvents: boolean; xfbml: boolean; version: string }): void
  login(
    callback: (response: FacebookLoginResponse) => void,
    options: {
      config_id: string
      response_type: 'code'
      override_default_response_type: true
      extras: {
        sessionInfoVersion: '3'
        version: 'v4'
        setup: Record<string, never>
      }
    },
  ): void
}

declare global {
  interface Window {
    FB?: FacebookSdk
  }
}

export function WhatsappEmbeddedSignupButton({
  appId,
  configId,
  graphApiVersion,
  tenantId,
  copy,
  replacingPilot,
  retryingConnection,
}: {
  appId: string | null
  configId: string | null
  graphApiVersion: string
  tenantId: string
  copy: WhatsappConnectionCopy
  replacingPilot: boolean
  retryingConnection: boolean
}) {
  const router = useRouter()
  const [sdkReady, setSdkReady] = useState(false)
  const [feedback, setFeedback] = useState<{
    message: string
    tone: 'error' | 'neutral' | 'success'
  } | null>(null)
  const [isPending, startTransition] = useTransition()
  const codeRef = useRef<string | null>(null)
  const sessionRef = useRef<Extract<MetaEmbeddedSignupMessage, { kind: 'finished' }> | null>(null)
  const submittedRef = useRef(false)
  const configured = Boolean(appId && configId)

  const completeIfReady = useCallback(() => {
    const code = codeRef.current
    const session = sessionRef.current
    if (!code || !session || submittedRef.current) return
    submittedRef.current = true
    startTransition(async () => {
      const result = await completeWhatsappEmbeddedSignupAction(tenantId, {
        code,
        businessId: session.businessId,
        wabaId: session.wabaId,
        phoneNumberId: session.phoneNumberId,
      })
      if (result.ok) {
        setFeedback({ message: copy.success, tone: 'success' })
        router.refresh()
        return
      }
      submittedRef.current = false
      codeRef.current = null
      sessionRef.current = null
      setFeedback({
        message: result.code === 'provider_error' ? copy.providerError : copy.sdkError,
        tone: 'error',
      })
    })
  }, [copy.providerError, copy.sdkError, copy.success, router, tenantId])

  useEffect(() => {
    function handleMessage(event: MessageEvent) {
      const message = parseMetaEmbeddedSignupMessage(event.origin, event.data)
      if (!message) return
      if (message.kind === 'cancelled') {
        setFeedback({ message: copy.cancelled, tone: 'neutral' })
        return
      }
      if (message.kind === 'error') {
        setFeedback({ message: copy.providerError, tone: 'error' })
        return
      }
      sessionRef.current = message
      completeIfReady()
    }

    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [completeIfReady, copy.cancelled, copy.providerError])

  function initializeSdk() {
    if (!appId || !window.FB) return
    window.FB.init({
      appId,
      autoLogAppEvents: true,
      xfbml: true,
      version: graphApiVersion,
    })
    setSdkReady(true)
  }

  function launchSignup() {
    if (!window.FB || !configId || isPending) return
    codeRef.current = null
    sessionRef.current = null
    submittedRef.current = false
    setFeedback(null)
    window.FB.login((response) => {
      const code = response.authResponse?.code
      if (!code) return
      codeRef.current = code
      completeIfReady()
    }, {
      config_id: configId,
      response_type: 'code',
      override_default_response_type: true,
      extras: {
        sessionInfoVersion: '3',
        version: 'v4',
        setup: {},
      },
    })
  }

  return (
    <div className="stack whatsapp-connection-action">
      {configured ? (
        <Script
          id="meta-facebook-sdk"
          onError={() => setFeedback({ message: copy.sdkError, tone: 'error' })}
          onReady={initializeSdk}
          src="https://connect.facebook.net/en_US/sdk.js"
          strategy="afterInteractive"
        />
      ) : null}
      <button
        className="button-primary"
        disabled={!configured || !sdkReady || isPending}
        onClick={launchSignup}
        type="button"
      >
        {isPending
          ? copy.connecting
          : replacingPilot
            ? copy.replace
            : retryingConnection
              ? copy.retry
              : copy.connect}
      </button>
      {!configured ? <p className="form-error" role="status">{copy.setupMissing}</p> : null}
      {isPending ? <p className="muted" role="status">{copy.connectingDescription}</p> : null}
      {feedback ? (
        <p
          className={feedback.tone === 'neutral' ? 'muted' : `notice notice-${feedback.tone}`}
          role={feedback.tone === 'error' ? 'alert' : 'status'}
        >
          {feedback.message}
        </p>
      ) : null}
    </div>
  )
}
