const express = require('express');
const router = express.Router();
const { updateAttempt } = require('../controllers/assessmentController');

const {
  createAssessment,
  getAssessments,
  getAssessmentById,
  getUserByEmail

} = require('../controllers/assessmentController');

const {
  protect,
  allowRoles
} = require('../middleware/authMiddleware');

// CREATE → Assessor only
router.post(
  '/',
  protect,
  allowRoles('assessor'),
  createAssessment
);
router.get("/by-email/:email", protect, getUserByEmail);

// READ → Admin, Assessor, Trainer
router.get(
  '/',
  protect,
  allowRoles('admin', 'assessor', 'trainer'),
  getAssessments
);


// UPDATE attempt → Assessor only
router.put(
  '/:id/attempt',
  protect,
  allowRoles('assessor'),
  updateAttempt
);

router.get('/:id', protect, allowRoles('admin', 'assessor', 'trainer'), getAssessmentById);


module.exports = router;
