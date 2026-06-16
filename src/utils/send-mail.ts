import * as nodemailer from 'nodemailer';

export async function sendVerificationCode(email: string, code: string) {
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASSWORD,
    },
  });

  const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;background-color:#f0f2f5;font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
          <tr>
            <td style="background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);padding:40px;text-align:center;">
              <h1 style="margin:0;color:#ffffff;font-size:28px;font-weight:700;">Synapse Cloud</h1>
              <p style="margin:8px 0 0;color:rgba(255,255,255,0.85);font-size:15px;">Verify your account</p>
            </td>
          </tr>
          <tr>
            <td style="padding:48px 40px;text-align:center;">
              <p style="margin:0 0 8px;font-size:22px;font-weight:600;color:#1a1a2e;">Check your inbox</p>
              <p style="margin:0 0 36px;font-size:15px;color:#6b7280;line-height:1.6;">Use the verification code below to complete your registration.<br>This code expires in <strong>5 minutes</strong>.</p>
              <div style="display:inline-block;background:#f5f3ff;border:2px dashed #667eea;border-radius:12px;padding:24px 48px;margin-bottom:36px;">
                <span style="font-size:40px;font-weight:800;letter-spacing:16px;color:#667eea;">${code}</span>
              </div>
              <p style="margin:0;font-size:13px;color:#9ca3af;">If you didn't request this, you can safely ignore this email.</p>
            </td>
          </tr>
          <tr>
            <td style="background:#f9fafb;padding:20px 40px;text-align:center;border-top:1px solid #f0f0f0;">
              <p style="margin:0;font-size:12px;color:#9ca3af;">© 2026 Synapse Cloud · All rights reserved</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;

  await transporter.sendMail({
    from: `"Synapse Cloud" <${process.env.EMAIL_USER}>`,
    to: email,
    subject: 'Email Verification Code',
    html: htmlContent,
  });
}

export async function sendResetPasswordLink(email: string, resetLink: string) {
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASSWORD,
    },
  });

  const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;background-color:#f0f2f5;font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
          <tr>
            <td style="background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);padding:40px;text-align:center;">
              <h1 style="margin:0;color:#ffffff;font-size:28px;font-weight:700;">Synapse Cloud</h1>
              <p style="margin:8px 0 0;color:rgba(255,255,255,0.85);font-size:15px;">Password Reset Request</p>
            </td>
          </tr>
          <tr>
            <td style="padding:48px 40px;text-align:center;">
              <p style="margin:0 0 8px;font-size:22px;font-weight:600;color:#1a1a2e;">Reset your password</p>
              <p style="margin:0 0 36px;font-size:15px;color:#6b7280;line-height:1.6;">We received a request to reset your password.<br>Click the button below to choose a new one.<br>This link is valid for <strong>15 minutes</strong>.</p>
              <a href="${resetLink}" style="display:inline-block;background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);color:#ffffff;text-decoration:none;padding:14px 40px;border-radius:8px;font-size:15px;font-weight:600;">Reset Password</a>
              <p style="margin:32px 0 0;font-size:13px;color:#9ca3af;">If you didn't request a password reset, you can safely ignore this email.<br>Your password will not be changed.</p>
            </td>
          </tr>
          <tr>
            <td style="background:#f9fafb;padding:20px 40px;text-align:center;border-top:1px solid #f0f0f0;">
              <p style="margin:0;font-size:12px;color:#9ca3af;">© 2026 Synapse Cloud · All rights reserved</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;

  await transporter.sendMail({
    from: `"Synapse Cloud" <${process.env.EMAIL_USER}>`,
    to: email,
    subject: 'Password Reset Request',
    html: htmlContent,
  });
}