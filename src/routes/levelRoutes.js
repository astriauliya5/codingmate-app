const express = require('express');
const router = express.Router();

const {
  getLevels,
  getLevelById,
  createLevel,
  updateLevel,
  deleteLevel
} = require('../controllers/levelController');

const { verifyToken, allowRoles } = require('../middleware/authMiddleware');

router.get('/', verifyToken, getLevels);
router.get('/:id', verifyToken, getLevelById);

router.post('/', verifyToken, allowRoles('admin'), createLevel);
router.put('/:id', verifyToken, allowRoles('admin'), updateLevel);
router.delete('/:id', verifyToken, allowRoles('admin'), deleteLevel);

module.exports = router;