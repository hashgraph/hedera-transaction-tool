import { SigningEntityType, SigningReportItemDto, SigningStatus } from './dto/signing-report.dto';
import { toCsv } from './signing-report.csv';

function row(overrides: Partial<SigningReportItemDto> = {}): SigningReportItemDto {
  return {
    transactionId: '0.0.1001@1700000000.000000000',
    createdAt: '2026-01-01T00:00:00.000Z',
    validStart: '2026-01-01T00:00:01.000Z',
    executedAt: '2026-01-01T00:00:02.000Z',
    entityType: SigningEntityType.ACCOUNT,
    entityId: '0.0.100',
    publicKey: 'pk_alice',
    userId: 7,
    userEmail: 'alice@example.com',
    signingStatus: SigningStatus.SIGNED,
    ...overrides,
  };
}

describe('toCsv', () => {
  it('emits a header row even with no data', () => {
    expect(toCsv([])).toBe(
      'transactionId,createdAt,validStart,executedAt,entityType,entityId,publicKey,userId,userEmail,signingStatus\r\n',
    );
  });

  it('writes one CRLF-terminated line per row in column order', () => {
    const csv = toCsv([row()]);
    const lines = csv.trimEnd().split('\r\n');
    expect(lines).toHaveLength(2);
    expect(lines[1]).toBe(
      '0.0.1001@1700000000.000000000,2026-01-01T00:00:00.000Z,2026-01-01T00:00:01.000Z,2026-01-01T00:00:02.000Z,ACCOUNT,0.0.100,pk_alice,7,alice@example.com,SIGNED',
    );
  });

  it('renders null/absent user fields as empty', () => {
    const csv = toCsv([row({ executedAt: null, userId: null, userEmail: null })]);
    const line = csv.trimEnd().split('\r\n')[1];
    expect(line).toContain(',ACCOUNT,'); // executedAt blank before entityType
    expect(line.endsWith(',,,SIGNED')).toBe(true); // userId, userEmail blank
  });

  it('escapes commas, quotes, and newlines per RFC 4180', () => {
    // Embedded LF doesn't collide with the CRLF row terminator, so a plain split works.
    const csv = toCsv([row({ userEmail: 'a,b"c\nd' })]);
    const dataLine = csv.trimEnd().split('\r\n')[1];
    expect(dataLine).toContain('"a,b""c\nd"');
  });
});
