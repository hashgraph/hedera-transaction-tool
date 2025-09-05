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

import {
  Filtering,
  FilteringParams,
  OnlyOwnerKey,
  PaginatedResourceDto,
  Pagination,
  PaginationParams,
  Serialize,
  Sorting,
  SortingParams,
  withPaginatedResponse,
} from '@app/common';

import { Transaction, User, transactionDateProperties, transactionProperties } from '@entities';

import { JwtAuthGuard, JwtBlackListAuthGuard, VerifiedUserGuard, HasKeyGuard } from '../guards';

import { GetUser } from '../decorators';

import { TransactionsService } from './transactions.service';

import {
  CreateTransactionDto,
  TransactionDto,
  TransactionFullDto,
  TransactionToSignDto,
} from './dto';

@ApiTags('Transactions')
@Controller('transactions')
@UseGuards(JwtBlackListAuthGuard, JwtAuthGuard, VerifiedUserGuard)
export class TransactionsController {
  constructor(private transactionsService: TransactionsService) {}

  /* Submit a transaction */
  @ApiOperation({
    summary: 'Create a transaction',
    description: 'Create a transaction for the organization to approve, sign, and execute.',
  })
  @ApiResponse({
    status: 201,
    type: TransactionDto,
  })
  @UseGuards(HasKeyGuard)
  @Post()
  @Serialize(TransactionDto)
  @OnlyOwnerKey<CreateTransactionDto>('creatorKeyId')
  async createTransaction(
    @Body() body: CreateTransactionDto,
    @GetUser() user,
  ): Promise<Transaction> {
    return this.transactionsService.createTransaction(body, user);
  }

  /* Get all transactions visible by the user */
  @ApiOperation({
    summary: 'Get created transactions by user or transactions with specific status',
    description:
      'Get all transactions that were created by the current user or all transactions that are with the provided status.',
  })
  @ApiResponse({
    status: 200,
  })
  @Get()
  @Serialize(withPaginatedResponse(TransactionDto))
  getTransactions(
    @GetUser() user: User,
    @PaginationParams() paginationParams: Pagination,
    @SortingParams(transactionProperties) sort?: Sorting[],
    @FilteringParams({
      validProperties: transactionProperties,
      dateProperties: transactionDateProperties,
    })
    filter?: Filtering[],
  ): Promise<PaginatedResourceDto<Transaction>> {
    return this.transactionsService.getTransactions(user, paginationParams, sort, filter);
  }

  /* Get all transactions visible by the user */
  @ApiOperation({
    summary: 'Get the history transactions',
    description: 'Get all transactions that were executed, failed or expired',
  })
  @ApiResponse({
    status: 200,
  })
  @Get('/history')
  @Serialize(withPaginatedResponse(TransactionDto))
  getHistoryTransactions(
    @PaginationParams() paginationParams: Pagination,
    @SortingParams(transactionProperties) sort?: Sorting[],
    @FilteringParams({
      validProperties: transactionProperties,
      dateProperties: transactionDateProperties,
    })
    filter?: Filtering[],
  ): Promise<PaginatedResourceDto<Transaction>> {
    return this.transactionsService.getHistoryTransactions(paginationParams, filter, sort);
  }

  /* Get all transactions to be signed by the user */
  @ApiOperation({
    summary: 'Get transactions to sign',
    description: 'Get all transactions to be signed by the current user.',
  })
  @ApiResponse({
    status: 200,
  })
  @Get('/sign')
  @Serialize(withPaginatedResponse(TransactionToSignDto))
  getTransactionsToSign(
    @GetUser() user: User,
    @PaginationParams() paginationParams: Pagination,
    @SortingParams(transactionProperties) sort?: Sorting[],
    @FilteringParams({
      validProperties: transactionProperties,
      dateProperties: transactionDateProperties,
    })
    filter?: Filtering[],
  ) {
    return this.transactionsService.getTransactionsToSign(user, paginationParams, sort, filter);
  }

  /* Returns whether a user should sign a transaction with id */
  @ApiOperation({
    summary: 'Check if the current user should sign the transaction with the provided id',
    description: 'Check if the current user should sign the transaction with the provided id.',
  })
  @ApiResponse({
    status: 200,
    type: [Number],
  })
  @Get('/sign/:transactionId')
  async shouldSignTransaction(
    @GetUser() user: User,
    @Param('transactionId', ParseIntPipe) transactionId: number,
  ): Promise<number[]> {
    const transaction = await this.transactionsService.getTransactionById(transactionId);
    return this.transactionsService.userKeysToSign(transaction, user);
  }

  /* Get all transactions to be approved by the user */
  @ApiOperation({
    summary: 'Get transactions to approve',
    description: 'Get all transactions to be approved by the current user.',
  })
  @ApiResponse({
    status: 200,
    type: [TransactionDto],
  })
  @Serialize(withPaginatedResponse(TransactionDto))
  @Get('/approve')
  getTransactionsToApprove(
    @GetUser() user: User,
    @PaginationParams() paginationParams: Pagination,
    @SortingParams(transactionProperties) sort?: Sorting[],
    @FilteringParams({
      validProperties: transactionProperties,
      dateProperties: transactionDateProperties,
    })
    filter?: Filtering[],
  ) {
    return this.transactionsService.getTransactionsToApprove(user, paginationParams, sort, filter);
  }

  /* Returns whether a user should approve a transaction with id */
  @ApiOperation({
    summary: 'Check if the current user should approve the transaction with the provided id',
    description: 'Check if the current user should approve the transaction with the provided id.',
  })
  @ApiResponse({
    status: 200,
    type: [Number],
  })
  @Get('/approve/:transactionId')
  async shouldApproveTransaction(
    @GetUser() user: User,
    @Param('transactionId', ParseIntPipe) transactionId: number,
  ): Promise<boolean> {
    return this.transactionsService.shouldApproveTransaction(transactionId, user);
  }

  @ApiOperation({
    summary: 'Cancel a transaction',
    description: 'Cancel a transaction if the valid start date is in the future.',
  })
  @ApiResponse({
    status: 200,
    type: Boolean,
  })
  @Patch('/cancel/:id')
  async cancelTransaction(
    @GetUser() user,
    @Param('id', ParseIntPipe) id: number,
  ): Promise<boolean> {
    return this.transactionsService.cancelTransaction(id, user);
  }

  @ApiOperation({
    summary: 'Archives a transaction',
    description: 'Archive a transaction that is marked as sign only',
  })
  @ApiResponse({
    status: 200,
    type: Boolean,
  })
  @Patch('/archive/:id')
  async archiveTransaction(
    @GetUser() user,
    @Param('id', ParseIntPipe) id: number,
  ): Promise<boolean> {
    return this.transactionsService.archiveTransaction(id, user);
  }

  @ApiOperation({
    summary: 'Send a transaction for execution',
    description: 'Send a manual transaction to the chain service that will execute it',
  })
  @ApiResponse({
    status: 200,
    type: Boolean,
  })
  @Patch('/execute/:id')
  async executeTransaction(
    @GetUser() user,
    @Param('id', ParseIntPipe) id: number,
  ): Promise<boolean> {
    return this.transactionsService.executeTransaction(id, user);
  }

  @ApiOperation({
    summary: 'Get a transaction',
    description: 'Get the transaction for the given transaction id.',
  })
  @ApiResponse({
    status: 200,
    type: TransactionFullDto,
  })
  @Get('/:id')
  @Serialize(TransactionFullDto)
  async getTransaction(
    @GetUser() user,
    @Param('id', ParseIntPipe) id: number,
  ): Promise<Transaction> {
    return this.transactionsService.getTransactionWithVerifiedAccess(id, user);
  }

  @ApiOperation({
    summary: 'Deletes a transaction',
    description: 'Deletes the transaction for the given transaction id.',
  })
  @ApiResponse({
    status: 200,
    type: Boolean,
  })
  @Delete('/:id')
  deleteTransaction(@GetUser() user, @Param('id', ParseIntPipe) id: number): Promise<boolean> {
    return this.transactionsService.removeTransaction(id, user, true);
  }
}
