import { ExecutionContext } from '@nestjs/common';
import { IsApiKeyAuthFactory } from './is-api-key-auth.decorator';

describe('IsApiKeyAuth Decorator', () => {
  it('should return true when the request was authenticated via API key', () => {
    const mockExecutionContext: ExecutionContext = {
      switchToHttp: jest.fn().mockReturnThis(),
      getRequest: jest.fn().mockReturnValue({ authViaApiKey: true }),
    } as unknown as ExecutionContext;

    expect(IsApiKeyAuthFactory(null, mockExecutionContext)).toBe(true);
  });

  it('should return false when the request was not authenticated via API key', () => {
    const mockExecutionContext: ExecutionContext = {
      switchToHttp: jest.fn().mockReturnThis(),
      getRequest: jest.fn().mockReturnValue({}),
    } as unknown as ExecutionContext;

    expect(IsApiKeyAuthFactory(null, mockExecutionContext)).toBe(false);
  });
});
