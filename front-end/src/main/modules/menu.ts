import { Menu, shell } from 'electron';

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
              { type: 'separator' },
              { role: 'services' },
              { type: 'separator' },
              { role: 'hide' },
              { role: 'hideOthers' },
              { role: 'unhide' },
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
            await shell.openExternal('https://transactiontool.hedera.com');
          },
        },
      ],
    },
  ];

  // @ts-ignore Incorrect arg type of the buildFromTemplate function
  const menu = Menu.buildFromTemplate(template);

  Menu.setApplicationMenu(menu);
}
