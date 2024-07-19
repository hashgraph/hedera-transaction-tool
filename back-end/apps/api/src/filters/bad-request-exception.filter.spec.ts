import { BadRequestExceptionFilter } from './bad-request-exception.filter';
import { BadRequestException } from '@nestjs/common';

describe('BadRequestExceptionFilter', () => {
  let filter: BadRequestExceptionFilter;

  beforeEach(() => {
    filter = new BadRequestExceptionFilter();
  });

  it('should catch BadRequestException and return custom response', () => {
    const json = jest.fn();
    const status = jest.fn().mockReturnValue({ json });
    const getResponse = jest.fn().mockReturnValue({ status });
    const switchToHttp = jest.fn().mockReturnValue({ getResponse });
    const host = { switchToHttp };

    filter.catch(new BadRequestException(), host as any);

    expect(status).toHaveBeenCalledWith(400);
    expect(json).toHaveBeenCalledWith({
      statusCode: 400,
      message: 'The request is invalid. Please check the request body and try again.',
    });
  });
});