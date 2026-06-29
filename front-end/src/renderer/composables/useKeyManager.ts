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
      const userKey = this.userKeys.value.find(userKey => userKey.publicKey === key);
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

  public isMaintenanceRequired(): boolean {
    return this.keyPair === null || this.userKey === null;
  }

  public static compare(i1: KeyInfo, i2: KeyInfo): number {
    let result: number;
    const h1 = i1.mnemonicHash();
    const h2 = i2.mnemonicHash();
    if (h1 !== null && h2 !== null) {
      result = h1.localeCompare(h2);
      if (result === 0) {
        result = i1.index() < i2.index() ? -1 : +1;
      }
    } else if (h1 !== null) {
      result = -1;
    } else if (h2 !== null) {
      result = +1;
    } else {
      result = i1.publicKey.localeCompare(i2.publicKey);
    }
    return result;
  }
}
