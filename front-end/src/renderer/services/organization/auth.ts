import axios from 'axios';

import { axiosWithCredentials, commonRequestHandler, RequestError } from '@renderer/utils';
import { ErrorCodes } from '@shared/constants';
/* Authentification service for organization */

const authController = 'auth';

/* Login the user */
export const login = async (
  serverUrl: string,
  email: string,
  password: string,
): Promise<{ id: number; jwtToken: string }> =>
  commonRequestHandler(
    async () => {
      const { data } = await axios.post(`${serverUrl}/${authController}/login`, {
        email,
        password,
      });

      return { id: data.user.id, jwtToken: data.accessToken };
    },
    'Failed to Sign In to Organization',
    'Invalid email or password',
  );

/* Logout the user */
export const logout = async (serverUrl: string): Promise<void> => {
  try {
    await axiosWithCredentials.post(`${serverUrl}/${authController}/logout`, {}, {}, false);
  } catch (error) {
    const status = axios.isAxiosError(error) ? error.status : undefined;
    const code = axios.isAxiosError(error) ? error.response?.data?.code : ErrorCodes.UNKWN;
    if (status !== 401) {
      throw new RequestError('Failed to Log out of Organization', code, status);
    }
  }
};

/* Changes the password */
export const changePassword = async (
  organizationServerUrl: string,
  oldPassword: string,
  newPassword: string,
): Promise<void> =>
  commonRequestHandler(async () => {
    await axiosWithCredentials.patch(
      `${organizationServerUrl}/${authController}/change-password`,
      {
        oldPassword,
        newPassword,
      },
    );
  }, 'Failed to change user password');

/* Sends a reset password request */
export const resetPassword = async (
  organizationServerUrl: string,
  email: string,
): Promise<string> =>
  commonRequestHandler(async () => {
    const response = await axios.post(`${organizationServerUrl}/${authController}/reset-password`, {
      email,
    });
    return response.data.token;
  }, 'Failed to request password reset');

/* Sends the OTP in order to verify the password reset */
export const verifyReset = async (
  organizationServerUrl: string,
  otp: string,
  token: string,
): Promise<string> =>
  commonRequestHandler(
    async () => {
      const response = await axios.post(
        `${organizationServerUrl}/${authController}/verify-reset`,
        {
          token: otp,
        },
        {
          headers: {
            otp: token,
          },
        },
      );
      return response.data.token;
    },
    'Failed to verify password reset',
    'Incorrect code. Please try again.',
    { 429: 'Too many attempts. Please request a new code.' },
  );

/* Sets new password after being OTP verified */
export const setPassword = async (
  organizationServerUrl: string,
  password: string,
  token: string,
): Promise<void> =>
  commonRequestHandler(async () => {
    const response = await axios.patch(
      `${organizationServerUrl}/${authController}/set-password`,
      {
        password,
      },
      {
        headers: {
          otp: token,
        },
      },
    );
    return response.data;
  }, 'Failed to set new password');

/* ADMIN ONLY: Signs a user to the organization */
export const signUp = (
  organizationServerUrl: string,
  email: string,
): Promise<{
  id: number;
  email: string;
  createdAt: string;
}> =>
  commonRequestHandler(async () => {
    const response = await axiosWithCredentials.post(
      `${organizationServerUrl}/${authController}/signup`,
      {
        email,
      },
    );
    return response.data;
  }, 'Failed to sign up the user');

/* ADMIN ONLY: elevate a user to admin */
export const elevateUserToAdmin = (organizationServerUrl: string, id: number) =>
  commonRequestHandler(async () => {
    await axiosWithCredentials.patch<{id: number}, void>(`${organizationServerUrl}/${authController}/elevate-admin`, {
      id,
    });
  }, 'Failed to assign user as admin');
