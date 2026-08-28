import { Logger } from 'winston';
import { CLIENT_IP_KEY } from '../ip-resolution';

import { LoggerMiddleware } from './logger.middleware';

describe('LoggerMiddleware', () => {
  let middleware: LoggerMiddleware;
  let logger: jest.Mocked<Pick<Logger, 'info' | 'warn'>>;
  let next: jest.Mock;

  const makeReqRes = (overrides: Record<string, unknown> = {}) => {
    const finishHandlers: Array<() => void> = [];
    const req = {
      [CLIENT_IP_KEY]: '203.0.113.5',
      method: 'GET',
      originalUrl: '/transactions',
      body: {},
      query: {},
      ...overrides,
    };
    const res = {
      statusCode: 200,
      on: jest.fn((event: string, cb: () => void) => {
        if (event === 'finish') finishHandlers.push(cb);
      }),
      finish: () => finishHandlers.forEach(cb => cb()),
    };
    return { req, res };
  };

  beforeEach(() => {
    logger = { info: jest.fn(), warn: jest.fn() };
    next = jest.fn();
    middleware = new LoggerMiddleware(logger as unknown as Logger);
  });

  it('logs at info with ip, uid=-, method, url, status, and duration', () => {
    const { req, res } = makeReqRes();

    middleware.use(req, res, next);
    res.finish();

    expect(next).toHaveBeenCalled();
    expect(logger.info).toHaveBeenCalledTimes(1);
    expect(logger.warn).not.toHaveBeenCalled();
    expect(logger.info.mock.calls[0][0]).toMatch(
      /^203\.0\.113\.5 uid=- GET \/transactions 200 - \d+ms$/,
    );
  });

  it('includes uid when req.user is set', () => {
    const { req, res } = makeReqRes({ user: { id: 42 } });

    middleware.use(req, res, next);
    res.finish();

    expect(logger.info.mock.calls[0][0]).toContain('uid=42');
  });

  it('masks sensitive fields and includes the payload', () => {
    const { req, res } = makeReqRes({ body: { email: 'a@b.com', password: 'secret', name: 'Bob' } });

    middleware.use(req, res, next);
    res.finish();

    const message = logger.info.mock.calls[0][0];
    expect(message).toContain('Payload:');
    expect(message).toContain('"email":"****"');
    expect(message).toContain('"password":"****"');
    expect(message).toContain('"name":"Bob"');
  });

  it('truncates a URL longer than 2048 characters', () => {
    const { req, res } = makeReqRes({ originalUrl: `/${'a'.repeat(2100)}` });

    middleware.use(req, res, next);
    res.finish();

    expect(logger.info.mock.calls[0][0]).toContain('... [truncated]');
  });

  it('truncates a serialized payload longer than the configured max', () => {
    const { req, res } = makeReqRes({ body: { name: 'x'.repeat(3000) } });

    middleware.use(req, res, next);
    res.finish();

    expect(logger.info.mock.calls[0][0]).toContain('... [truncated]');
  });

  it('logs at warn instead of info for a 404 response', () => {
    const { req, res } = makeReqRes();
    res.statusCode = 404;

    middleware.use(req, res, next);
    res.finish();

    expect(logger.warn).toHaveBeenCalledTimes(1);
    expect(logger.info).not.toHaveBeenCalled();
    expect(logger.warn.mock.calls[0][0]).toContain('404');
  });
});
