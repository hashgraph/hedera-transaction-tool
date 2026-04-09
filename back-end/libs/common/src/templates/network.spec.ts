import { buildNetworkBreakdown } from './network';
import { Notification } from '@entities';

jest.mock('@app/common/templates/index', () => ({
  getNetworkString: jest.fn((network: string) => {
    if (!network) return '';
    return network.charAt(0).toUpperCase() + network.slice(1).toLowerCase();
  }),
}));

const makeNotification = (network?: string) =>
  ({ additionalData: { network } } as unknown as Notification);

describe('buildNetworkBreakdown', () => {
  it('returns empty string for empty input', () => {
    expect(buildNetworkBreakdown([])).toBe('');
  });

  it('returns empty string when no notification has a network', () => {
    expect(buildNetworkBreakdown([{} as Notification])).toBe('');
    expect(buildNetworkBreakdown([makeNotification(undefined)])).toBe('');
    expect(buildNetworkBreakdown([makeNotification('')])).toBe('');
  });

  it('renders a single-network breakdown with singular noun for count 1', () => {
    const result = buildNetworkBreakdown([makeNotification('mainnet')]);
    expect(result).toBe('<strong>1</strong> transaction on Mainnet');
  });

  it('renders a single-network breakdown with plural noun for count > 1', () => {
    const result = buildNetworkBreakdown([
      makeNotification('mainnet'),
      makeNotification('mainnet'),
      makeNotification('mainnet'),
    ]);
    expect(result).toBe('<strong>3</strong> transactions on Mainnet');
  });

  it('joins multiple networks with a comma', () => {
    const result = buildNetworkBreakdown([
      makeNotification('mainnet'),
      makeNotification('mainnet'),
      makeNotification('testnet'),
    ]);
    expect(result).toBe(
      '<strong>2</strong> transactions on Mainnet, <strong>1</strong> transaction on Testnet',
    );
  });

  it('sorts networks by count descending, ties broken alphabetically', () => {
    const result = buildNetworkBreakdown([
      makeNotification('testnet'),
      makeNotification('mainnet'),
      makeNotification('previewnet'),
      makeNotification('mainnet'),
    ]);
    // 2 Mainnet, 1 Previewnet, 1 Testnet → Mainnet first, then Previewnet < Testnet alphabetically
    expect(result).toBe(
      '<strong>2</strong> transactions on Mainnet, <strong>1</strong> transaction on Previewnet, <strong>1</strong> transaction on Testnet',
    );
  });

  it('skips notifications that have no network while still counting the others', () => {
    const result = buildNetworkBreakdown([
      makeNotification('mainnet'),
      {} as Notification,
      makeNotification('mainnet'),
    ]);
    expect(result).toBe('<strong>2</strong> transactions on Mainnet');
  });
});
