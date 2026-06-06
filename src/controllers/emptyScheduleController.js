const db = require('../config/db');

function addDays(dateString, days) {
  const [year, month, day] = dateString.split('-').map(Number);
  const date = new Date(year, month - 1, day);

  date.setDate(date.getDate() + days);

  const resultYear = date.getFullYear();
  const resultMonth = String(date.getMonth() + 1).padStart(2, '0');
  const resultDay = String(date.getDate()).padStart(2, '0');

  return `${resultYear}-${resultMonth}-${resultDay}`;
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

function getDayOfWeekMondayBased(dateString) {
  if (!dateString) return null;

  const [year, month, day] = dateString.split('-').map(Number);
  const date = new Date(year, month - 1, day);

  const jsDay = date.getDay();

  // JS: Minggu = 0, Senin = 1
  // Sistem kita: Senin = 0, Selasa = 1, ..., Sabtu = 5, Minggu = 6
  return jsDay === 0 ? 6 : jsDay - 1;
}

function timeToMinutes(time) {
  if (!time) return 0;

  const [hour, minute] = String(time).split(':').map(Number);
  return hour * 60 + minute;
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

function addThirtyMinutes(timeValue) {
  return addMinutes(timeValue, 30);
}

exports.getWeeklyEmptySchedules = async (req, res) => {
  try {
    const { week_start, mentor_id } = req.query;

    if (!week_start) {
      return res.status(400).json({
        message: 'week_start wajib dikirim'
      });
    }

    const weekEnd = addDays(week_start, 5);

    let query = `
      SELECT
        es.id,
        es.mentor_id,
        u.full_name AS mentor_name,
        u.username AS mentor_username,
        es.available_date,
        es.start_time,
        es.end_time,
        es.status
      FROM empty_schedules es
      JOIN users u ON u.id = es.mentor_id
      WHERE es.status = 'active'
      AND u.deleted_at IS NULL
      AND es.available_date BETWEEN ? AND ?
    `;

    const params = [week_start, weekEnd];

    // Kalau login mentor, otomatis cuma lihat jadwal kosong miliknya sendiri
    if (req.user.role === 'mentor') {
      query += ` AND es.mentor_id = ?`;
      params.push(req.user.id);
    }

    // Kalau admin pilih mentor tertentu
    if (req.user.role === 'admin' && mentor_id) {
      query += ` AND es.mentor_id = ?`;
      params.push(mentor_id);
    }

    query += `
      ORDER BY es.available_date ASC, es.start_time ASC
    `;

    const [rows] = await db.query(query, params);

    const result = rows
      .map(row => {
        const date = formatDateOnly(row.available_date);
        const dayOfWeek = getDayOfWeekMondayBased(date);

        return {
          id: row.id,
          mentor_id: row.mentor_id,
          mentor_name: row.mentor_name,
          mentor_username: row.mentor_username,
          date,
          day_of_week: dayOfWeek,
          start_time: row.start_time,
          end_time: row.end_time,
          status: row.status
        };
      })
      .filter(row => row.day_of_week >= 0 && row.day_of_week <= 5);

    res.json(result);
  } catch (error) {
    console.error('GET WEEKLY EMPTY SCHEDULES ERROR:', error);
    console.error('SQL MESSAGE:', error.sqlMessage);

    res.status(500).json({
      message: 'Gagal mengambil jadwal kosong',
      error: error.sqlMessage || error.message
    });
  }
};

exports.createEmptySchedule = async (req, res) => {
  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();

    const { slots } = req.body;

    if (!slots || !Array.isArray(slots) || slots.length === 0) {
      await connection.rollback();
      return res.status(400).json({
        message: 'Minimal pilih 1 slot jadwal kosong'
      });
    }

    let insertedCount = 0;
    let skippedCount = 0;

    for (const slot of slots) {
      const availableDate = slot.available_date;
      const startTime = normalizeTime(slot.start_time);
      const endTime = addThirtyMinutes(startTime);

      if (!availableDate || !startTime || !endTime) {
        skippedCount++;
        continue;
      }

      const dayOfWeek = getDayOfWeekMondayBased(availableDate);

      if (dayOfWeek === 6) {
        skippedCount++;
        continue;
      }

      const startMinutes = timeToMinutes(startTime);
      const endMinutes = timeToMinutes(endTime);

      if (startMinutes >= endMinutes) {
        skippedCount++;
        continue;
      }

      const [conflictRows] = await connection.query(
        `
        SELECT id
        FROM empty_schedules
        WHERE mentor_id = ?
        AND available_date = ?
        AND status = 'active'
        AND (
          (? < end_time) AND (? > start_time)
        )
        LIMIT 1
        `,
        [
          req.user.id,
          availableDate,
          startTime,
          endTime
        ]
      );

      if (conflictRows.length > 0) {
        skippedCount++;
        continue;
      }

      const [routineConflictRows] = await connection.query(
        `
        SELECT rs.id
        FROM routine_schedules rs
        WHERE rs.mentor_id = ?
        AND rs.day_of_week = ?
        AND rs.status = 'active'
        AND rs.start_date <= ?
        AND (rs.end_date IS NULL OR rs.end_date >= ?)
        AND (
          (? < rs.end_time) AND (? > rs.start_time)
        )
        AND NOT EXISTS (
          SELECT 1
          FROM schedule_exceptions se
          WHERE se.routine_schedule_id = rs.id
          AND se.original_date = ?
        )
        LIMIT 1
        `,
        [
          req.user.id,
          dayOfWeek,
          availableDate,
          availableDate,
          startTime,
          endTime,
          availableDate
        ]
      );

      if (routineConflictRows.length > 0) {
        skippedCount++;
        continue;
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
          req.user.id,
          availableDate,
          startTime,
          endTime
        ]
      );

      if (exceptionConflictRows.length > 0) {
        skippedCount++;
        continue;
      }

      await connection.query(
        `
        INSERT INTO empty_schedules
        (
          mentor_id,
          available_date,
          start_time,
          end_time,
          status
        )
        VALUES (?, ?, ?, ?, 'active')
        `,
        [
          req.user.id,
          availableDate,
          startTime,
          endTime
        ]
      );

      insertedCount++;
    }

    await connection.commit();

    res.status(201).json({
      message: 'Jadwal kosong berhasil disimpan',
      inserted_count: insertedCount,
      skipped_count: skippedCount
    });
  } catch (error) {
    await connection.rollback();

    console.error('CREATE EMPTY SCHEDULE ERROR:', error);
    console.error('SQL MESSAGE:', error.sqlMessage);

    res.status(500).json({
      message: 'Gagal menambahkan jadwal kosong',
      error: error.sqlMessage || error.message
    });
  } finally {
    connection.release();
  }
};

exports.deleteEmptySchedule = async (req, res) => {
  try {
    const { id } = req.params;

    let query = `
      DELETE FROM empty_schedules
      WHERE id = ?
    `;

    const params = [id];

    if (req.user.role === 'mentor') {
      query += ` AND mentor_id = ?`;
      params.push(req.user.id);
    }

    const [result] = await db.query(query, params);

    if (result.affectedRows === 0) {
      return res.status(404).json({
        message: 'Jadwal kosong tidak ditemukan'
      });
    }

    res.json({
      message: 'Jadwal kosong berhasil dihapus permanen'
    });
  } catch (error) {
    console.error('DELETE EMPTY SCHEDULE ERROR:', error);

    res.status(500).json({
      message: 'Gagal menghapus jadwal kosong',
      error: error.sqlMessage || error.message
    });
  }
};