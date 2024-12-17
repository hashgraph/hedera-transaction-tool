import { mockDeep } from 'vitest-mock-extended';

import listenForThemeEvents from '@main/modules/ipcHandlers/theme';
import listenForUtilsEvents from '@main/modules/ipcHandlers/utils';
import listenForLocalUserEvents from '@main/modules/ipcHandlers/localUser';
import listenForUpdateEvents from '@main/modules/ipcHandlers/update';
import registerListeners from '@main/modules/ipcHandlers/index';

vi.mock('@main/modules/ipcHandlers/theme', () => mockDeep());
vi.mock('@main/modules/ipcHandlers/utils', () => mockDeep());
vi.mock('@main/modules/ipcHandlers/localUser', () => mockDeep());
vi.mock('@main/modules/ipcHandlers/update', () => mockDeep());

describe('index', () => {
  test('should call all event listeners', () => {
    registerListeners();

    expect(listenForThemeEvents).toHaveBeenCalled();
    expect(listenForUtilsEvents).toHaveBeenCalled();
    expect(listenForLocalUserEvents).toHaveBeenCalled();
    expect(listenForUpdateEvents).toHaveBeenCalled();
  });
});
