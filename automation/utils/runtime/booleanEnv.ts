const TRUE_ENV_VALUES = new Set(['1', 'true', 'yes', 'on']);
const FALSE_ENV_VALUES = new Set(['0', 'false', 'no', 'off']);

export function readBooleanEnv(name: string): boolean | null {
  const rawValue = process.env[name]?.trim();
  if (!rawValue) {
    return null;
  }

  const normalizedValue = rawValue.toLowerCase();

  if (TRUE_ENV_VALUES.has(normalizedValue)) {
    return true;
  }

  if (FALSE_ENV_VALUES.has(normalizedValue)) {
    return false;
  }

  throw new Error(`Invalid ${name} value "${rawValue}". Expected true/false.`);
}
