import { getMessageFromIPCError } from '@renderer/utils';

/* User Service */

export const loginLocal = async (
  email: string,
  password: string,
  keepLoggedIn = false,
  autoRegister = false,
) => {
  try {
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
  } catch (err: any) {
    throw Error(getMessageFromIPCError(err, 'Login failed'));
  }
};

export const registerLocal = async (email: string, password: string, keepLoggedIn = false) => {
  try {
    const { id, email: userEmail } = await window.electronAPI.local.localUser.register(
      email,
      password,
    );

    if (keepLoggedIn) {
      localStorage.setItem('htx_user', JSON.stringify({ userId: id, email: userEmail }));
    }

    return { id: id, email: userEmail };
  } catch (err: any) {
    throw Error(getMessageFromIPCError(err, 'Registration failed'));
  }
};

export const resetDataLocal = async () => {
  try {
    return await window.electronAPI.local.localUser.resetData();
  } catch (err: any) {
    throw Error(getMessageFromIPCError(err, 'Failed to reset user data'));
  }
};

export const getUsersCount = async () => {
  try {
    return await window.electronAPI.local.localUser.usersCount();
  } catch (err: any) {
    throw Error(getMessageFromIPCError(err, 'Failed to check for registered users'));
  }
};

export const comparePasswords = async (userId: string, password: string) => {
  try {
    return await window.electronAPI.local.localUser.comparePasswords(userId, password);
  } catch (err: any) {
    throw Error(getMessageFromIPCError(err, 'User not exists'));
  }
};

export const changePassword = async (userId: string, oldPassword: string, newPassword: string) => {
  try {
    return await window.electronAPI.local.localUser.changePassword(
      userId,
      oldPassword,
      newPassword,
    );
  } catch (err: any) {
    throw Error(getMessageFromIPCError(err, 'Failed to change password'));
  }
};
