const express = require('express');
const router = express.Router();

const {
  login,
  getMe,
  updateMe,
  updatePassword
} = require('../controllers/authController');

const { verifyToken } = require('../middleware/authMiddleware');

router.post('/login', login);
router.get('/me', verifyToken, getMe);
router.put('/me', verifyToken, updateMe);
router.put('/me/password', verifyToken, updatePassword);

module.exports = router;