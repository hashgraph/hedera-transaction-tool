// @vitest-environment happy-dom
import { describe, test, expect, vi } from 'vitest';

vi.mock('@renderer/pages/SmartContracts', () => ({ default: { name: 'SmartContractsPage' } }));
vi.mock('@renderer/pages/SmartContracts/AddSmartContract', () => ({
  default: { name: 'AddSmartContractPage' },
}));

import router from '@renderer/router';

describe('router - smart contract routes', () => {
  test('registers /smart-contracts and /smart-contracts/add with lazy page loaders', async () => {
    const list = router.getRoutes().find(r => r.name === 'smartContracts')!;
    const add = router.getRoutes().find(r => r.name === 'addSmartContract')!;
    expect(list.path).toBe('/smart-contracts');
    expect(add.path).toBe('/smart-contracts/add');

    const listLoader = list.components!.default as () => Promise<{ default: { name: string } }>;
    const addLoader = add.components!.default as () => Promise<{ default: { name: string } }>;
    expect((await listLoader()).default.name).toBe('SmartContractsPage');
    expect((await addLoader()).default.name).toBe('AddSmartContractPage');
  });

  test('resolves both paths to their named routes', () => {
    expect(router.resolve('/smart-contracts').name).toBe('smartContracts');
    expect(router.resolve('/smart-contracts/add').name).toBe('addSmartContract');
  });
});
