import { DebouncedNotificationBatcher, NotificationMessage } from './DebouncedNotificationBatcher';

describe('DebouncedNotificationBatcher', () => {
  let batcher: DebouncedNotificationBatcher;
  const flushCallback = jest.fn();

  beforeEach(() => {
    batcher = new DebouncedNotificationBatcher(flushCallback, 1000, 3, 5000);
    flushCallback.mockClear();
  });

  it('should add messages and flush when maxBatchSize is reached', () => {
    const message1 = new NotificationMessage('test1', ['content1']);
    const message2 = new NotificationMessage('test2', ['content2']);
    const message3 = new NotificationMessage('test3', ['content3']);

    batcher.add(message1);
    batcher.add(message2);
    batcher.add(message3);

    expect(flushCallback).toHaveBeenCalledWith(null, [message1, message2, message3]);
  });

  it('should debounce flush calls', () => {
    jest.useFakeTimers();
    const message = new NotificationMessage('test', ['content']);

    batcher.add(message);
    jest.advanceTimersByTime(500);

    expect(flushCallback).not.toHaveBeenCalled();

    jest.advanceTimersByTime(500);
    expect(flushCallback).toHaveBeenCalledWith(null, [message]);

    jest.useRealTimers();
  });

  it('should flush all messages when flushAll is called', () => {
    const message = new NotificationMessage('test', ['content']);
    batcher.add(message);

    batcher.flushAll();

    expect(flushCallback).toHaveBeenCalledWith(null, [message]);
  });
});