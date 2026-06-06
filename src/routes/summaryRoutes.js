const express = require('express');
const router = express.Router();

const {
  getSummaries,
  getSummaryById,
  approveSummary,
  getMentorSummaries,
  getMentorSummaryOptions,
  getMentorSummaryById,
  createSummary,
  deleteMentorSummary
} = require('../controllers/summaryController');

const { verifyToken, allowRoles } = require('../middleware/authMiddleware');

// Admin
router.get('/', verifyToken, allowRoles('admin'), getSummaries);
router.get('/admin/:id', verifyToken, allowRoles('admin'), getSummaryById);
router.patch('/:id/approve', verifyToken, allowRoles('admin'), approveSummary);

// Mentor
router.get('/mentor', verifyToken, allowRoles('mentor'), getMentorSummaries);
router.get('/mentor/options', verifyToken, allowRoles('mentor'), getMentorSummaryOptions);
router.get('/mentor/:id', verifyToken, allowRoles('mentor'), getMentorSummaryById);
router.post('/', verifyToken, allowRoles('mentor'), createSummary);
router.delete('/:id', verifyToken, allowRoles('mentor'), deleteMentorSummary);

module.exports = router;