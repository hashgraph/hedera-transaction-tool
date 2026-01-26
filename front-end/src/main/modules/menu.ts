import { BrowserWindow, Menu, shell } from 'electron';

export default function () {
  const isMac = process.platform === 'darwin';
  const appName = 'Hedera Transaction Tool'; // TBD: retrieve this value at runtime

  const macTemplate: Electron.MenuItemConstructorOptions[] = [
    {
      //The first item in mac should match the application's name
      label: 'hedera-transaction-tool',
      submenu: [
        {
          role: 'about',
          label: `About ${appName}`,
        },
        { type: 'separator' },
        {
          label: 'Settings',
          click: () => {
            const w = BrowserWindow.getFocusedWindow();
            if (w !== null) {
              w.webContents.send('settings');
            }
          },
          accelerator: 'Command+,',
        },
        { type: 'separator' },
        { role: 'services' },
        { type: 'separator' },
        {
          role: 'hide',
          label: `Hide ${appName}`,
        },
        { role: 'hideOthers' },
        { role: 'unhide' },
        { type: 'separator' },
        {
          role: 'quit',
          label: `Quit ${appName}`,
        },
      ],
    },
  ];

  const template: Electron.MenuItemConstructorOptions[] = [
    ...(isMac ? macTemplate : []),
    { role: 'editMenu' },
    {
      role: 'help',
      submenu: [
        {
          label: 'Learn More',
          click: async () => {
            await shell.openExternal('https://transactiontool.hedera.com');
          },
        },
      ],
    },
  ];

  const menu = Menu.buildFromTemplate(template);

  Menu.setApplicationMenu(menu);
}
