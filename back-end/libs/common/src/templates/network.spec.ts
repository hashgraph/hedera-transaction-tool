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

  describe('HTML injection prevention', () => {
    it('escapes script tags in network value', () => {
      const result = buildNetworkBreakdown([makeNotification('<script>alert(1)</script>')]);
      expect(result).not.toContain('<script>');
      expect(result).not.toContain('</script>');
      expect(result).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
    });

    it('escapes img onerror injection', () => {
      const result = buildNetworkBreakdown([makeNotification('<img src=x onerror=alert(1)>')]);
      expect(result).not.toContain('<img');
      expect(result).toContain('&lt;img src=x onerror=alert(1)&gt;');
    });

    it('escapes bold/italic HTML tags', () => {
      const result = buildNetworkBreakdown([makeNotification('<b>bad</b>')]);
      expect(result).not.toContain('<b>');
      expect(result).toContain('&lt;b&gt;bad&lt;/b&gt;');
    });

    it('escapes anchor tags with href', () => {
      const result = buildNetworkBreakdown([makeNotification('<a href="https://evil.com">click</a>')]);
      expect(result).not.toContain('<a ');
      expect(result).toContain('&lt;a href=&quot;https://evil.com&quot;&gt;click&lt;/a&gt;');
    });

    it('escapes event handler attributes', () => {
      const result = buildNetworkBreakdown([makeNotification('" onmouseover="alert(1)')]);
      expect(result).not.toContain('" onmouseover');
      expect(result).toContain('&quot; onmouseover=&quot;alert(1)');
    });

    it('escapes ampersands and special characters', () => {
      const result = buildNetworkBreakdown([makeNotification('test&net<>"\'')] );
      expect(result).toContain('Test&amp;net&lt;&gt;&quot;&#39;');
    });

    it('still counts and pluralizes correctly with escaped content', () => {
      const result = buildNetworkBreakdown([
        makeNotification('<script>x</script>'),
        makeNotification('<script>x</script>'),
        makeNotification('<script>x</script>'),
      ]);
      expect(result).toContain('<strong>3</strong> transactions on');
    });
  });
});
