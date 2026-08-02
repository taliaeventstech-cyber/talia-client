export const TENANT_LANGUAGES = ['ca', 'es', 'en', 'pt-BR'] as const

export type TenantLanguage = (typeof TENANT_LANGUAGES)[number]

export function isTenantLanguage(value: unknown): value is TenantLanguage {
  return typeof value === 'string' && TENANT_LANGUAGES.includes(value as TenantLanguage)
}
