import { ELECTRON_APP_PROTOCOL_PREFIX } from '@app/common';

export const generateResetPasswordMessage = (additionalData: Record<string, any>) => {
  const { otp } = additionalData;
  return `
      <div>
        <h1 style="margin: 0">Hedera Transaction Tool</h1>
        <p style="margin: 0">Use the following token to reset your password: <b>${otp}</b></p>
        <a href="${ELECTRON_APP_PROTOCOL_PREFIX}token=${otp}" style="text-decoration: none; color: white; background-color: #6600cc; padding: 8px 22px; border-radius: 6px;">Verify</a>
      </div>
      `;
}