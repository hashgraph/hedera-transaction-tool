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

import { Serialize } from '@app/common';

import { TransactionObserver, User } from '@entities';

import { JwtAuthGuard, VerifiedUserGuard } from '../../guards';

import { GetUser } from '../../decorators/get-user.decorator';

import { ObserversService } from './observers.service';

import {
  TransactionObserverDto,
  CreateTransactionObserversDto,
  UpdateTransactionObserverDto,
} from '../dto/';

@ApiTags('Transaction Observers')
@Controller('transactions/:transactionId?/observers')
@UseGuards(JwtAuthGuard, VerifiedUserGuard)
@Serialize(TransactionObserverDto)
export class ObserversController {
  constructor(private observersService: ObserversService) {}

  /* Create transaction observers for the given transaction id with the user ids */
  @ApiOperation({
    summary: 'Creates transaction observers',
    description: 'Create transaction observers for the given transaction with the provided data.',
  })
  @ApiResponse({
    status: 201,
    type: TransactionObserverDto,
  })
  @Post()
  createTransactionObserver(
    @GetUser() user: User,
    @Param('transactionId', ParseIntPipe) transactionId: number,
    @Body() body: CreateTransactionObserversDto,
  ): Promise<TransactionObserver[]> {
    return this.observersService.createTransactionObservers(user, transactionId, body);
  }

  /* Get all transaction observers for the given transaction id. */
  @ApiOperation({
    summary: 'Get transaction observers for a transaction',
    description: 'Get all transaction observers for the given transaction id.',
  })
  @ApiResponse({
    status: 201,
    type: [TransactionObserverDto],
  })
  @Get()
  getTransactionObserversByTransactionId(
    @GetUser() user: User,
    @Param('transactionId', ParseIntPipe) id: number,
  ): Promise<TransactionObserver[]> {
    return this.observersService.getTransactionObserversByTransactionId(id, user);
  }

  /* Updates the transaction observer. */
  @ApiOperation({
    summary: 'Update a transaction observer',
    description:
      'Update the transaction observer with the provided information for the given transaction observer id.',
  })
  @ApiResponse({
    status: 201,
    type: TransactionObserverDto,
  })
  @Patch('/:id')
  updateTransactionObserver(
    @GetUser() user: User,
    @Param('id', ParseIntPipe) id: number,
    @Body() body: UpdateTransactionObserverDto,
  ): Promise<TransactionObserver> {
    return this.observersService.updateTransactionObserver(id, body, user);
  }

  /* Delete a transaction observer. */
  @ApiOperation({
    summary: 'Delete a transaction observer',
    description: 'Delete the transaction observer for the given transaction observer id.',
  })
  @ApiResponse({
    status: 201,
  })
  @Delete('/:id')
  removeTransactionObserver(@GetUser() user: User, @Param('id', ParseIntPipe) id: number) {
    return this.observersService.removeTransactionObserver(id, user);
  }
}
