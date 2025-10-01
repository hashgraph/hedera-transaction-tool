import { TransactionId } from '@hashgraph/sdk';

import { BadRequestException, Injectable, PipeTransform } from '@nestjs/common';

@Injectable()
export class TransactionIdPipe implements PipeTransform<string, Promise<TransactionId | number>> {
  transform(value: string): Promise<TransactionId | number> {
    let result: TransactionId | number;

    const isIntString = /^\d+$/.test(value);
    if (isIntString) {
      result = parseInt(value);
    } else {
      try {
        result = TransactionId.fromString(value);
      } catch {
        throw new BadRequestException(
          'Invalid id. Should be a number or an entityId@timestamp string',
        );
      }
    }

    return Promise.resolve(result);
  }
}
