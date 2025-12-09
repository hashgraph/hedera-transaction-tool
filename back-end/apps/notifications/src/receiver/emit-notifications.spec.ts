import {
  emitEmailNotifications,
  emitNewNotifications,
  emitDeleteNotifications,
  emitNotifyClients,
} from './emit-notifications';
import {
  EMAIL_NOTIFICATIONS,
  FAN_OUT_NEW_NOTIFICATIONS,
  FAN_OUT_DELETE_NOTIFICATIONS,
  FAN_OUT_NOTIFY_CLIENTS,
} from '@app/common';

describe('emit-notifications', () => {
  const makePublisher = (value: any) => ({
    publish: jest.fn().mockReturnValue(value),
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  it('emitNewNotifications should forward to publisher and return the same promise', () => {
    const dtos = [{ id: 1 }] as any;
    const mockPromise = Promise.resolve('ok');
    const publisher = makePublisher(mockPromise) as any;

    const ret = emitNewNotifications(publisher, dtos);

    expect(publisher.publish).toHaveBeenCalledWith(FAN_OUT_NEW_NOTIFICATIONS, dtos);
    expect(ret).toBe(mockPromise);
  });

  it('emitDeleteNotifications should forward to publisher and return the same promise', () => {
    const dtos = [{ id: 2 }] as any;
    const mockPromise = Promise.resolve('ok');
    const publisher = makePublisher(mockPromise) as any;

    const ret = emitDeleteNotifications(publisher, dtos);

    expect(publisher.publish).toHaveBeenCalledWith(FAN_OUT_DELETE_NOTIFICATIONS, dtos);
    expect(ret).toBe(mockPromise);
  });

  it('emitNotifyClients should forward to publisher and return the same promise', () => {
    const userIds = [{ userId: 1 }] as any;
    const mockPromise = Promise.resolve('ok');
    const publisher = makePublisher(mockPromise) as any;

    const ret = emitNotifyClients(publisher, userIds);

    expect(publisher.publish).toHaveBeenCalledWith(FAN_OUT_NOTIFY_CLIENTS, userIds);
    expect(ret).toBe(mockPromise);
  });

  describe('emitEmailNotifications', () => {
    it('calls onSuccess when publish resolves with success === true', async () => {
      const dtos = [{ to: 'a' }] as any;
      const result = { success: true };
      const publisher = { publish: jest.fn().mockResolvedValue(result) } as any;
      const onSuccess = jest.fn();
      const onError = jest.fn();

      const ret = await emitEmailNotifications(publisher, dtos, onSuccess, onError);

      expect(publisher.publish).toHaveBeenCalledWith(EMAIL_NOTIFICATIONS, dtos);
      expect(onSuccess).toHaveBeenCalled();
      expect(onError).not.toHaveBeenCalled();
      expect(ret).toBeUndefined(); // current implementation returns void
    });

    it('calls onError when publish resolves with success === false', async () => {
      const dtos = [{ to: 'b' }] as any;
      const result = { success: false, response: 'some error' };
      const publisher = { publish: jest.fn().mockResolvedValue(result) } as any;
      const onSuccess = jest.fn();
      const onError = jest.fn();

      const ret = await emitEmailNotifications(publisher, dtos, onSuccess, onError);

      expect(publisher.publish).toHaveBeenCalledWith(EMAIL_NOTIFICATIONS, dtos);
      expect(onSuccess).not.toHaveBeenCalled();
      expect(onError).toHaveBeenCalledWith('some error');
      expect(ret).toBeUndefined();
    });
  });
});
