const express = require('express');
const router = express.Router();

const {
  login,
  getMe
} = require('../controllers/authController');

const { verifyToken } = require('../middleware/authMiddleware');

router.post('/login', login);
router.get('/me', verifyToken, getMe);

module.exports = router;