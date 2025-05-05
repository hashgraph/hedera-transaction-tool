export * from './debounced-notification-batcher';

export const roomKeys = {
  USER_KEY: (userId: number) => `user:${userId}`,
};
