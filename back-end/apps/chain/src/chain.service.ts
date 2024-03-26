import { Injectable } from '@nestjs/common';

@Injectable()
export class ChainService {
  getHello(): string {
    return 'Hello World!';
  }
}
