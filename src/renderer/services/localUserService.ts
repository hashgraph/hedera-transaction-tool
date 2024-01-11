/* Local User Service */

export const login = async (email: string, password: string, autoRegister = false) => {
  try {
    return await window.electronAPI.localUser.login(email, password, autoRegister);
  } catch (err: any) {
    const message = err.message?.split(': Error: ')[1] || 'Login failed';
    throw Error(message);
  }
};

export const register = async (email: string, password: string) => {
  try {
    return await window.electronAPI.localUser.register(email, password);
  } catch (err: any) {
    const message = err.message?.split(': Error: ')[1] || 'Registration failed';
    throw Error(message);
  }
};
