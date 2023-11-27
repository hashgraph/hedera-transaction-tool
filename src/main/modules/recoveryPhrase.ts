import { Mnemonic } from '@hashgraph/sdk';
import { ipcMain } from 'electron';

const createChannelName = (...props) => ['recoveryPhrase', props].join(':');

export default () => {
  // Generate
  ipcMain.handle(createChannelName('generate'), () => Mnemonic.generate());
};
