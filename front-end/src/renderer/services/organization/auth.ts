import axios from 'axios';

import { axiosWithCredentials, commonRequestHandler } from '@renderer/utils';
import type { Organization } from '@prisma/client';

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
export const logout = async (org: Organization): Promise<{ id: number }> =>
  commonRequestHandler(async () => {
    const { data } = await axiosWithCredentials.post(org, `${authController}/logout`);
    return { id: data.id };
  }, 'Failed to Log out of Organization');

/* Changes the password */
export const changePassword = async (
  org: Organization,
  oldPassword: string,
  newPassword: string,
): Promise<void> =>
  commonRequestHandler(async () => {
    const response = await axiosWithCredentials.patch(org, `${authController}/change-password`, {
      oldPassword,
      newPassword,
    });
    return response.data;
  }, 'Failed to change user password');

/* Sends a reset password request */
export const resetPassword = async (org: Organization, email: string): Promise<string> =>
  commonRequestHandler(async () => {
    const response = await axios.post(`${org.serverUrl}/${authController}/reset-password`, {
      email,
    });
    return response.data.token;
  }, 'Failed to request passoword reset');

/* Sends the OTP in order to verify the password reset */
export const verifyReset = async (org: Organization, otp: string, token: string): Promise<string> =>
  commonRequestHandler(async () => {
    const response = await axios.post(
      `${org.serverUrl}/${authController}/verify-reset`,
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
export const setPassword = async (org: Organization, password: string, token: string): Promise<void> =>
  commonRequestHandler(async () => {
    const response = await axios.patch(
      `${org.serverUrl}/${authController}/set-password`,
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
  org: Organization,
  email: string,
): Promise<{
  id: number;
  email: string;
  createdAt: string;
}> =>
  commonRequestHandler(async () => {
    const response = await axiosWithCredentials.post(org, `${authController}/signup`, {
      email,
    });
    return response.data;
  }, 'Failed to sign up the user');

/* ADMIN ONLY: elevate a user to admin */
export const elevateUserToAdmin = (  org: Organization, id: number) =>
  commonRequestHandler(async () => {
    await axiosWithCredentials.patch(org, `${authController}/elevate-admin`, {
      id,
    });
  }, 'Failed to assign user as admin');
