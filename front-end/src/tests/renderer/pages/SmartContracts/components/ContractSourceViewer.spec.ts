// @vitest-environment happy-dom
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';

const mocks = vi.hoisted(() => ({
  createHighlighterCore: vi.fn(),
}));

vi.mock('shiki/core', () => ({
  createHighlighterCore: mocks.createHighlighterCore,
}));
vi.mock('shiki/engine/javascript', () => ({
  createJavaScriptRegexEngine: vi.fn(() => ({})),
}));
vi.mock('shiki/langs/solidity.mjs', () => ({ default: {} }));
vi.mock('shiki/themes/github-light.mjs', () => ({ default: {} }));

const sources = [
  { path: 'lib/Imported.sol', content: 'import line' },
  { path: 'contracts/Token.sol', content: 'line one\nline two' },
];

// The highlighter promise is cached at module scope, so each test gets a fresh module.
async function mountViewer(props: Partial<{ contractName: string; sources: typeof sources }> = {}) {
  vi.resetModules();
  const { default: ContractSourceViewer } = await import(
    '@renderer/pages/SmartContracts/components/ContractSourceViewer.vue'
  );
  const wrapper = mount(ContractSourceViewer, {
    props: { contractName: 'Token', sources, ...props },
  });
  await flushPromises();
  return wrapper;
}

const renderedLines = (wrapper: Awaited<ReturnType<typeof mountViewer>>) =>
  wrapper.findAll('tbody tr').map(tr => tr.findAll('td')[1].text());

describe('ContractSourceViewer.vue', () => {
  beforeEach(() => {
    mocks.createHighlighterCore.mockReset();
  });

  test('lands on the contract-named file rather than the first listed source', async () => {
    mocks.createHighlighterCore.mockResolvedValue({
      codeToTokensBase: vi.fn((code: string) => code.split('\n').map(l => [{ content: l }])),
    });
    const wrapper = await mountViewer();

    const select = wrapper.find('[data-testid="select-contract-source-file"]');
    expect((select.element as HTMLSelectElement).value).toBe('contracts/Token.sol');
    expect(select.findAll('option').map(o => o.text())).toEqual([
      'lib/Imported.sol',
      'contracts/Token.sol',
    ]);
    expect(renderedLines(wrapper)).toEqual(['line one', 'line two']);
  });

  test('renders highlighted tokens with their colors and numbered lines', async () => {
    const codeToTokensBase = vi.fn(() => [[{ content: 'contract', color: '#ff0000' }, { content: ' X' }]]);
    mocks.createHighlighterCore.mockResolvedValue({ codeToTokensBase });
    const wrapper = await mountViewer();

    expect(codeToTokensBase).toHaveBeenCalledWith('line one\nline two', {
      lang: 'solidity',
      theme: 'github-light',
    });
    const spans = wrapper.findAll('tbody tr span');
    expect(spans[0].text()).toBe('contract');
    expect(spans[0].attributes('style')).toContain('color');
    expect(wrapper.find('tbody tr td').text()).toBe('1');
  });

  test('lands on a root-level contract-named file (no directory prefix)', async () => {
    mocks.createHighlighterCore.mockRejectedValue(new Error('no wasm'));
    const wrapper = await mountViewer({
      sources: [
        { path: 'Imported.sol', content: 'import line' },
        { path: 'Token.sol', content: 'root-level contract' },
      ],
    });

    const select = wrapper.find('[data-testid="select-contract-source-file"]');
    expect((select.element as HTMLSelectElement).value).toBe('Token.sol');
    expect(renderedLines(wrapper)).toEqual(['root-level contract']);
  });

  test('falls back to the first source when none matches the contract name', async () => {
    mocks.createHighlighterCore.mockRejectedValue(new Error('no wasm'));
    const wrapper = await mountViewer({ contractName: 'Missing' });

    expect((wrapper.find('select').element as HTMLSelectElement).value).toBe('lib/Imported.sol');
    expect(renderedLines(wrapper)).toEqual(['import line']);
  });

  test('shows plain unstyled lines when the highlighter fails to load', async () => {
    mocks.createHighlighterCore.mockRejectedValue(new Error('boom'));
    const wrapper = await mountViewer();

    expect(renderedLines(wrapper)).toEqual(['line one', 'line two']);
  });

  test('shows plain lines when highlighting a file throws', async () => {
    mocks.createHighlighterCore.mockResolvedValue({
      codeToTokensBase: vi.fn(() => {
        throw new Error('bad grammar');
      }),
    });
    const wrapper = await mountViewer();

    expect(renderedLines(wrapper)).toEqual(['line one', 'line two']);
  });

  test('switching the selected file shows that file content', async () => {
    mocks.createHighlighterCore.mockRejectedValue(new Error('boom'));
    const wrapper = await mountViewer();

    await wrapper.find('select').setValue('lib/Imported.sol');
    expect(renderedLines(wrapper)).toEqual(['import line']);
  });

  test('renders nothing and empty selection when there are no sources', async () => {
    mocks.createHighlighterCore.mockRejectedValue(new Error('boom'));
    const wrapper = await mountViewer({ sources: [] });

    expect(wrapper.findAll('tbody tr')).toHaveLength(0);
    expect(wrapper.findAll('option')).toHaveLength(0);
  });

  test('reselects the main file when sources prop changes', async () => {
    mocks.createHighlighterCore.mockRejectedValue(new Error('boom'));
    const wrapper = await mountViewer();

    await wrapper.setProps({ sources: [{ path: 'a/Other.sol', content: 'other' }] });
    expect(renderedLines(wrapper)).toEqual(['other']);
  });
});
