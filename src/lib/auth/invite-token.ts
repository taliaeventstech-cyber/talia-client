import { createHash } from 'crypto'

export function hashInviteToken(token: string) {
  return createHash('sha256').update(token.trim()).digest('hex')
}
