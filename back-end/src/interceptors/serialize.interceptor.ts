import { CallHandler, ExecutionContext, NestInterceptor, UseInterceptors } from '@nestjs/common';
import { map, Observable } from 'rxjs';
import { plainToInstance } from 'class-transformer';

interface ClassConstructor {
  new (...args: any[]): {};
}

export function Serialize(dto: ClassConstructor) {
  return UseInterceptors(new SerializeInterceptor(dto));
}

class SerializeInterceptor implements NestInterceptor {
  constructor(private dto: ClassConstructor) {}

  intercept(context: ExecutionContext, handler: CallHandler): Observable<any> {
    // run something before a request is handled
    // by the request handler

    return handler.handle().pipe(
      map((data: ClassConstructor) => {
        // Run something before the response is sent out
        // Note: if there is no response due to nothing found, this breaks stuff.

        // are there any unset fields that should be exposed? trying out exposeUnsetFields
        // to hide 'deletedAt' if it is not set. Could just hide the field entirely, too.
        return plainToInstance(this.dto, data, {
          excludeExtraneousValues: true,
          exposeUnsetFields: false,
        });
      }),
    );
  }
}