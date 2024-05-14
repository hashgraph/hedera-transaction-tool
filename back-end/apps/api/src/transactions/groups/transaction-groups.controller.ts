import { Body, Controller, Delete, Get, Param, ParseIntPipe, Post, UseGuards } from '@nestjs/common';
import { TransactionGroupsService } from './transaction-groups.service';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard, VerifiedUserGuard } from '../../guards';
import { Serialize } from '@app/common';
import { CreateTransactionGroupDto, TransactionGroupDto } from '../dto';
import { TransactionGroup, User } from '@entities';
import { GetUser } from '../../decorators';

@ApiTags('Transaction Groups')
@Controller('transaction-groups')
@UseGuards(JwtAuthGuard, VerifiedUserGuard)
@Serialize(TransactionGroupDto)
export class TransactionGroupsController {
  constructor(private readonly transactionGroupsService: TransactionGroupsService) {}

  /* Submit a transaction group */
  @ApiOperation({
    summary: 'Create a transaction group',
    description: 'Create a transaction group for the organization. ' +
      'The group contains group items that each point to a transaction ' +
      'that the organization is to approve, sign, and execute.',
  })
  @ApiResponse({
    status: 201,
    type: TransactionGroupDto,
  })
  @Post()
  createTransactionGroup(@GetUser() user: User, @Body() dto: CreateTransactionGroupDto): Promise<TransactionGroup> {
    return this.transactionGroupsService.createTransactionGroup(user, dto);
  }

  /* TESTING ONLY: Get all transactions groups */
  @Get()
  getTransactionGroups(): Promise<TransactionGroup[]> {
    return this.transactionGroupsService.getTransactionGroups();
  }

  /* Delete a transaction group */
  @ApiOperation({
    summary: 'Remove a transaction group',
    description: 'Remove the transaction group, group items, and transactions for the provided transaction group id.',
  })
  @ApiResponse({
    status: 200,
  })
  @Delete('/:id')
  removeTransactionGroup(@GetUser() user: User, @Param('id', ParseIntPipe) groupId: number, ): void {
    this.transactionGroupsService.removeTransactionGroup(user, groupId);
  }
}
