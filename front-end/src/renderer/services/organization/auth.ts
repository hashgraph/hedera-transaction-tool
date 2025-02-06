import axios from 'axios';

import { axiosWithCredentials, commonRequestHandler } from '@renderer/utils';

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
      const { data } = await axiosWithCredentials.post(`${serverUrl}/${authController}/login`, {
        email,
        password,
      });

      return { id: data.user.id, jwtToken: data.accessToken };
    },
    'Failed to Sign in Organization',
    'Invalid email or password',
  );

/* Logout the user */
export const logout = async (serverUrl: string): Promise<{ id: number }> =>
  commonRequestHandler(async () => {
    const { data } = await axiosWithCredentials.post(`${serverUrl}/${authController}/logout`);
    return { id: data.id };
  }, 'Failed to Log out of Organization');

/* Changes the password */
export const changePassword = async (
  organizationServerUrl: string,
  oldPassword: string,
  newPassword: string,
): Promise<void> =>
  commonRequestHandler(async () => {
    const response = await axiosWithCredentials.patch(
      `${organizationServerUrl}/${authController}/change-password`,
      {
        oldPassword,
        newPassword,
      },
    );
    return response.data;
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
  }, 'Failed to request passoword reset');

/* Sends the OTP in order to verify the password reset */
export const verifyReset = async (
  organizationServerUrl: string,
  otp: string,
  token: string,
): Promise<string> =>
  commonRequestHandler(async () => {
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
  }, 'Failed to verify password reset');

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
    await axiosWithCredentials.patch(`${organizationServerUrl}/${authController}/elevate-admin`, {
      id,
    });
  }, 'Failed to assign user as admin');
