import {
  Body,
  Controller,
  Delete,
  Get,
  Inject,
  Param,
  ParseIntPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';

import {
  CHAIN_SERVICE,
  Filtering,
  FilteringParams,
  PaginatedResourceDto,
  Pagination,
  PaginationParams,
  Serialize,
  Sorting,
  SortingParams,
  TransactionExecutedDto,
  withPaginatedResponse,
} from '@app/common';

import { Transaction, User, transactionDateProperties, transactionProperties } from '@entities';

import { JwtAuthGuard, VerifiedUserGuard, HasKeyGuard } from '../guards';

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
@UseGuards(JwtAuthGuard, VerifiedUserGuard)
export class TransactionsController {
  constructor(
    private transactionsService: TransactionsService,
    @Inject(CHAIN_SERVICE) private readonly chainService: ClientProxy,
  ) {}

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
  createTransaction(@Body() body: CreateTransactionDto, @GetUser() user): Promise<Transaction> {
    return this.transactionsService.createTransaction(body, user);
  }

  /* Get all transactions created by the user */
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
  ) {
    return this.transactionsService.getTransactionsToSign(user, paginationParams, sort);
  }

  /* Returns a flag whether a user should sign a transaction with id */
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
  @Get('/approve')
  getTransactionsToApprove(
    @GetUser() user: User,
    @Query('take', ParseIntPipe) take: number,
    @Query('skip', ParseIntPipe) skip: number,
  ): Promise<Transaction[]> {
    return this.transactionsService.getTransactionsToApprove(user, take, skip);
  }

  /* Get all transactions to be observed by the user */
  @ApiOperation({
    summary: 'Get transactions to observe',
    description: 'Get all transactions to be observed by the current user.',
  })
  @ApiResponse({
    status: 200,
    type: [TransactionDto],
  })
  @Get('/observe')
  getTransactionsToObserve(
    @GetUser() user: User,
    @Query('take', ParseIntPipe) take: number,
    @Query('skip', ParseIntPipe) skip: number,
  ): Promise<Transaction[]> {
    return this.transactionsService.getTransactionsToObserve(user, take, skip);
  }

  /* TEMPORARY: EMIT EVENT TO EXECUTE TRANSACTION */
  @ApiOperation({
    summary: 'Execute a transaction',
    description: 'Emit an event to execute a transaction.',
  })
  @ApiResponse({
    status: 200,
    type: TransactionExecutedDto,
  })
  @Get('execute/:id')
  async emitExecute(@Param('id', ParseIntPipe) id: number): Promise<TransactionExecutedDto> {
    return await this.chainService.send('execute', id).toPromise();
  }

  @ApiOperation({
    summary: 'Get a transaction',
    description: 'Get the transaction for the given transaction id.',
  })
  @ApiResponse({
    status: 200,
    type: TransactionDto,
  })
  @Get('/:id')
  @Serialize(TransactionFullDto)
  getTransaction(@Param('id', ParseIntPipe) id: number): Promise<Transaction> {
    return this.transactionsService.getTransactionById(id);
  }

  @ApiOperation({
    summary: 'Deletes a transaction',
    description: 'Deletes the transaction for the given transaction id.',
  })
  @ApiResponse({
    status: 200,
  })
  @Delete('/:id')
  deleteTransaction(@GetUser() user, @Param('id', ParseIntPipe) id: number): Promise<boolean> {
    return this.transactionsService.removeTransaction(id, user);
  }
}
