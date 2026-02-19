const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');

// load env
dotenv.config();

// routes
const authRoutes = require('./routes/authRoutes');
const assessmentRoutes = require('./routes/assessmentRoutes');

// create app
const app = express();

const isProduction = process.env.NODE_ENV === 'production';
const allowedOrigins = (process.env.CORS_ORIGIN || '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

if (isProduction && allowedOrigins.length === 0) {
  throw new Error(
    'CORS_ORIGIN must be set in production (comma-separated origins).'
  );
}

// middlewares
app.use(cors({
  origin: (origin, callback) => {
    // Allow tools like curl/Postman/server-to-server without Origin header.
    if (!origin) {
      return callback(null, true);
    }

    if (!isProduction && allowedOrigins.length === 0) {
      return callback(null, true);
    }

    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    return callback(new Error('Not allowed by CORS'));
  },
  credentials: true
}));
app.use(express.json());

// routes
app.use('/api/auth', authRoutes);
app.use('/api/assessments', assessmentRoutes);

// health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'OK',
    message: 'Trainer Assessment API running'
  });
});

// start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
