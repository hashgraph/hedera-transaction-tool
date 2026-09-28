import { DebouncedNotificationBatcher } from './DebouncedNotificationBatcher';

describe.skip('DebouncedNotificationBatcher', () => {
  let batcher: DebouncedNotificationBatcher;
  const flushCallback = jest.fn();

  beforeEach(() => {
    flushCallback.mockClear();
    batcher = new DebouncedNotificationBatcher(flushCallback, 1000, 3, 5000, 'redis://localhost:6379');
  });

  it('should add messages and flush when maxBatchSize is reached', async () => {
    const message1 = { message: 'test1', content: ['content1'] };
    const message2 = { message: 'test2', content: ['content2'] };
    const message3 = { message: 'test3', content: ['content3'] };

    await batcher.add(message1);
    await batcher.add(message2);
    await batcher.add(message3);

    expect(flushCallback).toHaveBeenCalledWith(null, [message1, message2, message3]);
  });

  it('should debounce flush calls', () => {
    jest.useFakeTimers();
    const message = { message: 'test', content: ['content'] };

    batcher.add(message);
    jest.advanceTimersByTime(500);

    expect(flushCallback).not.toHaveBeenCalled();

    jest.advanceTimersByTime(500);
    expect(flushCallback).toHaveBeenCalledWith(null, [message]);

    jest.useRealTimers();
  });

  it('should flush all messages when flushAll is called', () => {
    const message = { message: 'test', content: ['content'] };
    batcher.add(message);

    batcher.flushAll();

    expect(flushCallback).toHaveBeenCalledWith(null, [message]);
  });
});
