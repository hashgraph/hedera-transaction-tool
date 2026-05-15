import { ELECTRON_APP_PROTOCOL_PREFIX } from "../constants";

export function emailWrapper(content: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="color-scheme" content="light" />
  <meta name="supported-color-schemes" content="light" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
</head>
<body style="margin:0;padding:0;background-color:#f2f2f2;font-family:'Trebuchet MS',Arial,sans-serif;color:#1a1a1a;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f2f2f2;padding:0 24px;">
  <tr>
    <td align="center" valign="top">

      <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
        style="max-width:860px;background-color:#ffffff;border-left:1px solid #e0e0e0;border-right:1px solid #e0e0e0;border-bottom:1px solid #e0e0e0;">
        ${content}
      </table>

      ${emailFooter()}

    </td>
  </tr>
</table>
</body>
</html>`;
}

export function emailHeader(title: string, subtitle?: string): string {
  const subtitleHtml = subtitle
    ? `<p style="margin:0 0 6px;font-size:11px;letter-spacing:3px;text-transform:uppercase;color:rgba(255,255,255,0.55);">
         ${escapeHtml(subtitle)}
       </p>`
    : "";

  return `
<tr>
  <td style="background:linear-gradient(135deg,#5500bb 0%,#7722ee 50%,#9944ff 100%);padding:32px 36px 28px;">
    ${subtitleHtml}
    <h1 style="margin:0;font-size:26px;font-weight:700;color:#ffffff;letter-spacing:-0.5px;line-height:1.2;">
      ${escapeHtml(title)}
    </h1>
  </td>
</tr>
<tr>
  <td style="height:3px;background:linear-gradient(90deg,#9944ff,#cc77ff,#ff99cc,#cc77ff,#9944ff);font-size:0;line-height:0;">
    &nbsp;
  </td>
</tr>`;
}

export function emailFooter(): string {
  const currentYear = new Date().getFullYear();
  return `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:860px;">
  <tr>
    <td style="padding:20px 40px 8px;font-size:11px;line-height:18px;color:#aaaaaa;text-align:center;letter-spacing:0.3px;">
      This is an automated message &nbsp;·&nbsp; Please do not reply
    </td>
  </tr>
  <tr>
    <td style="padding:0 40px 32px;font-size:11px;line-height:18px;color:#cccccc;text-align:center;letter-spacing:0.3px;">
      Copyright &copy; ${currentYear} Hedera
    </td>
  </tr>
</table>`;
}

export function emailBody(content: string): string {
  return `
<tr>
  <td style="padding:40px 40px 24px;background-color:#fafafa;">
    ${content}
  </td>
</tr>`;
}

export function emailReviewButton(route: string, message?: string): string {
  if (!message) {
    return `
<table role="presentation" cellpadding="0" cellspacing="0" style="margin-top:48px;">
  <tr>
    <td valign="middle">
      <a href="${ELECTRON_APP_PROTOCOL_PREFIX}${route}"
         style="display:inline-block;padding:13px 28px;background:linear-gradient(135deg,#6611cc 0%,#8833ee 100%);
                color:#ffffff;font-family:'Trebuchet MS',Arial,sans-serif;font-size:14px;font-weight:700;
                text-decoration:none;border-radius:6px;letter-spacing:0.3px;white-space:nowrap;">
        Review in App
      </a>
    </td>
  </tr>
</table>`;
  }

  return `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:48px;">
  <tr>
    <td valign="middle" style="width:1%;white-space:nowrap;padding-right:16px;">
      <a href="hedera-transaction-tool://${route}"
         style="display:inline-block;padding:13px 28px;background:linear-gradient(135deg,#6611cc 0%,#8833ee 100%);
                color:#ffffff;font-family:'Trebuchet MS',Arial,sans-serif;font-size:14px;font-weight:700;
                text-decoration:none;border-radius:6px;letter-spacing:0.3px;white-space:nowrap;">
        Review in App
      </a>
    </td>
    <td valign="middle" style="padding:14px 18px;background-color:#fffbf0;border:1px solid #ffe4a0;
               border-radius:6px;font-size:12px;line-height:20px;color:#776600;">
      <span style="font-size:14px;">⚠️</span>&nbsp;
      ${escapeHtml(message)}
    </td>
  </tr>
</table>`;
}

export function emailWarning(message: string): string {
  return `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:48px;">
  <tr>
    <td style="padding:14px 18px;background-color:#fffbf0;border:1px solid #ffe4a0;
               border-radius:6px;font-size:12px;line-height:20px;color:#776600;">
      <span style="font-size:14px;">⚠️</span>&nbsp;
      ${escapeHtml(message)}
    </td>
  </tr>
</table>`;
}

export function escapeHtml(str: string | null | undefined): string {
  if (str == null) {
    return "";
  }

  const value = String(str);

  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function emailCardTable(rowsHtml: string): string {
  return `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"
  style="border:1px solid #e2d4f8;border-radius:6px;overflow:hidden;">
  ${rowsHtml}
</table>`;
}

export function emailCardRow(
  cellsHtml: string,
  index: number,
  options?: { disableStripe?: boolean }
): string {
  const bg = options?.disableStripe
    ? "#ffffff"
    : index % 2 === 0
      ? "#f7f3ff"
      : "#ffffff";

  const borderTop = index > 0 ? "border-top:1px solid #e2d4f8;" : "";

  return `
<tr>
  ${cellsHtml.replaceAll(
    "__ROW_STYLE__",
    `background-color:${bg};${borderTop}`
  )}
</tr>`;
}

export function renderTransactionEmailLayout(
  title: string,
  bodyContent: string
): string {
  const content = `
    ${emailHeader(title, "Hedera Transaction Tool")}
    ${emailBody(bodyContent)}
  `;

  return emailWrapper(content);
}

