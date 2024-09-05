import { CallHandler, ExecutionContext, NestInterceptor, UseInterceptors } from '@nestjs/common';
import { map, Observable } from 'rxjs';
import { plainToInstance } from 'class-transformer';

type ClassConstructor<T> = new (...args) => T;

export function Serialize<T>(dto: ClassConstructor<T>) {
  return UseInterceptors(new SerializeInterceptor(dto));
}

class SerializeInterceptor<T> implements NestInterceptor {
  constructor(private dto: ClassConstructor<T>) {}

  intercept(context: ExecutionContext, handler: CallHandler): Observable<unknown> {
    return handler.handle().pipe(
      map((data: ClassConstructor<T>) =>
        plainToInstance(this.dto, data, {
          excludeExtraneousValues: true,
          exposeUnsetFields: false,
        }),
      ),
    );
  }
}
