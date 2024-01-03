import { Menu } from 'electron';

import updater from './updater';

export default function () {
  const isMac = process.platform === 'darwin';

  const template = [
    ...(isMac
      ? [
          {
            //The first item in mac should match the application's name
            label: 'hedera-transaction-tool',
            submenu: [
              { role: 'about' },
              {
                label: 'Check for updates',
                click: () => {
                  updater();
                },
              },
              { type: 'separator' },
              { role: 'services' },
              { type: 'separator' },
              { type: 'separator' },
              { role: 'quit' },
            ],
          },
        ]
      : []),
    { role: 'editMenu' },
    {
      role: 'help',
      submenu: [
        {
          label: 'Learn More',
          click: async () => {
            const { shell } = require('electron');
            await shell.openExternal('https://electronjs.org');
          },
        },
      ],
    },
  ];

  // @ts-ignore
  const menu = Menu.buildFromTemplate(template);

  Menu.setApplicationMenu(menu);
}
