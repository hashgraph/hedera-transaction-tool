import useDateTimeSetting, {
  DateTimeOptions,
} from '@renderer/composables/user/useDateTimeSetting.ts';

/**
 * Parses a date and time string with optional timezone offset.
 *
 * Date format: MM/DD/YY
 * Time format: HH:MM[:SS][Z|±HH:MM]
 *   - Z: Designates UTC time
 *   - +HH:MM or -HH:MM: Timezone offset
 *
 * When no offset is provided, use the tool's settings for Date/Time Format
 * When an offset is provided, it overrides the tool's setting.
 *
 * Note: to remain compatible with existing CSV file syntax (pre-timezone support):
 *   - time with optional seconds are accepted
 *   - single digit months, days, hours, minutes, seconds are accepted (e.g., 1/2/27, 3:4:5)
 *   - 4 digit years are accepted (e.g., 1/2/2027)
 */
export async function parseDateTime(date: string, time: string): Promise<Date> {
  const DATE_RE = /^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/;
  const TIME_RE = /^(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?(Z|[+-]\d{2}:\d{2})?$/;

  const matchDate = DATE_RE.exec(date);
  if (!matchDate) {
    throw new Error(`Invalid date format: ${date}`);
  }
  const matchTime = TIME_RE.exec(time);
  if (!matchTime) {
    throw new Error(`Invalid time format: ${time}`);
  }

  const [, dateMonth, dateDay, dateYear] = matchDate;
  const [, timeHour, timeMinute, timeSecond, timezone] = matchTime;

  const monthNum = Number(dateMonth);
  const dayNum = Number(dateDay);

  // Handle year: if 2 digits, assume > 2000 and < 2100, otherwise use as is
  const fullYear = dateYear.length === 2 ? 2000 + Number(dateYear) : Number(dateYear);

  const hour = Number(timeHour);
  const minute = Number(timeMinute);
  const second = timeSecond ? Number(timeSecond) : 0;

  // Validate ranges to avoid Date overflow
  const maxDay = new Date(Date.UTC(fullYear, monthNum, 0)).getUTCDate();
  if (monthNum < 1 || monthNum > 12 || dayNum < 1 || dayNum > maxDay) {
    throw new Error(`Invalid date value: ${date}`);
  }
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59 || second < 0 || second > 59) {
    throw new Error(`Invalid time value: ${time}`);
  }

  // Pad for ISO string formatting
  const paddedMonth = String(monthNum).padStart(2, '0');
  const paddedDay = String(dayNum).padStart(2, '0');
  const paddedHour = String(hour).padStart(2, '0');
  const paddedMinute = String(minute).padStart(2, '0');
  const paddedSecond = String(second).padStart(2, '0');

  let result: Date;

  // If timezone (offset or Z) is provided, use it directly
  if (timezone) {
    result = new Date(
      `${fullYear}-${paddedMonth}-${paddedDay}T${paddedHour}:${paddedMinute}:${paddedSecond}${timezone}`,
    );
  } else {
    // Otherwise, use the app's Date/Time Format setting
    const settings = await useDateTimeSetting().getDateTimeSetting();

    result = settings === DateTimeOptions.UTC_TIME
      ? new Date(Date.UTC(fullYear, monthNum - 1, dayNum, hour, minute, second))
      : new Date(fullYear, monthNum - 1, dayNum, hour, minute, second);
  }

  // Validate the resulting date
  if (Number.isNaN(result.getTime())) {
    throw new Error(`Invalid date/time value: ${date} ${time}`);
  }

  return result;
}
