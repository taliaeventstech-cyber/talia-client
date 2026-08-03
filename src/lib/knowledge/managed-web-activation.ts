export type ManagedWebSourceCreationMode = 'supervised' | 'onboarding'

export function shouldAutoEnableManagedWebSource({
  creationMode,
  chatbotSetupCompleted,
}: {
  creationMode: ManagedWebSourceCreationMode
  chatbotSetupCompleted: boolean
}) {
  return creationMode === 'onboarding' && !chatbotSetupCompleted
}
