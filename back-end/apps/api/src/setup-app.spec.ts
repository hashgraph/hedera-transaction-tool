import { ConfigService } from '@nestjs/config';

import { isSwaggerEnabled } from './setup-app';

function configServiceReturning(value: unknown): ConfigService {
  return { get: () => value } as unknown as ConfigService;
}

describe('isSwaggerEnabled', () => {
  it('returns true when SWAGGER_ENABLED resolves to true', () => {
    expect(isSwaggerEnabled(configServiceReturning(true))).toBe(true);
  });

  it.each([false, undefined, 'true', 1])('returns false for non-boolean-true value %p', (value) => {
    expect(isSwaggerEnabled(configServiceReturning(value))).toBe(false);
  });
});
