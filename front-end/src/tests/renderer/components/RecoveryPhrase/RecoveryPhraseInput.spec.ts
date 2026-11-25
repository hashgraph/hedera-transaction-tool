// @vitest-environment happy-dom
import { describe, test, expect, beforeEach, vi } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { Mnemonic } from '@hiero-ledger/sdk';

const mocks = vi.hoisted(() => ({
  user: {
    recoveryPhrase: null as { words: string[] } | null,
    setRecoveryPhrase: vi.fn(),
  },
}));

vi.mock('@renderer/stores/storeUser', () => ({ default: () => mocks.user }));

import RecoveryPhraseInput from '@renderer/components/RecoveryPhrase/RecoveryPhraseInput.vue';

const wordInputs = (wrapper: ReturnType<typeof mountInput>) =>
  wrapper.findAll('input').map(i => (i.element as HTMLInputElement).value);

function mountInput(props: Record<string, unknown> = {}) {
  return mount(RecoveryPhraseInput, { props });
}

async function generatePhrase() {
  return (await Mnemonic.generate()).toString().split(' ');
}

describe('RecoveryPhraseInput.vue', () => {
  beforeEach(() => {
    mocks.user.recoveryPhrase = null;
    mocks.user.setRecoveryPhrase.mockReset().mockResolvedValue(undefined);
  });

  test('starts with 24 empty words', () => {
    const wrapper = mountInput();

    expect(wordInputs(wrapper)).toEqual(Array(24).fill(''));
  });

  test('shows the words of the recovery phrase that is already set', () => {
    const words = Array.from({ length: 24 }, (_, i) => `word${i}`);
    mocks.user.recoveryPhrase = { words };

    const wrapper = mountInput();

    expect(wordInputs(wrapper)).toEqual(words);
  });

  describe('setWords', () => {
    test('fills the grid with the given words', async () => {
      const words = await generatePhrase();
      const wrapper = mountInput();

      (wrapper.vm as unknown as { setWords: (w: string[]) => void }).setWords(words);
      await flushPromises();

      expect(wordInputs(wrapper)).toEqual(words);
    });

    test('sets the recovery phrase in the store when the words form a valid phrase', async () => {
      const words = await generatePhrase();
      const wrapper = mountInput();

      (wrapper.vm as unknown as { setWords: (w: string[]) => void }).setWords(words);
      await flushPromises();

      expect(mocks.user.setRecoveryPhrase).toHaveBeenCalledWith(words);
    });

    test('clears the recovery phrase in the store when the words are not a valid phrase', async () => {
      mocks.user.recoveryPhrase = { words: ['old'] };
      const wrapper = mountInput();

      (wrapper.vm as unknown as { setWords: (w: string[]) => void }).setWords(
        Array(24).fill('invalid'),
      );
      await flushPromises();

      expect(mocks.user.setRecoveryPhrase).not.toHaveBeenCalled();
      expect(mocks.user.recoveryPhrase).toBeNull();
    });

    test('replaces what was there, so a new phrase can be generated over a pasted one', async () => {
      const first = await generatePhrase();
      const second = await generatePhrase();
      const wrapper = mountInput();
      const { setWords } = wrapper.vm as unknown as { setWords: (w: string[]) => void };

      setWords(first);
      await flushPromises();
      setWords(second);
      await flushPromises();

      expect(wordInputs(wrapper)).toEqual(second);
      expect(mocks.user.setRecoveryPhrase).toHaveBeenLastCalledWith(second);
    });

    test('copies the words, so changing the array afterwards does not change the grid', async () => {
      const words = await generatePhrase();
      const original = [...words];
      const wrapper = mountInput();

      (wrapper.vm as unknown as { setWords: (w: string[]) => void }).setWords(words);
      words[0] = 'changed';
      await flushPromises();

      expect(wordInputs(wrapper)).toEqual(original);
    });
  });

  describe('pasting', () => {
    const paste = async (wrapper: ReturnType<typeof mountInput>, text: string) => {
      Object.defineProperty(navigator, 'clipboard', {
        value: { readText: vi.fn().mockResolvedValue(text) },
        configurable: true,
      });
      await wrapper.findAll('input')[0].trigger('paste');
      await flushPromises();
    };

    test('fills the grid from a comma separated phrase, the format the Copy button produces', async () => {
      const words = await generatePhrase();
      const wrapper = mountInput();

      await paste(wrapper, words.join(', '));

      expect(wordInputs(wrapper)).toEqual(words);
      expect(mocks.user.setRecoveryPhrase).toHaveBeenCalledWith(words);
    });

    test('fills the grid from a space separated phrase', async () => {
      const words = await generatePhrase();
      const wrapper = mountInput();

      await paste(wrapper, words.join(' '));

      expect(wordInputs(wrapper)).toEqual(words);
    });

    test('accepts upper case and line breaks', async () => {
      const words = await generatePhrase();
      const wrapper = mountInput();

      await paste(wrapper, words.join('\n').toUpperCase());

      expect(wordInputs(wrapper)).toEqual(words);
    });
  });
});
