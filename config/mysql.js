const mysql = require('mysql2');

const toInt = (value, fallback) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const isProduction = process.env.NODE_ENV === 'production';

const requiredEnvVars = [
  'DB_HOST',
  'DB_USER',
  'DB_PASSWORD',
  'DB_NAME',
  'JWT_SECRET'
];
if (isProduction) {
  const missing = requiredEnvVars.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(', ')}`
    );
  }
}

const useSsl = String(process.env.DB_SSL || '').toLowerCase() === 'true';

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: toInt(process.env.DB_PORT, 3306),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || 'root',
  database: process.env.DB_NAME || 'trainer_assessment_db',
  waitForConnections: true,
  connectionLimit: toInt(process.env.DB_CONNECTION_LIMIT, 10),
  queueLimit: 0,
  ssl: useSsl
    ? {
        rejectUnauthorized:
          String(
            process.env.DB_SSL_REJECT_UNAUTHORIZED || 'true'
          ).toLowerCase() === 'true'
      }
    : undefined
});

module.exports = pool.promise();
