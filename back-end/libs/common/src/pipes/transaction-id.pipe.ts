import { BadRequestException, Injectable, PipeTransform } from '@nestjs/common';
import { TransactionId } from '@hashgraph/sdk';

@Injectable()
export class TransactionIdPipe implements PipeTransform<string, Promise<TransactionId | number>> {
  transform(value: string): Promise<TransactionId | number> {
    let result: TransactionId | number;

    result = parseInt(value);
    if (isNaN(result)) {
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
