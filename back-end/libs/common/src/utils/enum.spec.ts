import { getEnumValue } from './enum';

enum Sample {
  FOO = 'Foo Value',
  BAR = 'Bar Value',
}

describe('getEnumValue', () => {
  it('resolves a known key to its value', () => {
    expect(getEnumValue(Sample, 'FOO')).toBe('Foo Value');
  });

  it('returns undefined for an unknown key', () => {
    expect(getEnumValue(Sample, 'BAZ')).toBeUndefined();
  });

  it('returns undefined for a non-string key', () => {
    expect(getEnumValue(Sample, 42)).toBeUndefined();
    expect(getEnumValue(Sample, undefined)).toBeUndefined();
    expect(getEnumValue(Sample, null)).toBeUndefined();
  });

  it.each(['toString', 'constructor', 'hasOwnProperty', '__proto__'])(
    'returns undefined for inherited property name %s instead of the prototype value',
    key => {
      expect(getEnumValue(Sample, key)).toBeUndefined();
    },
  );
});
