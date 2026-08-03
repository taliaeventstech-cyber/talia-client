export function formatDateTime(
  value: string,
  locale: string,
  timeZone?: string,
  dateOnly = false,
) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value

  return new Intl.DateTimeFormat(locale, dateOnly
    ? {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        timeZone,
      }
    : {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        timeZoneName: 'short',
        timeZone,
      }).format(date)
}
