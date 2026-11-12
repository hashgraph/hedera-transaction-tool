// @vitest-environment happy-dom
import { describe, expect, test } from 'vitest';

import SmartContractsIndex from '@renderer/pages/SmartContracts';
import AddSmartContractIndex from '@renderer/pages/SmartContracts/AddSmartContract';
import SmartContracts from '@renderer/pages/SmartContracts/SmartContracts.vue';
import AddSmartContract from '@renderer/pages/SmartContracts/AddSmartContract/AddSmartContract.vue';

describe('SmartContracts index re-exports', () => {
  test('default exports are the page components', () => {
    expect(SmartContractsIndex).toBe(SmartContracts);
    expect(AddSmartContractIndex).toBe(AddSmartContract);
  });
});
