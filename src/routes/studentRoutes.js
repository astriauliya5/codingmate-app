const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, path.join(__dirname, '../../public/uploads/students'));
  },
  filename: function (req, file, cb) {
    const ext = path.extname(file.originalname);
    const uniqueName = `student-${Date.now()}-${Math.round(Math.random() * 1E9)}${ext}`;
    cb(null, uniqueName);
  }
});

const fileFilter = function (req, file, cb) {
  const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg', 'image/webp'];

  if (!allowedTypes.includes(file.mimetype)) {
    return cb(new Error('File harus berupa gambar JPG, PNG, atau WEBP'));
  }

  cb(null, true);
};

const uploadStudentPhoto = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 2 * 1024 * 1024
  }
});

const {
  getStudents,
  getStudentById,
  createStudent,
  updateStudent,
  deleteStudent,
  getMentorStudents,
  getMentorStudentById
} = require('../controllers/studentController');

const { verifyToken, allowRoles } = require('../middleware/authMiddleware');

// Mentor routes harus di atas /:id
router.get('/mentor', verifyToken, allowRoles('mentor'), getMentorStudents);
router.get('/mentor/:id', verifyToken, allowRoles('mentor'), getMentorStudentById);

// Admin routes
router.get('/', verifyToken, allowRoles('admin'), getStudents);
router.get('/:id', verifyToken, allowRoles('admin'), getStudentById);
router.post('/', verifyToken, allowRoles('admin'), uploadStudentPhoto.single('photo'), createStudent);
router.put('/:id', verifyToken, allowRoles('admin'), uploadStudentPhoto.single('photo'), updateStudent);
router.delete('/:id', verifyToken, allowRoles('admin'), deleteStudent);

module.exports = router;