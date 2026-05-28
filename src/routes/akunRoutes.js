const express = require('express');
const router = express.Router();

const {
  getAkunMentor,
  getAkunMentorById,
  createAkunMentor,
  updateAkunMentor,
  deleteAkunMentor
} = require('../controllers/akunController');

const { verifyToken, allowRoles } = require('../middleware/authMiddleware');

router.get('/', verifyToken, allowRoles('admin'), getAkunMentor);
router.get('/:id', verifyToken, allowRoles('admin'), getAkunMentorById);
router.post('/', verifyToken, allowRoles('admin'), createAkunMentor);
router.put('/:id', verifyToken, allowRoles('admin'), updateAkunMentor);
router.delete('/:id', verifyToken, allowRoles('admin'), deleteAkunMentor);

module.exports = router;