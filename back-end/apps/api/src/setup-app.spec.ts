import { ConfigService } from '@nestjs/config';

import { getSwaggerMode } from './setup-app';

function configServiceReturning(value: unknown): ConfigService {
  return { get: () => value } as unknown as ConfigService;
}

describe('getSwaggerMode', () => {
  it.each(['off', 'read-only', 'full'] as const)('passes through SWAGGER_MODE=%s', (mode) => {
    expect(getSwaggerMode(configServiceReturning(mode))).toBe(mode);
  });

  it('defaults to off when unset', () => {
    expect(getSwaggerMode(configServiceReturning(undefined))).toBe('off');
  });
});
