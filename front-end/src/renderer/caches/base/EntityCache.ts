export abstract class EntityCache<K extends string | number, E, C> {
  public static readonly FRESH_DURATION = 500; // ms
  private readonly records = new Map<string, EntityRecord<E>>();

  //
  // Public
  //

  public constructor(
    public readonly youngDuration: number = 10 * 60_000, // ms
  ) {}

  public async lookup(key: K, context: C, forceLoad = false): Promise<E> {
    let result: Promise<E>;

    const recordKey = this.makeRecordKey(key, context);
    const currentRecord = this.records.get(recordKey);
    if (currentRecord && currentRecord.isUsable(forceLoad, this)) {
      // cache hit
      result = currentRecord.promise;
    } else {
      // cache miss or reload
      const newPromise = this.load(key, context);
      this.mutate(key, context, newPromise);
      result = newPromise;
    }

    return result;
  }

  public forget(key: K, context: C, strict = true): void {
    const recordKey = this.makeRecordKey(key, context);
    const currentRecord = this.records.get(recordKey);
    if (currentRecord) {
      // When strict is off, we forget only if data is 1s old (help for notification mgt)
      if (strict || currentRecord.age() > 1000) {
        this.records.delete(recordKey);
      }
    }
  }

  public clear(): void {
    this.records.clear();
  }

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

  protected async load(key: K, context: C): Promise<E> {
    throw new Error('Must be subclassed to load ' + key + ' with ' + context);
  }

  abstract makeRecordKey(key: K, context: C): string;

  //
  // Protected (for subclasses only)
  //

  protected mutate(key: K, context: C, promise: Promise<E>): void {
    const recordKey = this.makeRecordKey(key, context);
    this.records.set(recordKey, new EntityRecord(promise));
  }
}

class EntityRecord<E> {
  readonly promise: Promise<E>;
  readonly time: number;

  constructor(promise: Promise<E>) {
    this.promise = promise;
    this.time = Date.now();
  }

  isUsable(forceLoad: boolean, cache: EntityCache<any, E, any>): boolean {
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
