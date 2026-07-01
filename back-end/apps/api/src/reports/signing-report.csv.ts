import { SigningReportItemDto } from './dto/signing-report.dto';

// Column order for the CSV rendering — mirrors SigningReportItemDto.
const COLUMNS: (keyof SigningReportItemDto)[] = [
  'transactionId',
  'createdAt',
  'validStart',
  'executedAt',
  'entityType',
  'entityId',
  'publicKey',
  'userId',
  'userEmail',
  'signingStatus',
];

// Serializes a single cell:
// 1. Neutralizes spreadsheet formula injection — a cell starting with =, +, -,
//    @, tab, or CR can be executed as a formula by Excel/Sheets, so prefix it
//    with a single quote to force text. Fields like userEmail are user-supplied.
// 2. RFC 4180: quote fields containing a comma, quote, or newline; double
//    embedded quotes. null/undefined render as empty.
function escape(value: unknown): string {
  if (value === null || value === undefined) return '';
  let str = String(value);
  if (/^[=+\-@\t\r]/.test(str)) str = `'${str}`;
  return /[",\r\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
}

/** Renders the report rows as a CSV document (header row + one line per entry). */
export function toCsv(rows: SigningReportItemDto[]): string {
  const header = COLUMNS.join(',');
  const lines = rows.map(row => COLUMNS.map(column => escape(row[column])).join(','));
  return [header, ...lines].join('\r\n') + '\r\n';
}
