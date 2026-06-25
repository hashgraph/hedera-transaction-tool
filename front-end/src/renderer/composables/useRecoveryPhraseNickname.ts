import useUserStore from '@renderer/stores/storeUser';
import useKeysStore from '@renderer/stores/storeKeys';

import { add, update, remove } from '@renderer/services/mnemonicService';

import { assertUserLoggedIn } from '@renderer/utils';

export default function useRecoveryPhraseNickname() {
  /* Stores */
  const user = useUserStore();
  const keys = useKeysStore();

  /* Functions */
  const get = (mnemonicHash: string) => {
    return keys.mnemonics.find(m => m.mnemonicHash === mnemonicHash)?.nickname || null;
  };

  const set = async (mnemonicHash: string, nickname: string) => {
    assertUserLoggedIn(user.personal);

    const existingMnemonicData = keys.mnemonics.find(m => m.mnemonicHash === mnemonicHash);

    if (existingMnemonicData && existingMnemonicData.nickname === nickname) {
      return;
    }

    if (!nickname && existingMnemonicData) {
      await remove(user.personal.id, [mnemonicHash]);
      await keys.refetchMnemonics();
      return;
    }

    if (existingMnemonicData) {
      await update(user.personal.id, mnemonicHash, nickname);
    } else {
      await add(user.personal.id, mnemonicHash, nickname);
    }

    await keys.refetchMnemonics();
  };

  return { get, set };
}
