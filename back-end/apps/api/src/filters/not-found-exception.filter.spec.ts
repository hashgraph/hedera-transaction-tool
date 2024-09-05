import { NotFoundExceptionFilter } from './not-found-exception.filter';
import { ArgumentsHost, NotFoundException } from '@nestjs/common';

describe('NotFoundExceptionFilter', () => {
  let filter: NotFoundExceptionFilter;

  beforeEach(() => {
    filter = new NotFoundExceptionFilter();
  });

  it('should catch NotFoundException and return custom response', () => {
    const json = jest.fn();
    const status = jest.fn().mockReturnValue({ json });
    const getResponse = jest.fn().mockReturnValue({ status });
    const switchToHttp = jest.fn().mockReturnValue({ getResponse });
    const host = { switchToHttp };

    filter.catch(new NotFoundException(), host as unknown as ArgumentsHost);

    expect(status).toHaveBeenCalledWith(404);
    expect(json).toHaveBeenCalledWith({
      statusCode: 404,
      message: 'Route not found',
    });
  });
});
