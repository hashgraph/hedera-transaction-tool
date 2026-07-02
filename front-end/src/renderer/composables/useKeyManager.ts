import { computed, type Ref } from 'vue';
import type { KeyPair } from '@prisma/client';
import type { IUserKey } from '@shared/interfaces';

export default function useKeyManager(
  keyPairs: Ref<KeyPair[]>,
  userKeys: Ref<IUserKey[]>,
): KeyManager {
  return new KeyManager(keyPairs, userKeys);
}

export class KeyManager {
  //
  // Public
  //

  public constructor(
    readonly keyPairs: Ref<KeyPair[]>,
    readonly userKeys: Ref<IUserKey[]>,
  ) {}

  public readonly keyInfos = computed(() => {
    const publicKeys = new Set<string>();
    for (const keyPair of this.keyPairs.value) {
      publicKeys.add(keyPair.public_key);
    }
    for (const userKey of this.userKeys.value) {
      publicKeys.add(userKey.publicKey);
    }

    const result: KeyInfo[] = [];
    for (const key of publicKeys) {
      const keyPair = this.keyPairs.value.find(keyPair => keyPair.public_key === key);
      const userKey = this.userKeys.value.find(
        userKey => userKey.publicKey === key && !userKey.deletedAt,
      );
      result.push(new KeyInfo(key, keyPair ?? null, userKey ?? null));
    }
    result.sort(KeyInfo.compare);

    return result;
  });
}

export class KeyInfo {
  public constructor(
    public readonly publicKey: string,
    public readonly keyPair: KeyPair | null,
    public readonly userKey: IUserKey | null,
  ) {}

  public mnemonicHash(): string | null {
    return this.keyPair?.secret_hash ?? this.userKey?.mnemonicHash ?? null;
  }

  public index(): number {
    return this.keyPair?.index ?? this.userKey?.index ?? -1;
  }

  public static compare(i1: KeyInfo, i2: KeyInfo): number {
    let result: number;

    if (i1.keyPair !== null && i1.userKey !== null && i2.keyPair !== null && i2.userKey !== null) {
      result = KeyInfo.compareKeyPair(i1.keyPair, i2.keyPair);
    } else if (i1.keyPair !== null && i1.userKey !== null) {
      // i1 is complete
      result = -1;
    } else if (i2.keyPair !== null && i2.userKey !== null) {
      // i2 is complete
      result = +1;
    } else if (i1.keyPair !== null && i2.keyPair !== null) {
      result = KeyInfo.compareKeyPair(i1.keyPair, i2.keyPair);
    } else if (i1.userKey !== null && i2.userKey !== null) {
      result = KeyInfo.compareUserKey(i1.userKey, i2.userKey);
    } else {
      result = i1.keyPair !== null ? +1 : -1;
    }

    return result;
  }

  private static compareKeyPair(kp1: KeyPair, kp2: KeyPair): number {
    let result: number;
    if (kp1.secret_hash !== null && kp2.secret_hash !== null) {
      result = kp1.secret_hash.localeCompare(kp2.secret_hash);
      if (result === 0) {
        result = kp1.index < kp2.index ? -1 : +1;
      }
    } else if (kp1.secret_hash !== null) {
      result = -1;
    } else if (kp2.secret_hash !== null) {
      result = +1;
    } else {
      result = kp1.public_key.localeCompare(kp2.public_key);
    }
    return result;
  }

  private static compareUserKey(uk1: IUserKey, uk2: IUserKey): number {
    let result: number;
    if (uk1.mnemonicHash && uk2.mnemonicHash) {
      result = uk1.mnemonicHash.localeCompare(uk2.mnemonicHash);
      if (result === 0 && uk1.index != null && uk2.index != null) {
        result = uk1.index < uk2.index ? -1 : +1;
      }
    } else if (uk1.mnemonicHash != null) {
      result = -1;
    } else if (uk2.mnemonicHash != null) {
      result = +1;
    } else {
      result = uk1.publicKey.localeCompare(uk2.publicKey);
    }
    return result;
  }
}
