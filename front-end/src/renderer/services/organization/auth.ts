import axios from 'axios';

import { commonRequestHandler } from '@renderer/utils';

/* Authentification service for organization */

const authController = 'auth';

/* Login the user */
export const login = async (
  serverUrl: string,
  email: string,
  password: string,
): Promise<{ id: number }> =>
  commonRequestHandler(
    async () => {
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
    },
    'Failed to Sign in Organization',
    'Invalid email or password',
  );

/* Logout the user */
export const logout = async (serverUrl: string): Promise<{ id: number }> =>
  commonRequestHandler(async () => {
    const { data } = await axios.post(
      `${serverUrl}/${authController}/logout`,
      {},
      {
        withCredentials: true,
      },
    );

    return { id: data.id };
  }, 'Failed to Log out of Organization');

/* Changes the password */
export const changePassword = async (
  organizationServerUrl: string,
  oldPassword: string,
  newPassword: string,
): Promise<void> =>
  commonRequestHandler(async () => {
    const response = await axios.patch(
      `${organizationServerUrl}/${authController}/change-password`,
      {
        oldPassword,
        newPassword,
      },
      {
        withCredentials: true,
      },
    );
    return response.data;
  }, 'Failed to change user password');

/* Sends a reset password request */
export const resetPassword = async (organizationServerUrl: string, email: string): Promise<void> =>
  commonRequestHandler(async () => {
    const response = await axios.post(
      `${organizationServerUrl}/${authController}/reset-password`,
      {
        email,
      },
      {
        withCredentials: true,
      },
    );
    return response.data;
  }, 'Failed to request passoword reset');

/* Sends the OTP in order to verify the password reset */
export const verifyReset = async (organizationServerUrl: string, otp: string): Promise<void> =>
  commonRequestHandler(async () => {
    const response = await axios.post(
      `${organizationServerUrl}/${authController}/verify-reset`,
      {
        token: otp,
      },
      {
        withCredentials: true,
      },
    );
    return response.data;
  }, 'Failed to verify password reset');

/* Sets new password after being OTP verified */
export const setPassword = async (organizationServerUrl: string, password: string): Promise<void> =>
  commonRequestHandler(async () => {
    const response = await axios.patch(
      `${organizationServerUrl}/${authController}/set-password`,
      {
        password,
      },
      {
        withCredentials: true,
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
    const response = await axios.post(
      `${organizationServerUrl}/${authController}/signup`,
      {
        email,
      },
      {
        withCredentials: true,
      },
    );
    return response.data;
  }, 'Failed to sign up the user');
