import { commonIPCHandler } from '@renderer/utils';

/* User Service */

/* Login locally */
export const loginLocal = async (
  email: string,
  password: string,
  keepLoggedIn = false,
  autoRegister = false,
) =>
  commonIPCHandler(async () => {
    const { id, email: userEmail } = await window.electronAPI.local.localUser.login(
      email,
      password,
      autoRegister,
    );

    if (keepLoggedIn) {
      localStorage.setItem('htx_user', JSON.stringify({ userId: id, email: userEmail }));
    } else {
      localStorage.removeItem('htx_user');
    }
    return { id, email: userEmail };
  }, 'Login failed');

/* Register locally */
export const registerLocal = async (email: string, password: string, keepLoggedIn = false) =>
  commonIPCHandler(async () => {
    const { id, email: userEmail } = await window.electronAPI.local.localUser.register(
      email,
      password,
    );

    if (keepLoggedIn) {
      localStorage.setItem('htx_user', JSON.stringify({ userId: id, email: userEmail }));
    }

    return { id: id, email: userEmail };
  }, 'Registration failed');

/* Reset the whole local app */
export const resetDataLocal = async () =>
  commonIPCHandler(async () => {
    return await window.electronAPI.local.localUser.resetData();
  }, 'Failed to reset user data');

/* Get the count of local users */
export const getUsersCount = async () =>
  commonIPCHandler(async () => {
    return await window.electronAPI.local.localUser.usersCount();
  }, 'Failed to check for registered users');

/* Compare local user password with value */
export const comparePasswords = async (userId: string, password: string) =>
  commonIPCHandler(async () => {
    return await window.electronAPI.local.localUser.comparePasswords(userId, password);
  }, 'User not exists');

/* Change user password */
export const changePassword = async (userId: string, oldPassword: string, newPassword: string) =>
  commonIPCHandler(async () => {
    return await window.electronAPI.local.localUser.changePassword(
      userId,
      oldPassword,
      newPassword,
    );
  }, 'Failed to change password');
