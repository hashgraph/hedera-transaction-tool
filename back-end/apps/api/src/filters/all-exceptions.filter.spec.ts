import { ArgumentsHost, HttpException } from '@nestjs/common';

import { AllExceptionsFilter } from './all-exceptions.filter';

describe('AllExceptionsFilter', () => {
  let filter: AllExceptionsFilter;

  const makeHost = () => {
    const json = jest.fn();
    const status = jest.fn().mockReturnValue({ json });
    const getResponse = jest.fn().mockReturnValue({ status });
    const getRequest = jest.fn().mockReturnValue({ method: 'GET', url: '/test' });
    const switchToHttp = jest.fn().mockReturnValue({ getResponse, getRequest });
    return { host: { switchToHttp } as unknown as ArgumentsHost, status, json };
  };

  beforeEach(() => {
    filter = new AllExceptionsFilter();
  });

  it('should delegate HttpException directly', () => {
    const { host, status, json } = makeHost();
    filter.catch(new HttpException('Forbidden', 403), host);

    expect(status).toHaveBeenCalledWith(403);
    expect(json).toHaveBeenCalledWith('Forbidden');
  });

  it('should return 500 for an Error with a stack', () => {
    const { host, status, json } = makeHost();
    filter.catch(new Error('boom'), host);

    expect(status).toHaveBeenCalledWith(500);
    expect(json).toHaveBeenCalledWith({ statusCode: 500, message: 'Internal server error' });
  });

  it('should return 500 for an object with message but no stack', () => {
    const { host, status, json } = makeHost();
    filter.catch({ message: 'no stack' }, host);

    expect(status).toHaveBeenCalledWith(500);
    expect(json).toHaveBeenCalledWith({ statusCode: 500, message: 'Internal server error' });
  });

  it('should return 500 for a null exception', () => {
    const { host, status, json } = makeHost();
    filter.catch(null, host);

    expect(status).toHaveBeenCalledWith(500);
    expect(json).toHaveBeenCalledWith({ statusCode: 500, message: 'Internal server error' });
  });
});
