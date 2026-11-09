// @vitest-environment happy-dom
import { describe, test, expect } from 'vitest';

import createMapping, {
  transactionTypeKeys as createKeys,
} from '@renderer/components/Transaction/Create/txTypeComponentMapping';
import detailsMapping, {
  transactionTypeKeys as detailsKeys,
} from '@renderer/components/Transaction/Details/txTypeComponentMapping';
import ContractExecute from '@renderer/components/Transaction/Create/ContractExecute';
import ContractExecuteDetails from '@renderer/components/Transaction/Details/ContractExecuteDetails.vue';

describe('txTypeComponentMapping - contract execute', () => {
  test('create mapping resolves ContractExecuteTransaction to the create form', () => {
    expect(createKeys.contractExecute).toBe('ContractExecuteTransaction');
    expect(createMapping['ContractExecuteTransaction']).toBe(ContractExecute);
  });

  test('details mapping resolves ContractExecuteTransaction to the details view', () => {
    expect(detailsKeys.contractExecute).toBe('ContractExecuteTransaction');
    expect(detailsMapping['ContractExecuteTransaction']).toBe(ContractExecuteDetails);
  });
});
