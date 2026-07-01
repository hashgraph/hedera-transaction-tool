import { CanActivate, ExecutionContext, Inject } from '@nestjs/common';
import { TransactionsService } from '../transactions/transactions.service';

export class TransactionAccessGuard implements CanActivate {
  constructor(
    @Inject(TransactionsService) private readonly transactionsService: TransactionsService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;
    const transactionId = request.params.transactionId;

    if (!user || !transactionId) {
      return false;
    }

    // This will throw UnauthorizedException if access is denied
    await this.transactionsService.getTransactionWithVerifiedAccess(transactionId, user);

    return true;
  }
}
