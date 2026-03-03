const express = require('express');
const router = express.Router();
const {
  login,
  registerTrainer,
  requestPasswordResetOtp,
  verifyPasswordResetOtp,
  resetPasswordWithOtp,
  sendTestOtpEmail
} = require('../controllers/authController');

router.post('/login', login);
router.post('/register-trainer', registerTrainer);
router.post('/forgot-password/request', requestPasswordResetOtp);
router.post('/forgot-password/verify', verifyPasswordResetOtp);
router.post('/forgot-password/reset', resetPasswordWithOtp);
router.post('/test/send-otp', sendTestOtpEmail);

module.exports = router;
