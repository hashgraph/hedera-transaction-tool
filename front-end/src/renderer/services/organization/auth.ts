import axios, { AxiosError } from 'axios';
import { throwIfNoResponse } from '.';

/* Authentification service for organization */

const authController = 'auth';

export const login = async (
  serverUrl: string,
  email: string,
  password: string,
): Promise<{ id: number }> => {
  try {
    const { data } = await axios.post(
      `${serverUrl}/${authController}/login`,
      {
        email,
        password,
      },
      {
        withCredentials: true,
      },
    );

    return { id: data.id };
  } catch (error: any) {
    if (error instanceof AxiosError) {
      throwIfNoResponse(error);

      if ([400, 401].includes(error.response?.status || 0)) {
        throw new Error('Invalid email or password');
      }
    }

    throw new Error('Failed Sign in Organization');
  }
};

/* Changes the password */
export const changePassword = async (
  organizationServerUrl: string,
  oldPassword: string,
  newPassword: string,
): Promise<void> => {
  try {
    const response = await axios.patch(
      `${organizationServerUrl}/auth/change-password`,
      {
        oldPassword,
        newPassword,
      },
      {
        withCredentials: true,
      },
    );
    return response.data;
  } catch (error) {
    let message = 'Failed change user password';

    if (error instanceof AxiosError) {
      throwIfNoResponse(error);

      const errorMessage = error.response?.data?.message;
      if ([400, 401].includes(error.response?.status || 0) && message.length > 0) {
        message = errorMessage;
      }
    }
    throw new Error(message);
  }
};

/* Sends a reset password request */
export const resetPassword = async (
  organizationServerUrl: string,
  email: string,
): Promise<void> => {
  try {
    const response = await axios.post(
      `${organizationServerUrl}/auth/reset-password`,
      {
        email,
      },
      {
        withCredentials: true,
      },
    );
    return response.data;
  } catch (error) {
    let message = 'Failed request passoword reset';

    if (error instanceof AxiosError) {
      throwIfNoResponse(error);

      const errorMessage = error.response?.data?.message;
      if ([400, 401].includes(error.response?.status || 0) && message.length > 0) {
        message = errorMessage;
      }
    }
    throw new Error(message);
  }
};

/* Sends the OTP in order to verify the password reset */
export const verifyReset = async (organizationServerUrl: string, otp: string): Promise<void> => {
  try {
    const response = await axios.post(
      `${organizationServerUrl}/auth/verify-reset`,
      {
        token: otp,
      },
      {
        withCredentials: true,
      },
    );
    return response.data;
  } catch (error) {
    let message = 'Failed verify password reset';

    if (error instanceof AxiosError) {
      throwIfNoResponse(error);

      const errorMessage = error.response?.data?.message;
      if ([400, 401].includes(error.response?.status || 0) && message.length > 0) {
        message = errorMessage;
      }
    }
    throw new Error(message);
  }
};

/* Sets new password after being OTP verified */
export const setPassword = async (
  organizationServerUrl: string,
  password: string,
): Promise<void> => {
  try {
    const response = await axios.patch(
      `${organizationServerUrl}/auth/set-password`,
      {
        password,
      },
      {
        withCredentials: true,
      },
    );
    return response.data;
  } catch (error) {
    let message = 'Failed to set new password';

    if (error instanceof AxiosError) {
      throwIfNoResponse(error);

      const errorMessage = error.response?.data?.message;

      if ([400, 401].includes(error.response?.status || 0) && message.length > 0) {
        message = errorMessage;
      }
    }
    throw new Error(message);
  }
};
