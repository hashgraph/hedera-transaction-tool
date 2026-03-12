import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseBoolPipe,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';

import { Serialize } from '@app/common';
import { TransactionGroup, User } from '@entities';

import { JwtAuthGuard, JwtBlackListAuthGuard, VerifiedUserGuard } from '../../guards';
import { CancelGroupResultDto, CreateTransactionGroupDto, TransactionGroupDto } from '../dto';
import { GetUser } from '../../decorators';

import { TransactionGroupsService } from './transaction-groups.service';

@ApiTags('Transaction Groups')
@Controller('transaction-groups')
@UseGuards(JwtBlackListAuthGuard, JwtAuthGuard, VerifiedUserGuard)
export class TransactionGroupsController {
  constructor(private readonly transactionGroupsService: TransactionGroupsService) {}

  /* Submit a transaction group */
  @ApiOperation({
    summary: 'Create a transaction group',
    description:
      'Create a transaction group for the organization. ' +
      'The group contains group items that each point to a transaction ' +
      'that the organization is to approve, sign, and execute.',
  })
  @ApiResponse({
    status: 201,
    type: TransactionGroupDto,
  })
  @Post()
  @Serialize(TransactionGroupDto)
  createTransactionGroup(
    @GetUser() user: User,
    @Body() dto: CreateTransactionGroupDto,
  ): Promise<TransactionGroup> {
    return this.transactionGroupsService.createTransactionGroup(user, dto);
  }

  /* TESTING ONLY: Get all transactions groups */
  @Get()
  @Serialize(TransactionGroupDto)
  getTransactionGroups(): Promise<TransactionGroup[]> {
    return this.transactionGroupsService.getTransactionGroups();
  }

  @ApiOperation({
    summary: 'Get a transaction group',
    description: 'Get a transaction group and its transactions by its id.',
  })
  @ApiResponse({
    status: 200,
    type: TransactionGroupDto,
  })
  @Get('/:id')
  @Serialize(TransactionGroupDto)
  getTransactionGroup(
    @GetUser() user: User,
    @Param('id', ParseIntPipe) groupId: number,
    @Query('full', new ParseBoolPipe({ optional: true })) full?: boolean,
  ): Promise<TransactionGroup> {
    return this.transactionGroupsService.getTransactionGroup(user, groupId, full ?? true);
  }

  /* Cancel all transactions in a group */
  @ApiOperation({
    summary: 'Cancel a transaction group',
    description: 'Cancel all in-progress transactions in the transaction group.',
  })
  @ApiResponse({
    status: 200,
    type: CancelGroupResultDto,
  })
  @ApiResponse({ status: 400, description: 'Transaction group not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @Patch('/:id/cancel')
  @Serialize(CancelGroupResultDto)
  cancelTransactionGroup(
    @GetUser() user: User,
    @Param('id', ParseIntPipe) groupId: number,
  ): Promise<CancelGroupResultDto> {
    return this.transactionGroupsService.cancelTransactionGroup(user, groupId);
  }

  /* Delete a transaction group */
  @ApiOperation({
    summary: 'Remove a transaction group',
    description:
      'Remove the transaction group, group items, and transactions for the provided transaction group id.',
  })
  @ApiResponse({
    status: 200,
    type: Boolean,
  })
  @Delete('/:id')
  removeTransactionGroup(
    @GetUser() user: User,
    @Param('id', ParseIntPipe) groupId: number,
  ): Promise<boolean> {
    return this.transactionGroupsService.removeTransactionGroup(user, groupId);
  }
}
