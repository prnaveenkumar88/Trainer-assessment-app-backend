const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');

// routes
const authRoutes = require('./routes/authRoutes');
const assessmentRoutes = require('./routes/assessmentRoutes');

// load env
dotenv.config();

// create app
const app = express();

// middlewares
app.use(cors());
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
