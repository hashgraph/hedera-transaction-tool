import {
  Menu,
  // shell
} from 'electron';
import menuBuilder from '@main/modules/menu';
// import updater from '@main/modules/updater';
import { MockedObject } from 'vitest';

vi.mock('electron', () => ({
  BrowserWindow: vi.fn(),
  Menu: {
    buildFromTemplate: vi.fn(),
    setApplicationMenu: vi.fn(),
  },
  shell: {
    openExternal: vi.fn(),
  },
}));

vi.mock('@main/modules/updater', () => ({ default: vi.fn() }));

describe('menuBuilder', () => {
  const MenuObject = Menu as unknown as MockedObject<typeof Menu>;

  test('Should build menu from template', () => {
    menuBuilder();

    expect(MenuObject.buildFromTemplate).toHaveBeenCalled();
    expect(MenuObject.setApplicationMenu).toHaveBeenCalled();
  });

  // test('Should call updater when "Check for updates" is clicked', () => {
  //   menuBuilder(mainWindow);

  //   const template = MenuObject.buildFromTemplate.mock.calls[0][0];
  //   const labelItem = template.find(item => item.label === 'hedera-transaction-tool');

  //   expect(labelItem).toBeDefined();
  //   expect(labelItem?.submenu).toBeDefined();
  //   expect(Array.isArray(labelItem?.submenu)).toBe(true);

  //   if (Array.isArray(labelItem?.submenu)) {
  //     const checkForUpdatesItem = labelItem?.submenu?.find(
  //       subItem => subItem.label === 'Check for updates',
  //     );

  //     expect(checkForUpdatesItem).toBeDefined();
  //     expect(checkForUpdatesItem?.click).toBeDefined();

  //     checkForUpdatesItem?.click && checkForUpdatesItem.click({} as any, mainWindow, {} as any);
  //     expect(updater).toHaveBeenCalledWith(mainWindow);
  //   }
  // });

  // test('Should open external link when "Learn More" is clicked', async () => {
  //   menuBuilder(mainWindow);

  //   const template = MenuObject.buildFromTemplate.mock.calls[0][0];
  //   const helpItem = template.find(item => item.role === 'help');

  //   expect(helpItem).toBeDefined();
  //   expect(helpItem?.submenu).toBeDefined();
  //   expect(Array.isArray(helpItem?.submenu)).toBe(true);

  //   if (Array.isArray(helpItem?.submenu)) {
  //     const learnMoreItem = helpItem.submenu.find(subItem => subItem.label === 'Learn More');

  //     expect(learnMoreItem).toBeDefined();
  //     expect(learnMoreItem?.click).toBeDefined();

  //     learnMoreItem?.click && learnMoreItem.click({} as any, mainWindow, {} as any);
  //     expect(updater).toHaveBeenCalledWith(mainWindow);
  //     expect(shell.openExternal).toHaveBeenCalledWith('https://electronjs.org');
  //   }
  // });

  // test('Should not include mac specific menu items when not on mac', () => {
  //   Object.defineProperty(process, 'platform', { value: 'win32' });
  //   menuBuilder(mainWindow);

  //   const testNumber = 4;

  //   const template = MenuObject.buildFromTemplate.mock.calls[testNumber - 1][0];
  //   const macItem = template.find(item => item.label === 'hedera-transaction-tool');

  //   expect(macItem).toBeUndefined();
  // });
});
