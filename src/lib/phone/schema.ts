import { z } from 'zod'
import { normalizeInternationalPhoneValue } from './international'

export const optionalInternationalPhoneSchema = z.string()
  .trim()
  .max(40, 'El teléfono no puede superar los 40 caracteres.')
  .refine(
    (value) => !value || normalizeInternationalPhoneValue(value) !== null,
    'Introduce un teléfono internacional válido.',
  )
  .transform((value) => normalizeInternationalPhoneValue(value) ?? '')
