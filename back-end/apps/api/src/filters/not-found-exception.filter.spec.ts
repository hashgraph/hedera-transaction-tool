import { ArgumentsHost, Logger, NotFoundException } from '@nestjs/common';
import { CLIENT_IP_KEY } from '@app/common';

import { NotFoundExceptionFilter } from './not-found-exception.filter';

describe('NotFoundExceptionFilter', () => {
  let filter: NotFoundExceptionFilter;

  beforeEach(() => {
    filter = new NotFoundExceptionFilter();
  });

  it('should catch NotFoundException, log a warning, and return custom response', () => {
    const warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation();

    const json = jest.fn();
    const status = jest.fn().mockReturnValue({ json });
    const getResponse = jest.fn().mockReturnValue({ status });
    const request = {
      [CLIENT_IP_KEY]: '203.0.113.5',
      method: 'GET',
      originalUrl: '/unknown-route',
    };
    const getRequest = jest.fn().mockReturnValue(request);
    const switchToHttp = jest.fn().mockReturnValue({ getRequest, getResponse });
    const host = { switchToHttp };

    filter.catch(new NotFoundException(), host as unknown as ArgumentsHost);

    expect(warn).toHaveBeenCalledWith('UNMATCHED_ROUTE 203.0.113.5 GET /unknown-route');
    expect(status).toHaveBeenCalledWith(404);
    expect(json).toHaveBeenCalledWith({
      statusCode: 404,
      message: 'Route not found',
    });

    warn.mockRestore();
  });

  it('should truncate very long URLs in the log line', () => {
    const warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation();

    const json = jest.fn();
    const status = jest.fn().mockReturnValue({ json });
    const getResponse = jest.fn().mockReturnValue({ status });
    const longUrl = `/${'a'.repeat(2100)}`;
    const request = {
      [CLIENT_IP_KEY]: '203.0.113.5',
      method: 'GET',
      originalUrl: longUrl,
    };
    const getRequest = jest.fn().mockReturnValue(request);
    const switchToHttp = jest.fn().mockReturnValue({ getRequest, getResponse });
    const host = { switchToHttp };

    filter.catch(new NotFoundException(), host as unknown as ArgumentsHost);

    const [message] = warn.mock.calls[0];
    expect(message).toContain('... [truncated]');
    expect(message.length).toBeLessThan(longUrl.length);

    warn.mockRestore();
  });
});
