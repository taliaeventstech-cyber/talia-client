import type { Dictionary } from '@/lib/i18n/dictionaries'
import type { Locale } from '@/lib/i18n/config'
import { setLocaleAction } from './language-toggle/actions'

export function LanguageToggle({ locale, dictionary }: { locale: Locale; dictionary: Dictionary }) {
  return (
    <form className="language-toggle" action={setLocaleAction} aria-label={dictionary.language.label}>
      <button
        className={locale === 'es' ? 'language-toggle-option language-toggle-option-active' : 'language-toggle-option'}
        type="submit"
        name="locale"
        value="es"
        aria-pressed={locale === 'es'}
      >
        {dictionary.language.es}
      </button>
      <button
        className={locale === 'ca' ? 'language-toggle-option language-toggle-option-active' : 'language-toggle-option'}
        type="submit"
        name="locale"
        value="ca"
        aria-pressed={locale === 'ca'}
      >
        {dictionary.language.ca}
      </button>
    </form>
  )
}
