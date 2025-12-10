const dateOptions = {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
} as Intl.DateTimeFormatOptions;

const timeOptions = {
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hour12: false,
} as Intl.DateTimeFormatOptions;

const extendedDateOptions = {
  ...dateOptions,
  weekday: 'short',
  month: 'short',
} as Intl.DateTimeFormatOptions;

const extendedTimeOptions = {
  ...timeOptions,
  timeZoneName: 'short',
} as Intl.DateTimeFormatOptions;

export function formatDatePart(date: Date, utc: boolean = false, compact = false): string {
  const options = compact ? dateOptions : extendedDateOptions;
  const formatter = new Intl.DateTimeFormat(
    undefined,
    utc ? { ...options, timeZone: 'UTC' } : options,
  );
  return formatter.format(date);
}

export function formatTimePart(date: Date, utc: boolean = false, compact = false): string {
  const options = compact ? timeOptions : extendedTimeOptions;
  const formatter = new Intl.DateTimeFormat(
    undefined,
    utc ? { ...options, timeZone: 'UTC' } : options,
  );
  return formatter.format(date);
}
