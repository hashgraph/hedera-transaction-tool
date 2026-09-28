import { byteSize } from './byte-size.validator';

describe('byteSize', () => {
  it.each(['25mb', '2mb', '100', '25 mb', '25MB', '1.5gb'])('accepts %s', (value) => {
    expect(byteSize().validate(value).error).toBeUndefined();
  });

  it.each(['unlimited', '', 'nan'])('rejects %s', (value) => {
    expect(byteSize().validate(value).error).toBeDefined();
  });

  // bytes.parse('25mib') doesn't return null -- it silently falls back to parseInt('25mib', 10)
  // and returns 25 (bytes), ignoring the bogus suffix. Delegating to bytes.parse() for
  // validation would let this typo through as a near-zero body limit. This test exists so
  // nobody "simplifies" the validator back to trusting bytes.parse() alone.
  it('rejects a binary-unit typo that bytes.parse would silently mis-parse', () => {
    expect(byteSize().validate('25mib').error).toBeDefined();
  });
});
