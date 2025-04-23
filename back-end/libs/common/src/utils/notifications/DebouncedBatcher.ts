class DebouncedBatcher {
  private messages: Message[] = [];
  private debounceTimer: NodeJS.Timeout | null = null;
  private maxFlushTimer: NodeJS.Timeout | null = null;
  private firstMessageTime: number | null = null;

  constructor(
    private readonly flushCallback: (messages: Message[]) => Promise<void>,
    private readonly delayMs: number,
    private readonly maxBatchSize: number,
    private readonly maxFlushMS: number,
  ) {}

  add(message: Message): void {
    this.messages.push(message);

    const now = Date.now();
    if (!this.firstMessageTime) {
      this.firstMessageTime = now;
      this.startMaxFlushTimer();
    }

    if (this.messages.length >= this.maxBatchSize) {
      this.flush();
      return;
    }

    this.resetDebounceTimer();
  }

  private resetDebounceTimer(): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }

    this.debounceTimer = setTimeout(() => {
      this.flush();
    }, this.delayMs);
  }

  private startMaxFlushTimer(): void {
    if (this.maxFlushTimer) {
      //which is better and why?
      // clearTimeout(this.maxFlushTimer);
      return;
    }

    this.maxFlushTimer = setTimeout(() => {
      this.flush();
    }, this.maxFlushMS);
  }

  flush(): void {
    if (this.messages.length === 0) {
      return;
    }

    const batch = [...this.messages];
    this.messages = [];
    this.firstMessageTime = null;

    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }

    if (this.maxFlushTimer) {
      clearTimeout(this.maxFlushTimer);
      this.maxFlushTimer = null;
    }

    this.flushCallback(batch);
  }

  isEmpty(): boolean {
    return this.messages.length === 0;
  }

  destroy(): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }
    if (this.maxFlushTimer) {
      clearTimeout(this.maxFlushTimer);
    }

    // Do I want to do this? or just flush what is in there?
    this.messages = [];
    this.debounceTimer = null;
    this.maxFlushTimer = null;
    this.firstMessageTime = null;
  }
}

class Message {
  constructor(
    public readonly id: string,
    public readonly content: string,
    public readonly timestamp: number,
  ) {}
}