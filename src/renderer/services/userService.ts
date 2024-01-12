/* User Service */

export const loginLocal = async (email: string, password: string, autoRegister = false) => {
  try {
    return await window.electronAPI.localUser.login(email, password, autoRegister);
  } catch (err: any) {
    const message = err.message?.split(': Error: ')[1] || 'Login failed';
    throw Error(message);
  }
};

export const registerLocal = async (email: string, password: string) => {
  try {
    return await window.electronAPI.localUser.register(email, password);
  } catch (err: any) {
    const message = err.message?.split(': Error: ')[1] || 'Registration failed';
    throw Error(message);
  }
};

export const resetDataLocal = async () => {
  try {
    return await window.electronAPI.localUser.resetData();
  } catch (err: any) {
    const message = err.message?.split(': Error: ')[1] || 'Failed to reset user data';
    throw Error(message);
  }
};

export const hasRegisteredUsers = async () => {
  try {
    return await window.electronAPI.localUser.hasRegisteredUsers();
  } catch (err: any) {
    const message = err.message?.split(': Error: ')[1] || 'Failed to check for registered users';
    throw Error(message);
  }
};
