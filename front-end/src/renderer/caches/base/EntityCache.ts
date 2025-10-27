export abstract class EntityCache<K extends string | number, E> {
  public static readonly FRESH_DURATION = 500; // ms
  private readonly records = new Map<string, EntityRecord<E>>();

  //
  // Public
  //

  public constructor(
    public readonly youngDuration: number = 60000, // ms
  ) {}

  public async lookup(key: K, mirrorNodeUrl: string, forceLoad = false): Promise<E> {
    let result: Promise<E>;

    const recordKey = this.makeRecordKey(key, mirrorNodeUrl);
    const currentRecord = this.records.get(recordKey);
    if (currentRecord && currentRecord.isFresh(forceLoad, this)) {
      // console.log(this.constructor.name + ' hit for ' + key);
      result = currentRecord.promise;
    } else {
      // if (currentRecord) {
      //   console.log(this.constructor.name + ' reload for ' + key);
      // } else {
      //   console.log(this.constructor.name + ' miss for ' + key);
      // }
      const newPromise = this.load(key, mirrorNodeUrl);
      this.mutate(key, mirrorNodeUrl, newPromise);
      result = newPromise;
    }

    return result;
  }

  // public forget(key: K, mirrorNodeUrl: string): void {
  //   const recordKey = this.makeRecordKey(key, mirrorNodeUrl);
  //   this.records.delete(recordKey);
  // }
  //
  // public clear(): void {
  //   this.records.clear();
  // }
  //
  // public contains(key: K, mirrorNodeUrl: string, forceLoad = false): boolean {
  //   const recordKey = this.makeRecordKey(key, mirrorNodeUrl);
  //   const r = this.records.get(recordKey);
  //   return r ? r.isFresh() || !forceLoad : false;
  // }
  //
  // public isEmpty(): boolean {
  //   return this.records.size == 0;
  // }

  //
  // Protected (to be subclassed)
  //

  protected async load(key: K, mirrorNodeUrl: string): Promise<E> {
    throw new Error('Must be subclassed to load ' + key + ' with ' + mirrorNodeUrl);
  }

  //
  // Protected (for subclasses only)
  //

  protected mutate(key: K, mirrorNodeUrl: string, promise: Promise<E>): void {
    const recordKey = this.makeRecordKey(key, mirrorNodeUrl);
    this.records.set(recordKey, new EntityRecord(promise));
  }

  protected makeRecordKey(key: K, mirrorNodeUrl: string): string {
    return key.toString() + '/' + mirrorNodeUrl;
  }
}

class EntityRecord<E> {
  readonly promise: Promise<E>;
  readonly time: number;

  constructor(promise: Promise<E>) {
    this.promise = promise;
    this.time = Date.now();
  }

  isFresh(forceLoad: boolean, cache: EntityCache<any, E>): boolean {
    let result: boolean;
    if (forceLoad) {
      result = this.age() < EntityCache.FRESH_DURATION; // ms
    } else {
      result = this.age() < EntityCache.FRESH_DURATION + cache.youngDuration; // ms
    }
    return result;
  }

  age(): number {
    return Date.now() - this.time;
  }
}
