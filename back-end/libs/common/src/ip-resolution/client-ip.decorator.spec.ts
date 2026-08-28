import { ExecutionContext } from '@nestjs/common';

import { ClientIpFactory } from './client-ip.decorator';
import { CLIENT_IP_KEY } from './client-ip.types';

describe('ClientIp decorator', () => {
  it('returns the resolved IP stashed on the request by ClientIpMiddleware', () => {
    const mockExecutionContext: ExecutionContext = {
      switchToHttp: jest.fn().mockReturnThis(),
      getRequest: jest.fn().mockReturnValue({ [CLIENT_IP_KEY]: '203.0.113.5' }),
    } as unknown as ExecutionContext;

    expect(ClientIpFactory(null, mockExecutionContext)).toBe('203.0.113.5');
  });
});
