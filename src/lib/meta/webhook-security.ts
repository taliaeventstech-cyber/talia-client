import { createHmac, timingSafeEqual } from 'node:crypto'

export function verifyMetaWebhookChallenge(input: {
  mode: string | null
  token: string | null
  challenge: string | null
  expectedToken: string
}): string | null {
  if (
    input.mode !== 'subscribe'
    || !input.token
    || !input.challenge
    || !safeEqual(input.token, input.expectedToken)
  ) {
    return null
  }

  return input.challenge
}

export function verifyMetaWebhookSignature(input: {
  payload: string
  signature: string | null
  appSecret: string
}): boolean {
  if (!input.signature?.startsWith('sha256=')) return false

  const receivedHex = input.signature.slice('sha256='.length)
  if (!/^[a-f0-9]{64}$/i.test(receivedHex)) return false

  const expectedHex = createHmac('sha256', input.appSecret)
    .update(input.payload)
    .digest('hex')

  return timingSafeEqual(
    Buffer.from(expectedHex, 'hex'),
    Buffer.from(receivedHex, 'hex'),
  )
}

function safeEqual(left: string, right: string): boolean {
  const leftBytes = Buffer.from(left)
  const rightBytes = Buffer.from(right)
  if (leftBytes.length !== rightBytes.length) return false
  return timingSafeEqual(leftBytes, rightBytes)
}
