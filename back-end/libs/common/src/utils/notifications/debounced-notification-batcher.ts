export class DebouncedNotificationBatcher {
  private messagesByGroup: Map<number | null, NotificationMessage[]> = new Map();
  private debounceTimers: Map<number | null, NodeJS.Timeout> = new Map();
  private maxFlushTimers: Map<number | null, NodeJS.Timeout> = new Map();
  private firstMessageTimes: Map<number | null, number> = new Map();

  constructor(
    private readonly flushCallback: (groupKey: number | null, messages: NotificationMessage[]) => Promise<void>,
    private readonly delayMs: number,
    private readonly maxBatchSize: number,
    private readonly maxFlushMS: number,
  ) {}

  add(message: NotificationMessage, groupKey: number | null = null): void {
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

  private resetDebounceTimer(groupKey: number | null): void {
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

  private startMaxFlushTimer(groupKey: number | null): void {
    clearTimeout(this.maxFlushTimers.get(groupKey));

    this.maxFlushTimers.set(
      groupKey,
      setTimeout(() => {
        this.flush(groupKey);
      }, this.maxFlushMS),
    );
  }

  flush(groupKey: number | null): void {
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

export class NotificationMessage {
  constructor(
    public readonly message: string,
    public readonly content: string[],
  ) {}
}