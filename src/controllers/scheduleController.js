const db = require('../config/db');

function timeToMinutes(time) {
  if (!time) return 0;

  const [hour, minute] = String(time).split(':').map(Number);
  return hour * 60 + minute;
}

function getDayOfWeekMondayBased(dateString) {
  if (!dateString) return null;

  const [year, month, day] = dateString.split('-').map(Number);
  const date = new Date(year, month - 1, day);

  const jsDay = date.getDay();

  return jsDay === 0 ? 6 : jsDay - 1;
}

function formatDateOnly(dateValue) {
  if (!dateValue) return null;

  if (typeof dateValue === 'string') {
    return dateValue.slice(0, 10);
  }

  const date = new Date(dateValue);

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

function addDays(dateString, days) {
  const [year, month, day] = dateString.split('-').map(Number);
  const date = new Date(year, month - 1, day);

  date.setDate(date.getDate() + days);

  const resultYear = date.getFullYear();
  const resultMonth = String(date.getMonth() + 1).padStart(2, '0');
  const resultDay = String(date.getDate()).padStart(2, '0');

  return `${resultYear}-${resultMonth}-${resultDay}`;
}

function normalizeClassType(classType) {
  return classType === 'trial' ? 'trial' : 'reguler';
}

function isDateBetween(date, startDate, endDate) {
  if (!date || !startDate) return false;

  const current = new Date(date);
  const start = new Date(startDate);

  if (current < start) return false;

  if (endDate) {
    const end = new Date(endDate);
    if (current > end) return false;
  }

  return true;
}

function normalizeTime(timeValue) {
  if (!timeValue) return '';

  const time = String(timeValue);

  if (time.length === 5) {
    return `${time}:00`;
  }

  return time;
}

function addMinutes(timeValue, minutesToAdd) {
  const normalized = normalizeTime(timeValue);
  const [hour, minute] = normalized.split(':').map(Number);

  const startMinutes = hour * 60 + minute;
  const endMinutes = startMinutes + minutesToAdd;

  if (endMinutes > 24 * 60) {
    return null;
  }

  const endHour = Math.floor(endMinutes / 60);
  const endMinute = endMinutes % 60;

  return `${String(endHour).padStart(2, '0')}:${String(endMinute).padStart(2, '0')}:00`;
}
// function getDayOfWeekMondayBased(dateString) {
//   const [year, month, day] = dateString.split('-').map(Number);
//   const date = new Date(year, month - 1, day);

//   const jsDay = date.getDay(); 
//   return jsDay === 0 ? 6 : jsDay - 1;
// }

exports.getSchedules = async (req, res) => {
  try {
    let query = `
      SELECT
        rs.id,
        rs.student_id,
        s.full_name AS student_name,
        s.nickname,
        rs.mentor_id,
        u.full_name AS mentor_name,
        rs.level_id,
        l.level_name,
        rs.class_type,
        rs.day_of_week,
        rs.start_time,
        rs.end_time,
        rs.status
      FROM routine_schedules rs
      JOIN students s ON s.id = rs.student_id
      JOIN users u ON u.id = rs.mentor_id
      JOIN levels l ON l.id = rs.level_id
      WHERE rs.status = 'active'
      AND s.deleted_at IS NULL
    `;

    const params = [];

    if (req.user.role === 'mentor') {
      query += ` AND rs.mentor_id = ?`;
      params.push(req.user.id);
    }

    query += `
      ORDER BY rs.day_of_week ASC, rs.start_time ASC
    `;

    const [rows] = await db.query(query, params);

    res.json(rows);
  } catch (error) {
    console.error('GET SCHEDULES ERROR:', error);

    res.status(500).json({
      message: 'Gagal mengambil data jadwal',
      error: error.sqlMessage || error.message
    });
  }
};

exports.getWeeklySchedules = async (req, res) => {
  try {
    const { week_start } = req.query;

    if (!week_start) {
      return res.status(400).json({
        message: 'week_start wajib dikirim'
      });
    }

    const weekStart = week_start;
    const weekEnd = addDays(weekStart, 5);

    const params = [weekEnd, weekStart];
    let mentorFilter = '';

    if (req.user.role === 'mentor') {
      mentorFilter = ` AND rs.mentor_id = ?`;
      params.push(req.user.id);
    }

    const [routineRows] = await db.query(
      `
      SELECT
        rs.id,
        rs.student_id,
        s.full_name AS student_name,
        s.nickname,
        rs.mentor_id,
        u.full_name AS mentor_name,
        rs.level_id,
        l.level_name,
        rs.class_type,
        rs.start_date,
        rs.end_date,
        rs.day_of_week,
        rs.start_time,
        rs.end_time,
        rs.status
      FROM routine_schedules rs
      JOIN students s ON s.id = rs.student_id
      JOIN users u ON u.id = rs.mentor_id
      JOIN levels l ON l.id = rs.level_id
      WHERE rs.status = 'active'
      AND s.deleted_at IS NULL
      AND rs.start_date <= ?
      AND (rs.end_date IS NULL OR rs.end_date >= ?)
      ${mentorFilter}
      ORDER BY rs.day_of_week ASC, rs.start_time ASC
      `,
      params
    );

    const [exceptionRows] = await db.query(
      `
      SELECT
        se.id AS exception_id,
        se.routine_schedule_id,
        se.original_date,
        se.original_start_time,
        se.original_end_time,
        se.new_date,
        se.new_start_time,
        se.new_end_time,
        rs.student_id,
        s.full_name AS student_name,
        s.nickname,
        rs.mentor_id,
        u.full_name AS mentor_name,
        rs.level_id,
        l.level_name,
        rs.class_type
      FROM schedule_exceptions se
      JOIN routine_schedules rs ON rs.id = se.routine_schedule_id
      JOIN students s ON s.id = rs.student_id
      JOIN users u ON u.id = rs.mentor_id
      JOIN levels l ON l.id = rs.level_id
      WHERE (
        se.original_date BETWEEN ? AND ?
        OR se.new_date BETWEEN ? AND ?
      )
      ${req.user.role === 'mentor' ? 'AND rs.mentor_id = ?' : ''}
      `,
      req.user.role === 'mentor'
        ? [weekStart, weekEnd, weekStart, weekEnd, req.user.id]
        : [weekStart, weekEnd, weekStart, weekEnd]
    );

    const cancelledOriginalDates = new Set();

    exceptionRows.forEach(exception => {
      cancelledOriginalDates.add(
        `${exception.routine_schedule_id}_${formatDateOnly(exception.original_date)}`
      );
    });

    const schedules = [];

    routineRows.forEach(schedule => {
      const occurrenceDate = addDays(weekStart, Number(schedule.day_of_week));
      const scheduleStartDate = formatDateOnly(schedule.start_date);
      const scheduleEndDate = formatDateOnly(schedule.end_date);

      if (!isDateBetween(occurrenceDate, scheduleStartDate, scheduleEndDate)) {
        return;
      }

      const exceptionKey = `${schedule.id}_${occurrenceDate}`;

      if (cancelledOriginalDates.has(exceptionKey)) {
        return;
      }

      schedules.push({
        source: 'routine',
        id: schedule.id,
        routine_schedule_id: schedule.id,
        exception_id: null,
        date: occurrenceDate,
        day_of_week: Number(schedule.day_of_week),
        student_id: schedule.student_id,
        student_name: schedule.student_name,
        nickname: schedule.nickname,
        mentor_id: schedule.mentor_id,
        mentor_name: schedule.mentor_name,
        level_id: schedule.level_id,
        level_name: schedule.level_name,
        class_type: schedule.class_type,
        start_time: schedule.start_time,
        end_time: schedule.end_time
      });
    });

    exceptionRows.forEach(exception => {
      const newDate = formatDateOnly(exception.new_date);

      if (newDate < weekStart || newDate > weekEnd) {
        return;
      }

      const dayOfWeek = getDayOfWeekMondayBased(newDate);

      if (dayOfWeek === 6) {
        return;
      }

      schedules.push({
        source: 'exception',
        id: exception.routine_schedule_id,
        routine_schedule_id: exception.routine_schedule_id,
        exception_id: exception.exception_id,
        date: newDate,
        day_of_week: dayOfWeek,
        student_id: exception.student_id,
        student_name: exception.student_name,
        nickname: exception.nickname,
        mentor_id: exception.mentor_id,
        mentor_name: exception.mentor_name,
        level_id: exception.level_id,
        level_name: exception.level_name,
        class_type: exception.class_type,
        start_time: exception.new_start_time,
        end_time: exception.new_end_time,
        original_date: formatDateOnly(exception.original_date),
        original_start_time: exception.original_start_time,
        original_end_time: exception.original_end_time
      });
    });

    schedules.sort((a, b) => {
      if (a.date !== b.date) return a.date.localeCompare(b.date);
      return String(a.start_time).localeCompare(String(b.start_time));
    });

    res.json(schedules);
  } catch (error) {
    console.error('GET WEEKLY SCHEDULES ERROR:', error);
    console.error('SQL MESSAGE:', error.sqlMessage);

    res.status(500).json({
      message: 'Gagal mengambil jadwal mingguan',
      error: error.sqlMessage || error.message
    });
  }
};

exports.createRoutineSchedule = async (req, res) => {
  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();

    const {
      student_id,
      level_id,
      mentor_id,
      class_type,
      start_date,
      start_time,
      end_time
    } = req.body;

    const normalizedClassType = normalizeClassType(class_type);

    if (!student_id || !level_id || !mentor_id || !start_date || !start_time || !end_time) {
      await connection.rollback();
      return res.status(400).json({
        message: 'Siswa, level, mentor, tanggal mulai, jam mulai, dan jam selesai wajib diisi'
      });
    }

    const dayOfWeek = getDayOfWeekMondayBased(start_date);

    if (dayOfWeek === 6) {
      await connection.rollback();
      return res.status(400).json({
        message: 'Tanggal mulai tidak boleh hari Minggu'
      });
    }

    const startMinutes = timeToMinutes(start_time);
    const endMinutes = timeToMinutes(end_time);

    if (startMinutes >= endMinutes) {
      await connection.rollback();
      return res.status(400).json({
        message: 'Jam mulai harus lebih kecil dari jam selesai'
      });
    }

    if (endMinutes - startMinutes !== 60) {
      await connection.rollback();
      return res.status(400).json({
        message: 'Durasi 1 jadwal harus tepat 1 jam'
      });
    }

    const [studentRows] = await connection.query(
      `
      SELECT id
      FROM students
      WHERE id = ?
      AND deleted_at IS NULL
      LIMIT 1
      `,
      [student_id]
    );

    if (studentRows.length === 0) {
      await connection.rollback();
      return res.status(404).json({
        message: 'Data siswa tidak ditemukan'
      });
    }

    const [levelRows] = await connection.query(
      `
      SELECT id
      FROM levels
      WHERE id = ?
      AND is_active = TRUE
      LIMIT 1
      `,
      [level_id]
    );

    if (levelRows.length === 0) {
      await connection.rollback();
      return res.status(404).json({
        message: 'Data level tidak ditemukan'
      });
    }

    const [mentorRows] = await connection.query(
      `
      SELECT id
      FROM users
      WHERE id = ?
      AND role = 'mentor'
      AND deleted_at IS NULL
      LIMIT 1
      `,
      [mentor_id]
    );

    if (mentorRows.length === 0) {
      await connection.rollback();
      return res.status(404).json({
        message: 'Data mentor tidak ditemukan'
      });
    }

    const [studentLevelRows] = await connection.query(
      `
      SELECT
        id,
        mentor_id,
        remaining_credit,
        latest_expired_at
      FROM student_levels
      WHERE student_id = ?
      AND level_id = ?
      LIMIT 1
      FOR UPDATE
      `,
      [student_id, level_id]
    );

    if (studentLevelRows.length === 0) {
      await connection.rollback();
      return res.status(400).json({
        message: 'Siswa belum memiliki kredit untuk level ini. Buat invoice dan ubah status menjadi lunas terlebih dahulu.'
      });
    }

    const studentLevel = studentLevelRows[0];

    if (studentLevel.remaining_credit <= 0) {
      await connection.rollback();
      return res.status(400).json({
        message: 'Sisa kredit siswa untuk level ini sudah habis'
      });
    }

    if (studentLevel.mentor_id && Number(studentLevel.mentor_id) !== Number(mentor_id)) {
      await connection.rollback();
      return res.status(400).json({
        message: 'Level ini sudah memiliki mentor berbeda untuk siswa tersebut'
      });
    }

    const [creditRows] = await connection.query(
      `
      SELECT id
      FROM credit_purchases
      WHERE student_id = ?
      AND level_id = ?
      AND class_type = ?
      AND remaining_credit > 0
      LIMIT 1
      `,
      [student_id, level_id, normalizedClassType]
    );

    if (creditRows.length === 0) {
      await connection.rollback();
      return res.status(400).json({
        message: `Siswa belum memiliki kredit aktif untuk jenis kelas ${normalizedClassType}`
      });
    }

    let endDate;

    if (normalizedClassType === 'trial') {
      endDate = start_date;
    } else {
      endDate = formatDateOnly(studentLevel.latest_expired_at);

      if (!endDate) {
        await connection.rollback();
        return res.status(400).json({
          message: 'Tanggal expired kredit belum tersedia'
        });
      }

      if (new Date(start_date) > new Date(endDate)) {
        await connection.rollback();
        return res.status(400).json({
          message: 'Tanggal mulai jadwal melebihi tanggal expired kredit'
        });
      }
    }

    const [conflictRows] = await connection.query(
      `
      SELECT id
      FROM routine_schedules
      WHERE mentor_id = ?
      AND day_of_week = ?
      AND status = 'active'
      AND (
        (? < end_time) AND (? > start_time)
      )
      AND (
        start_date <= ?
        AND (end_date IS NULL OR end_date >= ?)
      )
      LIMIT 1
      `,
      [
        mentor_id,
        dayOfWeek,
        start_time,
        end_time,
        endDate,
        start_date
      ]
    );

    if (conflictRows.length > 0) {
      await connection.rollback();
      return res.status(400).json({
        message: 'Mentor sudah memiliki jadwal aktif pada tanggal/jam tersebut'
      });
    }

await connection.query(
  `
  UPDATE empty_schedules
  SET status = 'cancelled'
  WHERE mentor_id = ?
  AND available_date >= ?
  AND available_date <= ?
  AND status = 'active'
  AND (
    (? < end_time) AND (? > start_time)
  )
  `,
  [
    mentor_id,
    start_date,
    endDate,
    start_time,
    end_time
  ]
);

    if (!studentLevel.mentor_id) {
      await connection.query(
        `
        UPDATE student_levels
        SET mentor_id = ?
        WHERE id = ?
        `,
        [mentor_id, studentLevel.id]
      );
    }

    const [result] = await connection.query(
      `
      INSERT INTO routine_schedules
      (
        student_id,
        mentor_id,
        level_id,
        class_type,
        start_date,
        end_date,
        day_of_week,
        start_time,
        end_time,
        status
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'active')
      `,
      [
        student_id,
        mentor_id,
        level_id,
        normalizedClassType,
        start_date,
        endDate,
        dayOfWeek,
        start_time,
        end_time
      ]
    );

    await connection.commit();

    res.status(201).json({
      message: 'Jadwal rutin berhasil ditambahkan',
      id: result.insertId
    });
  } catch (error) {
    await connection.rollback();

    console.error('CREATE ROUTINE SCHEDULE ERROR:', error);
    console.error('SQL MESSAGE:', error.sqlMessage);

    res.status(500).json({
      message: 'Gagal menambahkan jadwal rutin',
      error: error.sqlMessage || error.message
    });
  } finally {
    connection.release();
  }
};

exports.updateRoutineSchedule = async (req, res) => {
  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();

    const { id } = req.params;

    const {
      day_of_week,
      start_time,
      end_time
    } = req.body;

    if (day_of_week === undefined || !start_time || !end_time) {
      await connection.rollback();
      return res.status(400).json({
        message: 'Hari, jam mulai, dan jam selesai wajib diisi'
      });
    }

    if (Number(day_of_week) < 0 || Number(day_of_week) > 6) {
      await connection.rollback();
      return res.status(400).json({
        message: 'Hari jadwal tidak valid'
      });
    }

    const startMinutes = timeToMinutes(start_time);
    const endMinutes = timeToMinutes(end_time);

    if (startMinutes >= endMinutes) {
      await connection.rollback();
      return res.status(400).json({
        message: 'Jam mulai harus lebih kecil dari jam selesai'
      });
    }

    if (endMinutes - startMinutes !== 60) {
      await connection.rollback();
      return res.status(400).json({
        message: 'Durasi 1 jadwal harus tepat 1 jam'
      });
    }

    const [scheduleRows] = await connection.query(
      `
      SELECT *
      FROM routine_schedules
      WHERE id = ?
      AND status = 'active'
      LIMIT 1
      FOR UPDATE
      `,
      [id]
    );

    if (scheduleRows.length === 0) {
      await connection.rollback();
      return res.status(404).json({
        message: 'Jadwal rutin tidak ditemukan'
      });
    }

    const schedule = scheduleRows[0];

    const [conflictRows] = await connection.query(
      `
      SELECT id
      FROM routine_schedules
      WHERE mentor_id = ?
      AND day_of_week = ?
      AND status = 'active'
      AND id != ?
      AND (
        (? < end_time) AND (? > start_time)
      )
      LIMIT 1
      `,
      [
        schedule.mentor_id,
        day_of_week,
        id,
        start_time,
        end_time
      ]
    );

    if (conflictRows.length > 0) {
      await connection.rollback();
      return res.status(400).json({
        message: 'Mentor sudah memiliki jadwal aktif pada jam tersebut'
      });
    }

    await connection.query(
      `
      UPDATE routine_schedules
      SET
        day_of_week = ?,
        start_time = ?,
        end_time = ?
      WHERE id = ?
      `,
      [
        day_of_week,
        start_time,
        end_time,
        id
      ]
    );

    await connection.commit();

    res.json({
      message: 'Jadwal rutin berhasil diperbarui'
    });
  } catch (error) {
    await connection.rollback();

    console.error('UPDATE ROUTINE SCHEDULE ERROR:', error);

    res.status(500).json({
      message: 'Gagal memperbarui jadwal rutin',
      error: error.sqlMessage || error.message
    });
  } finally {
    connection.release();
  }
};

exports.swapSchedule = async (req, res) => {
  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();

    const {
      routine_schedule_id,
      original_date,
      new_date,
      new_start_time,
      new_end_time
    } = req.body;

    if (!routine_schedule_id || !original_date || !new_date || !new_start_time || !new_end_time) {
      await connection.rollback();
      return res.status(400).json({
        message: 'Jadwal rutin lama, tanggal lama, tanggal baru, jam mulai baru, dan jam selesai baru wajib diisi'
      });
    }

    const startMinutes = timeToMinutes(new_start_time);
    const endMinutes = timeToMinutes(new_end_time);

    if (startMinutes >= endMinutes) {
      await connection.rollback();
      return res.status(400).json({
        message: 'Jam mulai baru harus lebih kecil dari jam selesai baru'
      });
    }

    if (endMinutes - startMinutes !== 60) {
      await connection.rollback();
      return res.status(400).json({
        message: 'Durasi tukar jadwal harus tepat 1 jam'
      });
    }

    const [scheduleRows] = await connection.query(
      `
      SELECT *
      FROM routine_schedules
      WHERE id = ?
      AND status = 'active'
      LIMIT 1
      FOR UPDATE
      `,
      [routine_schedule_id]
    );

    if (scheduleRows.length === 0) {
      await connection.rollback();
      return res.status(404).json({
        message: 'Jadwal rutin lama tidak ditemukan'
      });
    }

    const schedule = scheduleRows[0];

    const originalDay = getDayOfWeekMondayBased(original_date);
    const newDay = getDayOfWeekMondayBased(new_date);

    if (originalDay === 6) {
      await connection.rollback();
      return res.status(400).json({
        message: 'Tanggal lama tidak boleh hari Minggu'
      });
    }

    if (newDay === 6) {
      await connection.rollback();
      return res.status(400).json({
        message: 'Tanggal baru tidak boleh hari Minggu'
      });
    }

    if (Number(schedule.day_of_week) !== Number(originalDay)) {
      await connection.rollback();
      return res.status(400).json({
        message: 'Tanggal lama tidak sesuai dengan hari jadwal rutin yang dipilih'
      });
    }

    const [existingExceptionRows] = await connection.query(
      `
      SELECT id
      FROM schedule_exceptions
      WHERE routine_schedule_id = ?
      AND original_date = ?
      LIMIT 1
      `,
      [routine_schedule_id, original_date]
    );

    if (existingExceptionRows.length > 0) {
      await connection.rollback();
      return res.status(400).json({
        message: 'Pertemuan pada tanggal tersebut sudah pernah ditukar'
      });
    }

    const [routineConflictRows] = await connection.query(
      `
      SELECT id
      FROM routine_schedules
      WHERE mentor_id = ?
      AND day_of_week = ?
      AND status = 'active'
      AND id != ?
      AND (
        (? < end_time) AND (? > start_time)
      )
      LIMIT 1
      `,
      [
        schedule.mentor_id,
        newDay,
        routine_schedule_id,
        new_start_time,
        new_end_time
      ]
    );

    if (routineConflictRows.length > 0) {
      await connection.rollback();
      return res.status(400).json({
        message: 'Mentor sudah memiliki jadwal rutin lain pada tanggal/jam baru tersebut'
      });
    }

    const [exceptionConflictRows] = await connection.query(
      `
      SELECT se.id
      FROM schedule_exceptions se
      JOIN routine_schedules rs ON rs.id = se.routine_schedule_id
      WHERE rs.mentor_id = ?
      AND se.new_date = ?
      AND (
        (? < se.new_end_time) AND (? > se.new_start_time)
      )
      LIMIT 1
      `,
      [
        schedule.mentor_id,
        new_date,
        new_start_time,
        new_end_time
      ]
    );

    if (exceptionConflictRows.length > 0) {
      await connection.rollback();
      return res.status(400).json({
        message: 'Mentor sudah memiliki jadwal tukar lain pada tanggal/jam baru tersebut'
      });
    }

    const firstSlotStart = normalizeTime(new_start_time);
    const firstSlotEnd = addMinutes(firstSlotStart, 30);
    const secondSlotStart = firstSlotEnd;
    const secondSlotEnd = normalizeTime(new_end_time);

    const [availableRows] = await connection.query(
      `
      SELECT id, start_time, end_time
      FROM empty_schedules
      WHERE mentor_id = ?
      AND available_date = ?
      AND status = 'active'
      AND (
        (start_time = ? AND end_time = ?)
        OR
        (start_time = ? AND end_time = ?)
      )
      `,
      [
        schedule.mentor_id,
        new_date,
        firstSlotStart,
        firstSlotEnd,
        secondSlotStart,
        secondSlotEnd
      ]
    );

    if (availableRows.length < 2) {
      await connection.rollback();
      return res.status(400).json({
        message: 'Mentor harus memiliki 2 slot jadwal kosong berurutan untuk durasi 1 jam'
      });
    }

    const [result] = await connection.query(
      `
      INSERT INTO schedule_exceptions
      (
        routine_schedule_id,
        original_date,
        original_start_time,
        original_end_time,
        new_date,
        new_start_time,
        new_end_time
      )
      VALUES (?, ?, ?, ?, ?, ?, ?)
      `,
      [
        routine_schedule_id,
        original_date,
        schedule.start_time,
        schedule.end_time,
        new_date,
        new_start_time,
        new_end_time
      ]
    );

    await connection.commit();

    res.status(201).json({
      message: 'Tukar jadwal berhasil disimpan',
      id: result.insertId
    });
  } catch (error) {
    await connection.rollback();

    console.error('SWAP SCHEDULE ERROR:', error);
    console.error('SQL MESSAGE:', error.sqlMessage);

    res.status(500).json({
      message: 'Gagal menukar jadwal',
      error: error.sqlMessage || error.message
    });
  } finally {
    connection.release();
  }
};