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
      const user = useUserStore();

      if (!isUserLoggedIn(user.personal)) {
        throw new Error('User is not logged in');
      }

      const keyList = await getComplexKey(user.personal.id, selectedKeyList);

      if (keyList) {
        this.nickNamesKeys.set(keyList.nickname, { key: selectedKeyList, keyId: keyList.id })
        return [keyList.nickname, keyList.id];
      } else {
        return ['', ''];
      }
    },
    updateNickname(newNickname: string, oldNickname: string) {
      const oldKey = this.nickNamesKeys.get(oldNickname);

      if (oldKey) {
        this.nickNamesKeys.set(newNickname, oldKey);
        this.nickNamesKeys.delete(oldNickname);
      }
    },
    updateKey(nickname: string, key: KeyList, keyId: string) {
      this.nickNamesKeys.set(nickname, { key, keyId });
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
    },
    clearNicknames() {
      this.nickNamesKeys = new Map();
    }
  },
});

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useNicknamesStore, import.meta.hot));
}

export default useNicknamesStore;
