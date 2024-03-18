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
import { JwtAuthGuard } from '../../auth/jwt/jwt-auth.guard';
import { Serialize } from '../../interceptors/serialize.interceptor';
import { TransactionApproverDto } from '../dto/transaction-approver.dto';
import { ApproversService } from './approvers.service';
import { TransactionApprover } from '../../entities/transaction-approver.entity';
import { GetUser } from '../../decorators/get-user.decorator';
import { User } from '../../entities/user.entity';
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

  @Get()
  getTransactionApproversByTransactionId(
    @Param('transactionId', ParseIntPipe) transactionId: number,
  ): Promise<TransactionApprover[]> {
    return this.approversService.getTransactionApproversByTransactionId(
      transactionId,
    );
  }

  @Post()
  createTransactionApprover(
    @Param('transactionId', ParseIntPipe) transactionId: number,
    @Body() body: CreateTransactionApproverDto,
  ): Promise<TransactionApprover> {
    return this.approversService.createTransactionApprover(transactionId, body);
  }

  @Delete('/:id')
  removeTransactionApprover(@Param('id', ParseIntPipe) id: number): void {
    this.approversService.removeTransactionApprover(id);
  }
  //TODO should this be allowed? Changing the approval tree structure after people
  // have signed could be an issue.
  // updateApprover(): Promise<TransactionApprover> {}
}
