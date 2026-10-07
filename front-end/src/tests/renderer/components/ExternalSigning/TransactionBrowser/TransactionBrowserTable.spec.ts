// @vitest-environment happy-dom
import { describe, expect, test } from 'vitest';
import { mount } from '@vue/test-utils';

import TransactionBrowserTable from '@renderer/components/ExternalSigning/TransactionBrowser/TransactionBrowserTable.vue';
import { TransactionBrowserEntry } from '@renderer/components/ExternalSigning/TransactionBrowser/TransactionBrowserEntry';

/* ── Fixtures ────────────────────────────────────────────────────────────── */

// transaction/signatureAudit are null (decoding not exercised here); only
// item.description is used to identify which entry the details view resolved to.
function makeEntries(count: number): TransactionBrowserEntry[] {
  return Array.from(
    { length: count },
    (_, i) =>
      new TransactionBrowserEntry(
        {
          name: `name-${i}`,
          description: `entry-${i}`,
          transactionBytes: '00',
          creatorEmail: 'someone@example.com',
        },
        null,
        null,
        [],
      ),
  );
}

/* ── Stubs ───────────────────────────────────────────────────────────────── */

// Forwards attrs (incl. data-testid and native click) so Details buttons stay selectable.
const AppButtonStub = {
  template: '<button v-bind="$attrs"><slot /></button>',
};

// Reports which entry the resolved currentIndex actually points to, which is exactly
// what the page-offset double-add bug got wrong from page 2 onward.
const TransactionBrowserPageStub = {
  props: ['entries', 'show', 'currentIndex'],
  template:
    '<div data-testid="details-stub">{{ entries[currentIndex]?.item.description ?? "none" }}</div>',
};

function mountTable(entryCount: number) {
  return mount(TransactionBrowserTable, {
    props: { entries: makeEntries(entryCount) },
    global: {
      stubs: {
        AppButton: AppButtonStub,
        TransactionId: { template: '<span />' },
        DateTimeString: { template: '<span />' },
        TransactionBrowserPage: TransactionBrowserPageStub,
      },
    },
  });
}

/* ── Tests ───────────────────────────────────────────────────────────────── */

describe('TransactionBrowserTable - details index regression', () => {
  test('clicking a row on page 1 opens the details for that row', async () => {
    const wrapper = mountTable(25);

    await wrapper
      .find('[data-testid="button-external-transaction-details-0"]')
      .trigger('click');

    expect(wrapper.find('[data-testid="details-stub"]').text()).toBe('entry-0');
  });

  test('clicking a row on page 2 opens the details for that same row, not one shifted by pageStart', async () => {
    const wrapper = mountTable(25);

    // Navigate to page 2 (pageStart becomes 10)
    const page2 = wrapper.findAll('.page-item').find(item => item.text() === '2');
    expect(page2).toBeTruthy();
    await page2!.trigger('click');

    // First row of page 2 is global entry index 10 ("entry-10")
    const button = wrapper.find('[data-testid="button-external-transaction-details-10"]');
    expect(button.exists()).toBe(true);
    await button.trigger('click');

    // Regression: a buggy double pageStart add (pageStart + (pageStart + localIndex))
    // would resolve this to entry-20 instead of entry-10.
    expect(wrapper.find('[data-testid="details-stub"]').text()).toBe('entry-10');
  });

  test('clicking the last row on page 2 does not overflow past the end of the entries array', async () => {
    const wrapper = mountTable(25);

    const page2 = wrapper.findAll('.page-item').find(item => item.text() === '2');
    await page2!.trigger('click');

    // Last row of page 2 is global entry index 19 ("entry-19")
    const button = wrapper.find('[data-testid="button-external-transaction-details-19"]');
    await button.trigger('click');

    expect(wrapper.find('[data-testid="details-stub"]').text()).toBe('entry-19');
  });
});
