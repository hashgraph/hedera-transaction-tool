import 'reflect-metadata'
import { plainToInstance } from 'class-transformer'
import { validateSync } from 'class-validator'
import { UploadUserKeyDto } from './upload-user-key.dto'

const toDto = (plain: Record<string, unknown>) =>
  plainToInstance(UploadUserKeyDto, plain, { enableImplicitConversion: false })

describe('UploadUserKeyDto', () => {
  test('valid: minimal -- only publicKey', () => {
    const errors = validateSync(toDto({ publicKey: 'pubkey' }))
    expect(errors.length).toBe(0)
  })

  test('valid: both mnemonicHash and index present with publicKey', () => {
    const errors = validateSync(toDto({ mnemonicHash: 'mnemonic-hash', index: 0, publicKey: 'pubkey' }))
    expect(errors.length).toBe(0)
  })

  test('invalid: mnemonicHash provided without index -> index error', () => {
    const errors = validateSync(toDto({ mnemonicHash: 'mnemonic-hash', publicKey: 'pubkey' }))
    expect(errors.length).toBeGreaterThan(0)
    expect(errors.some(e => e.property === 'index')).toBe(true)
  })

  test('invalid: index provided without mnemonicHash -> mnemonicHash error', () => {
    const errors = validateSync(toDto({ index: 1, publicKey: 'pubkey' }))
    expect(errors.length).toBeGreaterThan(0)
    expect(errors.some(e => e.property === 'mnemonicHash')).toBe(true)
  })

  test('invalid: missing publicKey', () => {
    const errors = validateSync(toDto({}))
    expect(errors.length).toBeGreaterThan(0)
    expect(errors.some(e => e.property === 'publicKey')).toBe(true)
  })

  test('invalid: index wrong type (string) when mnemonicHash present', () => {
    const errors = validateSync(toDto({ mnemonicHash: 'mnemonic-hash', index: 'not-a-number', publicKey: 'pubkey' }))
    expect(errors.length).toBeGreaterThan(0)
    expect(errors.some(e => e.property === 'index')).toBe(true)
  })
})
