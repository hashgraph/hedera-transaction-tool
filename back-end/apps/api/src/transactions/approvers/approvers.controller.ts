import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../guards/jwt-auth.guard';
import { Serialize } from '../../interceptors/serialize.interceptor';
import { TransactionApproverDto } from '../dto/transaction-approver.dto';
import { ApproversService } from './approvers.service';
import { TransactionApprover } from '@entities/transaction-approver.entity';
import { GetUser } from '../../decorators/get-user.decorator';
import { User } from '@entities/user.entity';
import { CreateTransactionApproverDto } from '../dto/create-transaction-approver.dto';
import { ApiTags } from '@nestjs/swagger';

@ApiTags('Transaction Approvers')
@Controller('transactions/:transactionId?/approvers')
@UseGuards(JwtAuthGuard)
@Serialize(TransactionApproverDto)
export class ApproversController {
  constructor(private approversService: ApproversService) {}

  @Get('/:id')
  getTransactionApproverById(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<TransactionApprover> {
    return this.approversService.getTransactionApproverById(id);
  }

  @Get('/user')
  getTransactionApproversByUser(
    @GetUser() user: User,
  ): Promise<TransactionApprover[]> {
    return this.approversService.getTransactionApproversByUserId(user.id);
  }

  @Get('/user/:userId')
  getTransactionApproversByUserId(
    @Param('userId', ParseIntPipe) userId: number,
  ): Promise<TransactionApprover[]> {
    return this.approversService.getTransactionApproversByUserId(userId);
  }

  // this is the only one that uses transactionid, so i should just change the route to transactions/approvers
  // then this route would also have :tranasctionId, then I can remove the approverId stuff, and would there be a use for the by user stuff?
  // how would a user change the approval status? they would need the tranasctionapprover id
  // so while the gettransactiontoapprove returns the transactions, the client does also need to get the approver rows for the user so they acn approve/decline
  // but do I need byuserid? can a user ever get the approvers of toehr users? yes, if the creator needs to delete them, forexample
  //
  // ok, but if a user gets all transactions they need to sign, observe, and approver, then the also need to get all approvers and observers for those transactions (in order to display them in the clinet)
  // then it doesn't need a third call to get approvers for user, as it already get them bytransactionid' right?
  //
  // and as the user has to get all transactions for each type (including creator) and separately get all approvers and observers and signers, there is no real reason to separate the get transactions
  // for each type, should just combine them all into 1 go - is there? is there every a time where the user will want to just get all transactions of one type? I can just keep the methods if so, and still separate them
  // if I do combine them, would I need to add an extra column to indicate role in transaction? or will the client figure that out?
  // gonna leave the separate until I talk with the group
  @Get()
  getTransactionApproversByTransactionId(
    @Param('transactionId', ParseIntPipe) transactionId: number,
  ): Promise<TransactionApprover[]> {
    return this.approversService.getTransactionApproversByTransactionId(
      transactionId,
    );
  }

  @Post()
  createTransactionApprover(@Body() body: CreateTransactionApproverDto): Promise<TransactionApprover> {
    return this.approversService.createTransactionApprover(body);
  }

  @Delete('/:id')
  removeTransactionApprover(@Param('id', ParseIntPipe) id: number): void {
    this.approversService.removeTransactionApprover(id);
  }
  //TODO should this be allowed? Changing the approval tree structure after people
  // have signed could be an issue.
  // updateApprover(): Promise<TransactionApprover> {}
}
