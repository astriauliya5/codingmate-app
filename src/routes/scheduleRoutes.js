const express = require('express');
const router = express.Router();

const scheduleController = require('../controllers/scheduleController');

const { verifyToken, allowRoles } = require('../middleware/authMiddleware');

router.get('/', verifyToken, scheduleController.getSchedules);

router.get('/week', verifyToken, scheduleController.getWeeklySchedules);

router.post(
  '/routine',
  verifyToken,
  allowRoles('admin'),
  scheduleController.createRoutineSchedule
);

router.put(
  '/routine/:id',
  verifyToken,
  allowRoles('admin'),
  scheduleController.updateRoutineSchedule
);

router.post(
  '/swap',
  verifyToken,
  allowRoles('admin'),
  scheduleController.swapSchedule
);

module.exports = router;