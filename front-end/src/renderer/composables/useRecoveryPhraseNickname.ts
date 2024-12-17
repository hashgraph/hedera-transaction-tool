import useUserStore from '@renderer/stores/storeUser';

import { add, update, remove } from '@renderer/services/mnemonicService';

import { assertUserLoggedIn } from '@renderer/utils';

export default function useRecoveryPhraseNickname() {
  /* Stores */
  const user = useUserStore();

  /* Functions */
  const get = (mnemonicHash: string) => {
    return user.mnemonics.find(m => m.mnemonicHash === mnemonicHash)?.nickname || null;
  };

  const set = async (mnemonicHash: string, nickname: string) => {
    assertUserLoggedIn(user.personal);

    const existingMnemonicData = user.mnemonics.find(m => m.mnemonicHash === mnemonicHash);

    if (existingMnemonicData && existingMnemonicData.nickname === nickname) {
      return;
    }

    if (!nickname && existingMnemonicData) {
      await remove(user.personal.id, [mnemonicHash]);
      await user.refetchMnemonics();
      return;
    }

    if (existingMnemonicData) {
      await update(user.personal.id, mnemonicHash, nickname);
    } else {
      await add(user.personal.id, mnemonicHash, nickname);
    }

    await user.refetchMnemonics();
  };

  return { get, set };
}
