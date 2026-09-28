export function getEnumValue<T extends Record<string, string>>(
  enumObject: T,
  key: unknown,
): T[keyof T] | undefined {
  if (typeof key !== 'string' || !Object.prototype.hasOwnProperty.call(enumObject, key)) {
    return undefined;
  }
  return enumObject[key as keyof T];
}
