import { Body, Controller, Get, Param, ParseIntPipe, Post, Query, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';

import { Serialize } from '@app/common';

import { Transaction, TransactionStatus, User } from '@entities';

import { JwtAuthGuard, VerifiedUserGuard, HasKeyGuard } from '../guards';

import { GetUser } from '../decorators/get-user.decorator';

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
  createTransaction(@Body() body: CreateTransactionDto, @GetUser() user): Promise<Transaction> {
    return this.transactionsService.createTransaction(body, user);
  }

  /* Get all transactions created by the user */
  @ApiOperation({
    summary: 'Get created transactions',
    description: 'Get all transactions that were created by the current user.',
  })
  @ApiResponse({
    status: 200,
    type: [TransactionDto],
  })
  @Get()
  @Serialize(TransactionDto)
  getTransactions(
    @GetUser() user: User,
    @Query('take', ParseIntPipe) take: number,
    @Query('skip', ParseIntPipe) skip: number,
  ): Promise<Transaction[]> {
    return this.transactionsService.getTransactions(user, take, skip);
  }

  /* Get the count of all transactions to be signed by the user */
  @ApiOperation({
    summary: 'Get transactions to sign',
    description: 'Get all transactions to be signed by the current user.',
  })
  @ApiResponse({
    status: 200,
    type: Number,
  })
  @Get('/sign/count')
  @Serialize(TransactionToSignDto)
  getTransactionsToSignCount(@GetUser() user: User) {
    return this.transactionsService.getTransactionsToSignCount(user);
  }

  /* Get all transactions to be signed by the user */
  @ApiOperation({
    summary: 'Get transactions to sign',
    description: 'Get all transactions to be signed by the current user.',
  })
  @ApiResponse({
    status: 200,
    type: [TransactionToSignDto],
  })
  @Get('/sign')
  @Serialize(TransactionToSignDto)
  getTransactionsToSign(
    @GetUser() user: User,
    @Query('take', ParseIntPipe) take: number,
    @Query('skip', ParseIntPipe) skip: number,
  ) {
    return this.transactionsService.getTransactionsToSign(user, take, skip);
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
    return this.transactionsService.userKeysRequiredToSign(transaction, user);
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

  /* Get all transactions that the user is part of and has signed */
  @ApiOperation({
    summary: 'Get transactions that are in progress',
    description:
      'Get transactions that has been signed by the user and are waiting for other signatures',
  })
  @ApiResponse({
    status: 200,
    type: [TransactionDto],
  })
  @Get('/in-progress')
  @Serialize(TransactionDto)
  getTransactionsInProgressForUser(
    @GetUser() user: User,
    @Query('take', ParseIntPipe) take: number,
    @Query('skip', ParseIntPipe) skip: number,
  ) {
    return this.transactionsService.getTransactionsForUserWithStatus(
      user,
      TransactionStatus.WAITING_FOR_SIGNATURES,
      take,
      skip,
    );
  }

  /* Get the count of transactions that the user is part of and has signed */
  @ApiOperation({
    summary: 'Get the count of transactions that are in progress and user has signed',
    description:
      'Get transactions that has been signed by the user and are waiting for other signatures',
  })
  @ApiResponse({
    status: 200,
    type: Number,
  })
  @Get('/in-progress/count')
  getTransactionsInProgressForUserCount(@GetUser() user: User) {
    return this.transactionsService.getTransactionsForUserWithStatusCount(
      user,
      TransactionStatus.WAITING_FOR_SIGNATURES,
    );
  }

  /* Get all transactions that the user is part of user and are ready to execute */
  @ApiOperation({
    summary: 'Get transactions that are ready to execute',
    description:
      'Get transactions that has been signed by the user and are waiting for other signatures',
  })
  @ApiResponse({
    status: 200,
    type: [TransactionDto],
  })
  @Get('/ready-to-execute')
  @Serialize(TransactionDto)
  getTransactionsReadyToExecuteForUser(
    @GetUser() user: User,
    @Query('take', ParseIntPipe) take: number,
    @Query('skip', ParseIntPipe) skip: number,
  ) {
    return this.transactionsService.getTransactionsForUserWithStatus(
      user,
      TransactionStatus.WAITING_FOR_EXECUTION,
      take,
      skip,
    );
  }

  /* Get the count of transactions that the user is part of user and are ready to execute */
  @ApiOperation({
    summary: 'Get the count of transactions that are ready to execute and user has signed',
    description:
      'Get transactions that has been signed by the user and are waiting for other signatures',
  })
  @ApiResponse({
    status: 200,
    type: Number,
  })
  @Get('/ready-to-execute/count')
  getTransactionsReadyToExecuteForUserCount(@GetUser() user: User) {
    return this.transactionsService.getTransactionsForUserWithStatusCount(
      user,
      TransactionStatus.WAITING_FOR_EXECUTION,
    );
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
}
