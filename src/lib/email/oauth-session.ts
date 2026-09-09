export function assertEmailOAuthInitiator(currentUserId: string, initiatingUserId: string) {
  if (currentUserId !== initiatingUserId) {
    throw new Error('OAuth session does not match the initiating user')
  }
}
