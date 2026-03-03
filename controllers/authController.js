const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const db = require('../config/mysql');
const {
  isMailConfigured,
  getMissingMailConfigKeys,
  sendOTP
} = require('../utils/mailService');
const { generateOTP } = require('../utils/generateOTP');

const BCRYPT_SALT_ROUNDS = 10;

const toPositiveInt = (value, fallback) => {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }
  return parsed;
};

const OTP_EXPIRY_MINUTES = toPositiveInt(
  process.env.PASSWORD_RESET_OTP_MINUTES,
  10
);
const OTP_REQUEST_COOLDOWN_SECONDS = toPositiveInt(
  process.env.PASSWORD_RESET_OTP_COOLDOWN_SECONDS,
  60
);
const OTP_MAX_ATTEMPTS = toPositiveInt(
  process.env.PASSWORD_RESET_OTP_MAX_ATTEMPTS,
  5
);
const RESET_SESSION_TOKEN_MINUTES = toPositiveInt(
  process.env.PASSWORD_RESET_SESSION_MINUTES,
  15
);
const PASSWORD_MIN_LENGTH = toPositiveInt(
  process.env.PASSWORD_RESET_MIN_PASSWORD_LENGTH,
  8
);

const OTP_REQUEST_ACCEPTED_MESSAGE =
  'If an account exists for this email, an OTP has been sent.';

let hasEnsuredPasswordResetTable = false;

const ensurePasswordResetTable = async () => {
  if (hasEnsuredPasswordResetTable) {
    return;
  }

  await db.query(`
    CREATE TABLE IF NOT EXISTS password_reset_otps (
      otp_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      email VARCHAR(255) NOT NULL,
      otp_hash CHAR(64) NOT NULL,
      expires_at DATETIME NOT NULL,
      attempts TINYINT UNSIGNED NOT NULL DEFAULT 0,
      consumed TINYINT(1) NOT NULL DEFAULT 0,
      used_at DATETIME NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (otp_id),
      INDEX idx_password_reset_otps_email_created (email, created_at),
      INDEX idx_password_reset_otps_expires (expires_at)
    )
  `);

  hasEnsuredPasswordResetTable = true;
};

const normalizeEmail = (value) => {
  if (typeof value !== 'string') {
    return '';
  }
  return value.trim().toLowerCase();
};

const normalizeText = (value) => {
  if (typeof value !== 'string') {
    return '';
  }
  return value.trim();
};

const normalizeOptionalText = (value) => {
  const normalized = normalizeText(value);
  return normalized || null;
};

const isValidIsoDate = (value) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) {
    return false;
  }

  return parsed.toISOString().slice(0, 10) === value;
};

const isValidEmail = (value) => {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
};

const hashOtp = (otp) => {
  const otpSecret =
    process.env.PASSWORD_RESET_OTP_SECRET ||
    process.env.JWT_SECRET ||
    'otp-secret';

  return crypto
    .createHash('sha256')
    .update(`${otp}:${otpSecret}`)
    .digest('hex');
};

const getLatestActiveOtpRecord = async (email) => {
  const [otpRows] = await db.query(
    `SELECT otp_id, otp_hash, attempts, expires_at
     FROM password_reset_otps
     WHERE email = ? AND consumed = 0
     ORDER BY created_at DESC
     LIMIT 1`,
    [email]
  );

  return otpRows.length > 0 ? otpRows[0] : null;
};

const getActiveOtpRecordById = async (email, otpId) => {
  const [otpRows] = await db.query(
    `SELECT otp_id, otp_hash, attempts, expires_at
     FROM password_reset_otps
     WHERE email = ? AND otp_id = ? AND consumed = 0
     LIMIT 1`,
    [email, otpId]
  );

  return otpRows.length > 0 ? otpRows[0] : null;
};

const consumeOtpById = async (otpId) => {
  await db.query(
    `UPDATE password_reset_otps
     SET consumed = 1, used_at = NOW()
     WHERE otp_id = ?`,
    [otpId]
  );
};

const consumeAllActiveOtpsByEmail = async (email) => {
  await db.query(
    `UPDATE password_reset_otps
     SET consumed = 1, used_at = NOW()
     WHERE email = ? AND consumed = 0`,
    [email]
  );
};

const validateOtpForEmail = async (email, otp) => {
  const otpRecord = await getLatestActiveOtpRecord(email);
  if (!otpRecord) {
    return {
      ok: false,
      message: 'Invalid or expired OTP'
    };
  }

  const isExpired =
    new Date(otpRecord.expires_at).getTime() < Date.now();
  if (isExpired) {
    await consumeOtpById(otpRecord.otp_id);
    return {
      ok: false,
      message: 'Invalid or expired OTP'
    };
  }

  const attempts = Number(otpRecord.attempts || 0);
  if (attempts >= OTP_MAX_ATTEMPTS) {
    await consumeOtpById(otpRecord.otp_id);
    return {
      ok: false,
      message: 'Invalid or expired OTP'
    };
  }

  const providedOtpHash = hashOtp(otp);
  if (providedOtpHash !== otpRecord.otp_hash) {
    const nextAttempts = attempts + 1;
    const shouldConsume = nextAttempts >= OTP_MAX_ATTEMPTS ? 1 : 0;

    await db.query(
      `UPDATE password_reset_otps
       SET
         attempts = ?,
         consumed = ?,
         used_at = CASE WHEN ? = 1 THEN NOW() ELSE used_at END
       WHERE otp_id = ?`,
      [nextAttempts, shouldConsume, shouldConsume, otpRecord.otp_id]
    );

    return {
      ok: false,
      message: 'Invalid or expired OTP'
    };
  }

  return {
    ok: true,
    otpRecord
  };
};

const generatePasswordResetSessionToken = (email, otpId) => {
  return jwt.sign(
    {
      purpose: 'password_reset',
      email,
      otpId
    },
    process.env.JWT_SECRET,
    { expiresIn: `${RESET_SESSION_TOKEN_MINUTES}m` }
  );
};

const verifyPasswordResetSessionToken = (token) => {
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    if (
      payload?.purpose !== 'password_reset' ||
      !payload?.email ||
      !payload?.otpId
    ) {
      return null;
    }
    return payload;
  } catch (error) {
    return null;
  }
};

const generateToken = (user) => {
  return jwt.sign(
    {
      id: user.user_id,
      role: user.role,
      name: user.name,
      email: user.email
    },
    process.env.JWT_SECRET,
    { expiresIn: '1d' }
  );
};

exports.login = async (req, res) => {
  try {
    const email = normalizeEmail(req.body?.email);
    const { password } = req.body;

    const [rows] = await db.query(
      'SELECT * FROM users WHERE email = ?',
      [email]
    );

    if (rows.length === 0) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const user = rows[0];
    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const token = generateToken(user);

    res.json({
      token,
      role: user.role,
      name: user.name,
      email: user.email
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

exports.registerTrainer = async (req, res) => {
  try {
    const name = normalizeText(req.body?.name);
    const email = normalizeEmail(req.body?.email);
    const password =
      typeof req.body?.password === 'string' ? req.body.password : '';
    const department = normalizeOptionalText(req.body?.department);
    const branch = normalizeOptionalText(req.body?.branch);
    const dateOfJoining = normalizeOptionalText(req.body?.date_of_joining);

    if (!name || !email || !password) {
      return res.status(400).json({
        message: 'Name, email and password are required'
      });
    }

    if (name.length > 100) {
      return res.status(400).json({
        message: 'Name must be at most 100 characters'
      });
    }

    if (!isValidEmail(email)) {
      return res.status(400).json({
        message: 'Invalid email format'
      });
    }

    if (email.length > 100) {
      return res.status(400).json({
        message: 'Email must be at most 100 characters'
      });
    }

    if (department && department.length > 50) {
      return res.status(400).json({
        message: 'Department must be at most 50 characters'
      });
    }

    if (branch && branch.length > 50) {
      return res.status(400).json({
        message: 'Branch must be at most 50 characters'
      });
    }

    if (dateOfJoining && !isValidIsoDate(dateOfJoining)) {
      return res.status(400).json({
        message: 'Date of joining must be in YYYY-MM-DD format'
      });
    }

    if (password.length < PASSWORD_MIN_LENGTH) {
      return res.status(400).json({
        message: `Password must be at least ${PASSWORD_MIN_LENGTH} characters`
      });
    }

    const [existingUsers] = await db.query(
      'SELECT user_id FROM users WHERE email = ? LIMIT 1',
      [email]
    );

    if (existingUsers.length > 0) {
      return res.status(409).json({
        message: 'Email already exists'
      });
    }

    const hashedPassword = await bcrypt.hash(
      password,
      BCRYPT_SALT_ROUNDS
    );

    await db.query(
      `INSERT INTO users (
        name,
        email,
        password,
        role,
        department,
        branch,
        date_of_joining
      ) VALUES (?, ?, ?, 'trainer', ?, ?, ?)`,
      [
        name,
        email,
        hashedPassword,
        department,
        branch,
        dateOfJoining
      ]
    );

    res.status(201).json({
      message: 'Trainer registered successfully'
    });
  } catch (error) {
    res.status(500).json({
      message: 'Unable to register trainer right now'
    });
  }
};

exports.requestPasswordResetOtp = async (req, res) => {
  try {
    if (!isMailConfigured()) {
      const missingKeys = getMissingMailConfigKeys();
      return res.status(500).json({
        message: 'Email service is not configured on the server',
        missing: missingKeys
      });
    }

    const email = normalizeEmail(req.body?.email);
    if (!email) {
      return res.status(400).json({ message: 'Email is required' });
    }

    await ensurePasswordResetTable();

    const [users] = await db.query(
      'SELECT email FROM users WHERE email = ? LIMIT 1',
      [email]
    );

    if (users.length === 0) {
      return res.json({ message: OTP_REQUEST_ACCEPTED_MESSAGE });
    }

    const [latestRows] = await db.query(
      `SELECT created_at
       FROM password_reset_otps
       WHERE email = ?
       ORDER BY created_at DESC
       LIMIT 1`,
      [email]
    );

    if (latestRows.length > 0) {
      const latestCreatedAt = new Date(latestRows[0].created_at).getTime();
      const cooldownEndsAt =
        latestCreatedAt + (OTP_REQUEST_COOLDOWN_SECONDS * 1000);
      if (Date.now() < cooldownEndsAt) {
        return res.json({ message: OTP_REQUEST_ACCEPTED_MESSAGE });
      }
    }

    const otp = generateOTP();
    const otpHash = hashOtp(otp);
    const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);

    await consumeAllActiveOtpsByEmail(email);

    const [insertResult] = await db.query(
      `INSERT INTO password_reset_otps (email, otp_hash, expires_at)
       VALUES (?, ?, ?)`,
      [email, otpHash, expiresAt]
    );

    try {
      await sendOTP(users[0].email, otp);
    } catch (mailError) {
      await db.query(
        `UPDATE password_reset_otps
         SET consumed = 1, used_at = NOW()
         WHERE otp_id = ?`,
        [insertResult.insertId]
      );
      throw mailError;
    }

    res.json({ message: OTP_REQUEST_ACCEPTED_MESSAGE });
  } catch (error) {
    const payload = { message: 'Unable to send OTP right now' };

    if (process.env.NODE_ENV !== 'production') {
      payload.error = error.message;
      payload.code = error.code || null;
    }

    res.status(500).json(payload);
  }
};

exports.verifyPasswordResetOtp = async (req, res) => {
  try {
    const email = normalizeEmail(req.body?.email);
    const otp = typeof req.body?.otp === 'string' ? req.body.otp.trim() : '';

    if (!email || !otp) {
      return res.status(400).json({
        message: 'Email and OTP are required'
      });
    }

    if (!/^\d{6}$/.test(otp)) {
      return res.status(400).json({
        message: 'OTP must be a 6-digit code'
      });
    }

    await ensurePasswordResetTable();

    const otpValidationResult = await validateOtpForEmail(email, otp);
    if (!otpValidationResult.ok) {
      return res.status(400).json({
        message: otpValidationResult.message
      });
    }

    const resetToken = generatePasswordResetSessionToken(
      email,
      otpValidationResult.otpRecord.otp_id
    );

    res.json({
      message: 'OTP verified successfully',
      resetToken
    });
  } catch (error) {
    res.status(500).json({
      message: 'Unable to verify OTP right now'
    });
  }
};

exports.sendTestOtpEmail = async (req, res) => {
  try {
    if (!isMailConfigured()) {
      return res.status(500).json({
        message: 'Email service is not configured on the server',
        missing: getMissingMailConfigKeys()
      });
    }

    const email = normalizeEmail(req.body?.email);
    if (!email) {
      return res.status(400).json({ message: 'Email is required' });
    }

    const otp = generateOTP();
    await sendOTP(email, otp);

    const payload = {
      message: `Test OTP sent successfully to ${email}`
    };

    if (process.env.NODE_ENV !== 'production') {
      payload.otp = otp;
    }

    res.json(payload);
  } catch (error) {
    const payload = { message: 'Unable to send test OTP right now' };

    if (process.env.NODE_ENV !== 'production') {
      payload.error = error.message;
      payload.code = error.code || null;
    }

    res.status(500).json(payload);
  }
};

exports.resetPasswordWithOtp = async (req, res) => {
  try {
    const email = normalizeEmail(req.body?.email);
    const otp = typeof req.body?.otp === 'string' ? req.body.otp.trim() : '';
    const resetToken = typeof req.body?.resetToken === 'string'
      ? req.body.resetToken.trim()
      : '';
    const newPassword =
      typeof req.body?.newPassword === 'string'
        ? req.body.newPassword
        : '';

    if (!email || !newPassword || (!resetToken && !otp)) {
      return res.status(400).json({
        message: 'Email, verification token (or OTP), and new password are required'
      });
    }

    if (otp && !/^\d{6}$/.test(otp)) {
      return res.status(400).json({
        message: 'OTP must be a 6-digit code'
      });
    }

    if (newPassword.length < PASSWORD_MIN_LENGTH) {
      return res.status(400).json({
        message: `Password must be at least ${PASSWORD_MIN_LENGTH} characters`
      });
    }

    await ensurePasswordResetTable();

    if (resetToken) {
      const tokenPayload = verifyPasswordResetSessionToken(resetToken);
      if (!tokenPayload || tokenPayload.email !== email) {
        return res.status(400).json({
          message: 'Invalid or expired verification session'
        });
      }

      const otpRecord = await getActiveOtpRecordById(email, tokenPayload.otpId);
      if (!otpRecord) {
        return res.status(400).json({
          message: 'Invalid or expired verification session'
        });
      }

      const isExpired =
        new Date(otpRecord.expires_at).getTime() < Date.now();
      if (isExpired) {
        await consumeOtpById(otpRecord.otp_id);
        return res.status(400).json({
          message: 'Invalid or expired verification session'
        });
      }
    } else {
      const otpValidationResult = await validateOtpForEmail(email, otp);
      if (!otpValidationResult.ok) {
        return res.status(400).json({
          message: otpValidationResult.message
        });
      }
    }

    const [users] = await db.query(
      'SELECT user_id FROM users WHERE email = ? LIMIT 1',
      [email]
    );

    if (users.length === 0) {
      return res.status(400).json({
        message: 'Invalid or expired OTP'
      });
    }

    const hashedPassword = await bcrypt.hash(
      newPassword,
      BCRYPT_SALT_ROUNDS
    );

    await db.query(
      'UPDATE users SET password = ? WHERE email = ?',
      [hashedPassword, email]
    );

    await consumeAllActiveOtpsByEmail(email);

    res.json({ message: 'Password updated successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Unable to reset password right now' });
  }
};
