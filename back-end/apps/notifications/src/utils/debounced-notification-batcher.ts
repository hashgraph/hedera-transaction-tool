export class DebouncedNotificationBatcher<T = never> {
  private messagesByGroup: Map<string | number | null, T[]> = new Map();
  private debounceTimers: Map<string | number | null, NodeJS.Timeout> = new Map();
  private maxFlushTimers: Map<string | number | null, NodeJS.Timeout> = new Map();
  private firstMessageTimes: Map<string | number | null, number> = new Map();

  constructor(
    private readonly flushCallback: (groupKey: string | number | null, messages: T[]) => Promise<void>,
    private readonly delayMs: number,
    private readonly maxBatchSize: number,
    private readonly maxFlushMS: number,
  ) {}

  add(message: T, groupKey: string | number | null = null): void {
    if (!this.messagesByGroup.has(groupKey)) {
      this.messagesByGroup.set(groupKey, []);
    }

    const messages = this.messagesByGroup.get(groupKey)!;
    messages.push(message);

    const now = Date.now();
    if (!this.firstMessageTimes.has(groupKey)) {
      this.firstMessageTimes.set(groupKey, now);
      this.startMaxFlushTimer(groupKey);
    }

    if (messages.length >= this.maxBatchSize) {
      this.flush(groupKey);
      return;
    }

    this.resetDebounceTimer(groupKey);
  }

  private resetDebounceTimer(groupKey: string | number | null): void {
    if (this.debounceTimers.has(groupKey)) {
      clearTimeout(this.debounceTimers.get(groupKey)!);
    }

    this.debounceTimers.set(
      groupKey,
      setTimeout(() => {
        this.flush(groupKey);
      }, this.delayMs),
    );
  }

  private startMaxFlushTimer(groupKey: string | number | null): void {
    clearTimeout(this.maxFlushTimers.get(groupKey));

    this.maxFlushTimers.set(
      groupKey,
      setTimeout(() => {
        this.flush(groupKey);
      }, this.maxFlushMS),
    );
  }

  flush(groupKey: string | number | null): void {
    const messages = this.messagesByGroup.get(groupKey);
    if (!messages || messages.length === 0) {
      return;
    }

    this.messagesByGroup.set(groupKey, []);
    this.firstMessageTimes.delete(groupKey);

    if (this.debounceTimers.has(groupKey)) {
      clearTimeout(this.debounceTimers.get(groupKey)!);
      this.debounceTimers.delete(groupKey);
    }

    if (this.maxFlushTimers.has(groupKey)) {
      clearTimeout(this.maxFlushTimers.get(groupKey)!);
      this.maxFlushTimers.delete(groupKey);
    }

    this.flushCallback(groupKey, messages);
  }

  flushAll(): void {
    for (const groupKey of this.messagesByGroup.keys()) {
      this.flush(groupKey);
    }
  }

  isEmpty(): boolean {
    return Array.from(this.messagesByGroup.values()).every((messages) => messages.length === 0);
  }

  destroy(): void {
    //do I want to do all this or just flush?
    for (const timer of this.debounceTimers.values()) {
      clearTimeout(timer);
    }
    for (const timer of this.maxFlushTimers.values()) {
      clearTimeout(timer);
    }

    this.messagesByGroup.clear();
    this.debounceTimers.clear();
    this.maxFlushTimers.clear();
    this.firstMessageTimes.clear();
  }
}