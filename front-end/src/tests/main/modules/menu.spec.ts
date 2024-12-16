import { mockDeep } from 'vitest-mock-extended';

import { Menu, shell } from 'electron';
import menuBuilder from '@main/modules/menu';

vi.mock('electron', () => mockDeep());
vi.mock('@main/modules/updater', () => mockDeep());

describe('menuBuilder', () => {
  test('should build menu from template', () => {
    menuBuilder();

    expect(vi.mocked(Menu).buildFromTemplate).toHaveBeenCalled();
    expect(vi.mocked(Menu).setApplicationMenu).toHaveBeenCalled();
  });

  test('should build for non-mac', () => {
    Object.defineProperty(process, 'platform', { value: 'win32' });

    menuBuilder();

    expect(vi.mocked(Menu).buildFromTemplate).toHaveBeenCalledWith([
      { role: 'editMenu' },
      {
        role: 'help',
        submenu: [
          {
            label: 'Learn More',
            click: expect.any(Function),
          },
        ],
      },
    ]);

    Object.defineProperty(process, 'platform', { value: 'darwin' });
  });

  test('should invoke shell.openExternal on Learn More click', async () => {
    menuBuilder();

    const helpSection = vi.mocked(Menu).buildFromTemplate.mock.calls[2][0][2];

    expect(helpSection).toBeDefined();

    if (helpSection.submenu) {
      helpSection.submenu[0].click();

      expect(vi.mocked(shell).openExternal).toHaveBeenCalledWith('https://electronjs.org');
    }
  });
});
