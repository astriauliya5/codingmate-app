const express = require('express');
const router = express.Router();

const emptyScheduleController = require('../controllers/emptyScheduleController');
const { verifyToken, allowRoles } = require('../middleware/authMiddleware');

// Admin: bisa lihat semua / per mentor
// Mentor: otomatis cuma lihat jadwal kosong miliknya sendiri
router.get('/week', verifyToken, emptyScheduleController.getWeeklyEmptySchedules);

// Mentor menambahkan jadwal kosong miliknya sendiri
router.post(
  '/',
  verifyToken,
  allowRoles('mentor'),
  emptyScheduleController.createEmptySchedule
);

// Mentor menghapus/cancel jadwal kosong miliknya sendiri
router.delete(
  '/:id',
  verifyToken,
  allowRoles('mentor'),
  emptyScheduleController.deleteEmptySchedule
);

module.exports = router;