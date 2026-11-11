import { ArgumentsHost, BadRequestException, Logger } from '@nestjs/common';

import { BadRequestExceptionFilter } from './bad-request-exception.filter';

describe('BadRequestExceptionFilter', () => {
  let filter: BadRequestExceptionFilter;

  beforeEach(() => {
    filter = new BadRequestExceptionFilter();
  });

  it('should catch BadRequestException and return custom response with code', () => {
    const json = jest.fn();
    const status = jest.fn().mockReturnValue({ json });
    const getResponse = jest.fn().mockReturnValue({ status });
    const switchToHttp = jest.fn().mockReturnValue({ getResponse });
    const host = { switchToHttp };

    filter.catch(new BadRequestException('UNF'), host as unknown as ArgumentsHost);

    expect(status).toHaveBeenCalledWith(400);
    expect(json).toHaveBeenCalledWith({
      statusCode: 400,
      message: 'The request is invalid. Please check the request body and try again.',
      code: 'UNF',
    });
  });

  it('should catch BadRequestException and return custom response with unknown code', () => {
    const json = jest.fn();
    const status = jest.fn().mockReturnValue({ json });
    const getResponse = jest.fn().mockReturnValue({ status });
    const switchToHttp = jest.fn().mockReturnValue({ getResponse });
    const host = { switchToHttp };

    filter.catch(new BadRequestException('code'), host as unknown as ArgumentsHost);

    expect(status).toHaveBeenCalledWith(400);
    expect(json).toHaveBeenCalledWith({
      statusCode: 400,
      message: 'The request is invalid. Please check the request body and try again.',
      code: 'UNKWN',
    });
  });

  it.each(['toString', 'constructor', 'hasOwnProperty'])(
    'should treat inherited Object property "%s" as unmapped and log it',
    message => {
      const json = jest.fn();
      const status = jest.fn().mockReturnValue({ json });
      const getResponse = jest.fn().mockReturnValue({ status });
      const switchToHttp = jest.fn().mockReturnValue({ getResponse });
      const host = { switchToHttp };
      const errorSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation();

      filter.catch(new BadRequestException(message), host as unknown as ArgumentsHost);

      expect(errorSpy).toHaveBeenCalledTimes(1);
      expect(json).toHaveBeenCalledWith(expect.objectContaining({ code: 'UNKWN' }));

      errorSpy.mockRestore();
    },
  );
});
