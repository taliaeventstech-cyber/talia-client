const ELEVENLABS_BASE = 'https://api.elevenlabs.io'

type SyncParams = {
  systemPrompt: string
  voiceId: string | null
  language: string
  temperature: number // 0-100, maps to 0.0-1.0
}

export type ElevenLabsSyncResult =
  | { ok: true }
  | { ok: false; error: string; status?: number }

export async function syncAgentToElevenLabs(agentId: string, params: SyncParams): Promise<ElevenLabsSyncResult> {
  const apiKey = process.env.ELEVENLABS_API_KEY
  if (!apiKey) {
    return { ok: false, error: 'ELEVENLABS_API_KEY no está configurada.' }
  }

  const body: Record<string, unknown> = {
    conversation_config: {
      agent: {
        prompt: {
          prompt: params.systemPrompt,
          temperature: params.temperature / 100,
        },
        ...(params.language === 'ca' ? {} : { language: params.language }),
      },
      ...(params.voiceId
        ? { tts: { voice_id: params.voiceId } }
        : {}),
    },
  }

  let res: Response
  try {
    res = await fetch(`${ELEVENLABS_BASE}/v1/convai/agents/${agentId}`, {
      method: 'PATCH',
      headers: {
        'xi-api-key': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    })
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'No se pudo conectar con ElevenLabs.',
    }
  }

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    return {
      ok: false,
      status: res.status,
      error: text || `ElevenLabs respondió con HTTP ${res.status}.`,
    }
  }

  return { ok: true }
}
