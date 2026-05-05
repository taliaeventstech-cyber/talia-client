const ELEVENLABS_BASE = 'https://api.elevenlabs.io'

type SyncParams = {
  systemPrompt: string
  voiceId: string | null
  language: string
  temperature: number // 0-100, maps to 0.0-1.0
}

export async function syncAgentToElevenLabs(agentId: string, params: SyncParams): Promise<void> {
  const apiKey = process.env.ELEVENLABS_API_KEY
  if (!apiKey) {
    console.warn('[elevenlabs-sync] ELEVENLABS_API_KEY not set, skipping sync')
    return
  }

  const body: Record<string, unknown> = {
    conversation_config: {
      agent: {
        prompt: {
          prompt: params.systemPrompt,
          temperature: params.temperature / 100,
        },
        language: params.language,
      },
      ...(params.voiceId
        ? { tts: { voice_id: params.voiceId } }
        : {}),
    },
  }

  const res = await fetch(`${ELEVENLABS_BASE}/v1/convai/agents/${agentId}`, {
    method: 'PATCH',
    headers: {
      'xi-api-key': apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    console.error(`[elevenlabs-sync] PATCH agent ${agentId} failed: ${res.status} ${text}`)
  }
}
