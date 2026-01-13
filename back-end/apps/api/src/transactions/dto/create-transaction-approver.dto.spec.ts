import 'reflect-metadata'
import { plainToInstance } from 'class-transformer'
import { validateSync } from 'class-validator'

import {
  CreateTransactionApproverDto,
  CreateTransactionApproversArrayDto,
} from './create-transaction-approver.dto'

const toApproverDto = (plain: Record<string, unknown>) =>
  plainToInstance(CreateTransactionApproverDto, plain, { enableImplicitConversion: true })

const toApproversArrayDto = (plain: Record<string, unknown>) =>
  plainToInstance(CreateTransactionApproversArrayDto, plain, { enableImplicitConversion: true })

describe('CreateTransactionApproverDto', () => {
  test('maps plain object -> CreateTransactionApproverDto and converts nested approvers', () => {
    const plain = {
      listId: '10',
      threshold: '2',
      userId: '5',
      approvers: [{ userId: '6', threshold: '1' }],
    }

    const dto = toApproverDto(plain)

    expect(dto).toBeInstanceOf(CreateTransactionApproverDto)
    expect((dto as any).listId).toBe(10)
    expect((dto as any).threshold).toBe(2)
    expect((dto as any).userId).toBe(5)

    expect(Array.isArray((dto as any).approvers)).toBe(true)
    expect((dto as any).approvers[0]).toBeInstanceOf(CreateTransactionApproverDto)
    expect((dto as any).approvers[0].userId).toBe(6)
    expect((dto as any).approvers[0].threshold).toBe(1)

    const errors = validateSync(dto as any)
    expect(errors.length).toBe(0)
  })

  test('validation fails when approvers is provided but empty (ArrayMinSize(1))', () => {
    const plain = {
      approvers: [],
    }

    const dto = toApproverDto(plain)
    const errors = validateSync(dto as any)
    expect(errors.length).toBeGreaterThan(0)
  })
})

describe('CreateTransactionApproversArrayDto', () => {
  test('maps wrapper object -> CreateTransactionApproversArrayDto and converts nested approversArray', () => {
    const plain = {
      approversArray: [{ listId: '1', userId: '2' }],
    }

    const dto = toApproversArrayDto(plain)

    expect(dto).toBeInstanceOf(CreateTransactionApproversArrayDto)
    expect(Array.isArray((dto as any).approversArray)).toBe(true)
    expect((dto as any).approversArray[0]).toBeInstanceOf(CreateTransactionApproverDto)
    expect((dto as any).approversArray[0].listId).toBe(1)
    expect((dto as any).approversArray[0].userId).toBe(2)

    const errors = validateSync(dto as any)
    expect(errors.length).toBe(0)
  })

  test('validation fails when approversArray is missing', () => {
    const plain = {}
    const dto = toApproversArrayDto(plain)
    const errors = validateSync(dto as any)
    expect(errors.length).toBeGreaterThan(0)
  })
})
