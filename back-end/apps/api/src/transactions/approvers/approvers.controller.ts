import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';

import { OnlyOwnerKey, Serialize } from '@app/common';

import { TransactionApprover, User } from '@entities';

import { JwtAuthGuard, JwtBlackListAuthGuard, VerifiedUserGuard } from '../../guards';

import { GetUser } from '../../decorators';

import { ApproversService } from './approvers.service';

import {
  ApproverChoiceDto,
  CreateTransactionApproversArrayDto,
  TransactionApproverDto,
  UpdateTransactionApproverDto,
} from '../dto';

@ApiTags('Transaction Approvers')
@Controller('transactions/:transactionId?/approvers')
@UseGuards(JwtBlackListAuthGuard, JwtAuthGuard, VerifiedUserGuard)
@Serialize(TransactionApproverDto)
export class ApproversController {
  constructor(private approversService: ApproversService) {}

  /* Create transaction approvers for the given transaction id with the user ids */
  @ApiOperation({
    summary: 'Creates transaction approvers',
    description: 'Create transaction approvers for the given transaction with the provided data.',
  })
  @ApiResponse({
    status: 201,
    type: [TransactionApproverDto],
  })
  @Post()
  createTransactionApprovers(
    @GetUser() user: User,
    @Param('transactionId', ParseIntPipe) transactionId: number,
    @Body() body: CreateTransactionApproversArrayDto,
  ): Promise<TransactionApprover[]> {
    return this.approversService.createTransactionApprovers(user, transactionId, body);
  }

  /* Approves a transaction */
  @ApiOperation({
    summary: 'Approves a transaction',
    description: 'Approves the transaction with the given transaction id.',
  })
  @ApiResponse({
    status: 200,
    type: Boolean,
  })
  @Post('/approve')
  @OnlyOwnerKey<ApproverChoiceDto>('userKeyId')
  approveTransaction(
    @GetUser() user: User,
    @Param('transactionId', ParseIntPipe) transactionId: number,
    @Body() body: ApproverChoiceDto,
  ): Promise<boolean> {
    return this.approversService.approveTransaction(body, transactionId, user);
  }

  /* Get all approvers for the given transaction */
  @ApiOperation({
    summary: 'Get all transaction approvers for a transaction',
    description:
      'Get the transaction approvers for the given transaction id. The result will be array of approvers that may be trees',
  })
  @ApiResponse({
    status: 200,
    type: [TransactionApproverDto],
  })
  @Get()
  getTransactionApproversByTransactionId(
    @GetUser() user: User,
    @Param('transactionId', ParseIntPipe) transactionId: number,
  ): Promise<TransactionApprover[]> {
    return this.approversService.getVerifiedApproversByTransactionId(transactionId, user);
  }

  /* Remove transaction approver or a tree by id of the root approver */
  @ApiOperation({
    summary: 'Removes transaction approver',
    description: 'Removes transaction approver by id.',
  })
  @ApiResponse({
    status: 200,
    type: Boolean,
  })
  @Delete('/:id')
  async removeTransactionApprover(
    @GetUser() user: User,
    @Param('transactionId', ParseIntPipe) transactionId: number,
    @Param('id', ParseIntPipe) id: number,
  ) {
    await this.approversService.getCreatorsTransaction(transactionId, user);
    await this.approversService.removeTransactionApprover(id);
    // await this.approversService.emitSyncIndicators(transactionId);

    return true;
  }

  /* Updates the transaction approver */
  @ApiOperation({
    summary: 'Update a transaction appover',
    description:
      'Update the transaction approver with the provided information for the given transaction approver id.',
  })
  @ApiResponse({
    status: 201,
    type: TransactionApproverDto,
  })
  @Patch('/:id')
  async updateTransactionApprover(
    @GetUser() user: User,
    @Param('transactionId', ParseIntPipe) transactionId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() body: UpdateTransactionApproverDto,
  ): Promise<TransactionApprover> {
    return this.approversService.updateTransactionApprover(id, body, transactionId, user);
  }
}
