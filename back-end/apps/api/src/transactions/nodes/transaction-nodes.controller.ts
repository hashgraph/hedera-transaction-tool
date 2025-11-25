import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';

import {
  PaginatedResourceDto,
  Pagination,
  PaginationParams,
  Serialize,
  Sorting,
  SortingParams,
  withPaginatedResponse,
} from '@app/common';
import { User } from '@entities';

import { JwtAuthGuard, JwtBlackListAuthGuard, VerifiedUserGuard } from '../../guards';
import { TransactionNodeDto } from '../dto';
import { GetUser } from '../../decorators';
import {
  TransactionNodeCollection,
  transactionNodeProperties,
} from '../../../../../../middle-end/src/ITransactionNode';
import { EnumValidationPipe } from '@app/common/pipes';
import { TransactionNodesService } from './transaction-nodes.service';

const TransactionNodeCollectionPipe = new EnumValidationPipe<TransactionNodeCollection>(
  TransactionNodeCollection,
  false,
);

@ApiTags('Transaction Nodes')
@Controller('transaction-nodes')
@UseGuards(JwtBlackListAuthGuard, JwtAuthGuard, VerifiedUserGuard)
export class TransactionNodesController {
  constructor(private readonly transactionNodesService: TransactionNodesService) {}

  @ApiOperation({
    summary: 'Get transaction nodes visible by the user',
    description: 'Get transaction nodes visible by the user',
  })
  @ApiResponse({
    status: 200,
  })
  @Get()
  @Serialize(withPaginatedResponse(TransactionNodeDto))
  getTransactionNodes(
    @GetUser() user: User,
    @Param('collection', TransactionNodeCollectionPipe) collection: TransactionNodeCollection,
    @PaginationParams() paginationParams: Pagination,
    @SortingParams(transactionNodeProperties) sort?: Sorting[],
  ): Promise<PaginatedResourceDto<TransactionNodeDto>> {
    return this.transactionNodesService.getTransactionNodes(user, collection, paginationParams, sort);
  }
}
