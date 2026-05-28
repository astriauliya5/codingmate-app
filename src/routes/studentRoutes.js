const express = require('express');
const router = express.Router();

const {
  getStudents,
  getStudentById,
  createStudent,
  deleteStudent
} = require('../controllers/studentController');

const { verifyToken, allowRoles } = require('../middleware/authMiddleware');

router.get('/', verifyToken, getStudents);
router.get('/:id', verifyToken, getStudentById);

router.post('/', verifyToken, allowRoles('admin'), createStudent);
router.delete('/:id', verifyToken, allowRoles('admin'), deleteStudent);

module.exports = router;