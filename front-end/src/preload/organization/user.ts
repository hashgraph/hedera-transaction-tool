import { ipcRenderer } from 'electron';

const createChannelName = (...props) => ['remote', 'user', ...props].join(':');

export default {
  user: {
    me: (organizationId: string, userId: string): Promise<any> =>
      ipcRenderer.invoke(createChannelName('me'), organizationId, userId),
  },
};
