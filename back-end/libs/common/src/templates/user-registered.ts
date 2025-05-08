import { Notification } from '@entities';

export const generateUserRegisteredMessage = (url: string, tempPassword: string) => {
  return `You have been registered in Hedera Transaction Tool.
The Organization URL is: <b>${url}</b>
Your temporary password is: <b>${tempPassword}</b>`
}

export const generateNotifyUserRegisteredContent = (notification: Notification) => {
  const username = notification.additionalData?.username;
  return `User ${username} has completed the registration process.`;
}