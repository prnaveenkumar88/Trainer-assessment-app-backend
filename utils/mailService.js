const nodemailer = require('nodemailer');

const toInt = (value, fallback) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const smtpPort = toInt(process.env.SMTP_PORT, 587);
const smtpSecure =
  String(process.env.SMTP_SECURE || '').toLowerCase() === 'true' ||
  smtpPort === 465;
const otpExpiryMinutes = toInt(process.env.PASSWORD_RESET_OTP_MINUTES, 10);

const smtpHost = process.env.SMTP_HOST || '';
const smtpUser = process.env.SMTP_USER || '';
const smtpPass = process.env.SMTP_PASS || '';
const smtpFrom = process.env.SMTP_FROM || '';

const missingMailConfigKeys = [];
if (!smtpHost) missingMailConfigKeys.push('SMTP_HOST');
if (!smtpUser) missingMailConfigKeys.push('SMTP_USER');
if (!smtpPass) missingMailConfigKeys.push('SMTP_PASS');
if (!smtpFrom) missingMailConfigKeys.push('SMTP_FROM');

const mailConfigured = missingMailConfigKeys.length === 0;

let transporter = null;

if (mailConfigured) {
  transporter = nodemailer.createTransport({
    host: smtpHost,
    port: smtpPort,
    secure: smtpSecure,
    auth: {
      user: smtpUser,
      pass: smtpPass
    }
  });
}

const isMailConfigured = () => mailConfigured;

const getMissingMailConfigKeys = () => [...missingMailConfigKeys];

const sendOTP = async (email, otp) => {
  if (!transporter) {
    throw new Error('SMTP is not configured');
  }

  const subject = 'Your OTP for Password Reset';
  const text = [
    'Hello,',
    '',
    `Your password reset OTP is: ${otp}`,
    `This OTP expires in ${otpExpiryMinutes} minutes.`,
    '',
    'If you did not request this, ignore this email.'
  ].join('\n');

  const html = `
    <div style="font-family: Arial, sans-serif; line-height: 1.5; color: #111827;">
      <p>Hello,</p>
      <p>Your password reset OTP is:</p>
      <p style="font-size: 24px; font-weight: 700; letter-spacing: 4px; margin: 8px 0;">
        ${otp}
      </p>
      <p>This OTP expires in <strong>${otpExpiryMinutes} minutes</strong>.</p>
      <p>If you did not request this, you can ignore this email.</p>
    </div>
  `;

  await transporter.sendMail({
    from: smtpFrom,
    to: email,
    subject,
    text,
    html
  });
};

module.exports = {
  isMailConfigured,
  getMissingMailConfigKeys,
  sendOTP
};
