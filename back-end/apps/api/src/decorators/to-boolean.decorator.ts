import { Transform } from 'class-transformer';

/**
 * Coerces a query/string value into a real boolean for validation.
 *
 * Query parameters always arrive as strings, so `@IsBoolean()` alone would
 * reject them and `@Type(() => Boolean)` is unsafe (`Boolean('false') === true`).
 * This only maps the recognized tokens and leaves anything else untouched, so a
 * following `@IsBoolean()` rejects unexpected values (e.g. '0', 'no', '') with a
 * 400 rather than silently treating them as true. Omitted stays undefined.
 */
export const ToBoolean = (): PropertyDecorator =>
  Transform(({ value }) => {
    if (value === true || value === 'true') return true;
    if (value === false || value === 'false') return false;
    return value;
  });
