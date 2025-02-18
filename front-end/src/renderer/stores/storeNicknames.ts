import { KeyList, Key } from '@hashgraph/sdk';
import { encodeKey, isUserLoggedIn } from '@renderer/utils';
import { acceptHMRUpdate, defineStore } from 'pinia';
import useUserStore from './storeUser';
import { addComplexKey, getComplexKey, updateComplexKey } from '@renderer/services/complexKeysService';

interface KeyAndId {
  key: Key;
  keyId: string;
}

interface State {
  nickNamesKeys: Map<string, KeyAndId>;
}

const useNicknamesStore = defineStore('nicknames', {
  state: (): State => ({
    nickNamesKeys: new Map(),
  }),
  actions: {
    async getNickName(selectedKeyList: KeyList) {
      const keyList = await this.getKeyListStructure(selectedKeyList);

      if (keyList) {
        this.nickNamesKeys.set(keyList.nickname, { key: selectedKeyList, keyId: keyList.id })
        return [keyList.nickname, keyList.id];
      } else {
        return ['', ''];
      }
    },
    updateNickname(newNickname: string, oldNickname: string, key: KeyList) {
      const oldKey = this.nickNamesKeys.get(oldNickname);

      if (!newNickname) {
        this.nickNamesKeys.delete(oldNickname);
      } else if (oldKey) {
        this.nickNamesKeys.set(newNickname, oldKey);
        this.nickNamesKeys.delete(oldNickname);
      }
      else {
        this.nickNamesKeys.set(newNickname, { key, keyId: '' });
      }
    },
    updateKey(nickname: string, key: KeyList, keyId: string) {
      if (nickname) {
        this.nickNamesKeys.set(nickname, { key, keyId });
      }
    },
    async saveNicknames() {
      const user = useUserStore();

      if (!isUserLoggedIn(user.personal)) {
        throw new Error('User is not logged in');
      }

      for (const nickNameKey of this.nickNamesKeys) {
        const keyListBytes = encodeKey(nickNameKey[1].key);
        if (nickNameKey[1].keyId) {
          await updateComplexKey(nickNameKey[1].keyId, keyListBytes, nickNameKey[0]);
        } else {
          await addComplexKey(user.personal.id, keyListBytes, nickNameKey[0])
        }
      }

      this.clearNicknames();
    },
    clearNicknames() {
      this.nickNamesKeys = new Map();
    },
    async getKeyListStructure(selectedKeyList: KeyList) {
      const user = useUserStore();

      if (!isUserLoggedIn(user.personal)) {
        throw new Error('User is not logged in');
      }
      const keyList = await getComplexKey(user.personal.id, selectedKeyList);

      return keyList;
    },
    async saveTopLevelNickname(selectedKeyList: KeyList, nickname: string) {
      const keyList = await this.getKeyListStructure(selectedKeyList);
      this.nickNamesKeys.set(nickname, { key: selectedKeyList, keyId: keyList ? keyList.id : '' });
      await this.saveNicknames();
      return await this.getKeyListStructure(selectedKeyList);

    }
  },
});

// Allows for hot loading with Store changes
if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useNicknamesStore, import.meta.hot));
}

export default useNicknamesStore;
