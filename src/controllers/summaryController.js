const db = require('../config/db');

function formatDateOnly(dateValue) {
  if (!dateValue) return null;

  if (typeof dateValue === 'string') {
    return dateValue.slice(0, 10);
  }

  const date = new Date(dateValue);

  if (Number.isNaN(date.getTime())) return null;

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

function formatDateLabel(dateValue) {
  const dateString = formatDateOnly(dateValue);

  if (!dateString) return '-';

  const [year, month, day] = dateString.split('-');

  return `${day}/${month}/${year}`;
}

function addDays(dateString, days) {
  const [year, month, day] = String(dateString).slice(0, 10).split('-').map(Number);
  const date = new Date(year, month - 1, day);

  date.setDate(date.getDate() + days);

  const resultYear = date.getFullYear();
  const resultMonth = String(date.getMonth() + 1).padStart(2, '0');
  const resultDay = String(date.getDate()).padStart(2, '0');

  return `${resultYear}-${resultMonth}-${resultDay}`;
}

function getDayOfWeekMondayBased(dateString) {
  if (!dateString) return null;

  const [year, month, day] = String(dateString).slice(0, 10).split('-').map(Number);
  const date = new Date(year, month - 1, day);

  const jsDay = date.getDay();

  return jsDay === 0 ? 6 : jsDay - 1;
}

function timeForDisplay(timeValue) {
  if (!timeValue) return '';
  return String(timeValue).slice(0, 5);
}

function formatClassType(value) {
  return value === 'trial' ? 'Trial' : 'Reguler';
}

exports.getSummaries = async (req, res) => {
  try {
    const [rows] = await db.query(
      `
      SELECT
        sm.id,
        sm.student_id,
        sm.mentor_id,
        sm.level_id,
        sm.class_date,
        sm.class_type,
        sm.keterangan,
        sm.summary_text,
        sm.status,
        sm.approved_by,
        sm.approved_at,
        sm.created_at,

        s.full_name,
        s.nickname,

        u.full_name AS mentor_name,

        l.level_name,

        sl.remaining_credit,
        sl.latest_expired_at

      FROM summaries sm
      JOIN students s ON s.id = sm.student_id
      JOIN users u ON u.id = sm.mentor_id
      JOIN levels l ON l.id = sm.level_id
      LEFT JOIN student_levels sl
        ON sl.student_id = sm.student_id
        AND sl.level_id = sm.level_id

      WHERE s.deleted_at IS NULL
      ORDER BY sm.class_date DESC, sm.id DESC
      `
    );

    res.json(rows);
  } catch (error) {
    console.error('GET SUMMARIES ERROR:', error);

    res.status(500).json({
      message: 'Gagal mengambil data summary',
      error: error.sqlMessage || error.message
    });
  }
};

exports.getSummaryById = async (req, res) => {
  try {
    const { id } = req.params;

    const [rows] = await db.query(
      `
      SELECT
        sm.id,
        sm.student_id,
        sm.mentor_id,
        sm.level_id,
        sm.class_date,
        sm.class_type,
        sm.keterangan,
        sm.summary_text,
        sm.status,
        sm.approved_by,
        sm.approved_at,
        sm.created_at,

        s.full_name,
        s.nickname,

        u.full_name AS mentor_name,

        l.level_name,

        sl.remaining_credit,
        sl.latest_expired_at

      FROM summaries sm
      JOIN students s ON s.id = sm.student_id
      JOIN users u ON u.id = sm.mentor_id
      JOIN levels l ON l.id = sm.level_id
      LEFT JOIN student_levels sl
        ON sl.student_id = sm.student_id
        AND sl.level_id = sm.level_id

      WHERE sm.id = ?
      AND s.deleted_at IS NULL
      LIMIT 1
      `,
      [id]
    );

    if (rows.length === 0) {
      return res.status(404).json({
        message: 'Summary tidak ditemukan'
      });
    }

    res.json(rows[0]);
  } catch (error) {
    console.error('GET SUMMARY DETAIL ERROR:', error);

    res.status(500).json({
      message: 'Gagal mengambil detail summary',
      error: error.sqlMessage || error.message
    });
  }
};

exports.approveSummary = async (req, res) => {
  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();

    const { id } = req.params;

    const [summaryRows] = await connection.query(
      `
      SELECT
        id,
        student_id,
        mentor_id,
        level_id,
        status
      FROM summaries
      WHERE id = ?
      LIMIT 1
      FOR UPDATE
      `,
      [id]
    );

    if (summaryRows.length === 0) {
      await connection.rollback();
      return res.status(404).json({
        message: 'Summary tidak ditemukan'
      });
    }

    const summary = summaryRows[0];

    if (summary.status === 'terkirim') {
      await connection.rollback();
      return res.status(400).json({
        message: 'Summary sudah disetujui dan tidak bisa diubah lagi'
      });
    }

    const [studentLevelRows] = await connection.query(
      `
      SELECT
        id,
        remaining_credit
      FROM student_levels
      WHERE student_id = ?
      AND level_id = ?
      LIMIT 1
      FOR UPDATE
      `,
      [
        summary.student_id,
        summary.level_id
      ]
    );

    if (studentLevelRows.length === 0) {
      await connection.rollback();
      return res.status(400).json({
        message: 'Data kredit siswa untuk level ini tidak ditemukan'
      });
    }

    const studentLevel = studentLevelRows[0];

    if (Number(studentLevel.remaining_credit) <= 0) {
      await connection.rollback();
      return res.status(400).json({
        message: 'Sisa kredit siswa sudah habis, summary tidak bisa disetujui'
      });
    }

    await connection.query(
      `
      UPDATE summaries
      SET
        status = 'terkirim',
        approved_by = ?,
        approved_at = NOW()
      WHERE id = ?
      `,
      [
        req.user.id,
        id
      ]
    );

    await connection.query(
      `
      UPDATE student_levels
      SET remaining_credit = remaining_credit - 1
      WHERE id = ?
      `,
      [studentLevel.id]
    );

    await connection.commit();

    res.json({
      message: 'Summary berhasil disetujui dan kredit siswa berkurang 1'
    });
  } catch (error) {
    await connection.rollback();

    console.error('APPROVE SUMMARY ERROR:', error);

    res.status(500).json({
      message: 'Gagal menyetujui summary',
      error: error.sqlMessage || error.message
    });
  } finally {
    connection.release();
  }
};

exports.getMentorSummaries = async (req, res) => {
  try {
    const mentorId = req.user.id;

    const [rows] = await db.query(
      `
      SELECT
        sm.id,
        sm.student_id,
        sm.mentor_id,
        sm.level_id,
        sm.class_date,
        sm.class_type,
        sm.keterangan,
        sm.summary_text,
        sm.status,
        sm.approved_at,
        sm.created_at,

        s.full_name,
        s.nickname,

        l.level_name,

        sl.remaining_credit,
        sl.latest_expired_at

      FROM summaries sm
      JOIN students s ON s.id = sm.student_id
      JOIN levels l ON l.id = sm.level_id
      LEFT JOIN student_levels sl
        ON sl.student_id = sm.student_id
        AND sl.level_id = sm.level_id

      WHERE sm.mentor_id = ?
      AND s.deleted_at IS NULL

      ORDER BY sm.class_date DESC, sm.id DESC
      `,
      [mentorId]
    );

    res.json(rows);
  } catch (error) {
    console.error('GET MENTOR SUMMARIES ERROR:', error);

    res.status(500).json({
      message: 'Gagal mengambil data summary mentor',
      error: error.sqlMessage || error.message
    });
  }
};

exports.getMentorSummaryOptions = async (req, res) => {
  try {
    const mentorId = req.user.id;

    const [rows] = await db.query(
      `
      SELECT
        sl.student_id,
        s.full_name,
        s.nickname,
        sl.level_id,
        l.level_name,
        sl.remaining_credit,
        sl.latest_expired_at
      FROM student_levels sl
      JOIN students s ON s.id = sl.student_id
      JOIN levels l ON l.id = sl.level_id
      WHERE sl.mentor_id = ?
      AND s.deleted_at IS NULL
      AND l.is_active = 1
      AND sl.remaining_credit > 0
      ORDER BY s.full_name ASC, l.level_name ASC
      `,
      [mentorId]
    );

    res.json(rows);
  } catch (error) {
    console.error('GET MENTOR SUMMARY OPTIONS ERROR:', error);

    res.status(500).json({
      message: 'Gagal mengambil pilihan siswa untuk summary',
      error: error.sqlMessage || error.message
    });
  }
};

exports.createSummary = async (req, res) => {
  try {
    const mentorId = req.user.id;

    const {
      student_id,
      level_id,
      class_date,
      class_type,
      keterangan,
      summary_text
    } = req.body;

    if (!student_id || !level_id || !class_date || !class_type || !summary_text) {
      return res.status(400).json({
        message: 'Siswa, level, tanggal kelas, jenis kelas, dan detail summary wajib diisi'
      });
    }

    if (!['reguler', 'trial'].includes(class_type)) {
      return res.status(400).json({
        message: 'Jenis kelas tidak valid'
      });
    }

    const [studentLevelRows] = await db.query(
      `
      SELECT
        id,
        remaining_credit
      FROM student_levels
      WHERE student_id = ?
      AND level_id = ?
      AND mentor_id = ?
      LIMIT 1
      `,
      [
        student_id,
        level_id,
        mentorId
      ]
    );

    if (studentLevelRows.length === 0) {
      return res.status(400).json({
        message: 'Siswa dan level ini tidak terdaftar untuk mentor yang sedang login'
      });
    }

    if (Number(studentLevelRows[0].remaining_credit) <= 0) {
      return res.status(400).json({
        message: 'Sisa kredit siswa sudah habis, summary tidak bisa dibuat'
      });
    }

    const [duplicateRows] = await db.query(
      `
      SELECT id
      FROM summaries
      WHERE student_id = ?
      AND mentor_id = ?
      AND level_id = ?
      AND class_date = ?
      LIMIT 1
      `,
      [
        student_id,
        mentorId,
        level_id,
        class_date
      ]
    );

    if (duplicateRows.length > 0) {
      return res.status(400).json({
        message: 'Summary untuk siswa, level, dan tanggal kelas ini sudah ada'
      });
    }

    await db.query(
      `
      INSERT INTO summaries
      (
        student_id,
        mentor_id,
        level_id,
        class_date,
        class_type,
        keterangan,
        summary_text,
        status
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, 'pending')
      `,
      [
        student_id,
        mentorId,
        level_id,
        class_date,
        class_type,
        keterangan || null,
        summary_text
      ]
    );

    res.status(201).json({
      message: 'Summary berhasil disimpan dan menunggu persetujuan admin'
    });
  } catch (error) {
    console.error('CREATE SUMMARY ERROR:', error);

    res.status(500).json({
      message: 'Gagal menyimpan summary',
      error: error.sqlMessage || error.message
    });
  }
};

exports.deleteMentorSummary = async (req, res) => {
  try {
    const mentorId = req.user.id;
    const { id } = req.params;

    const [summaryRows] = await db.query(
      `
      SELECT id, status
      FROM summaries
      WHERE id = ?
      AND mentor_id = ?
      LIMIT 1
      `,
      [
        id,
        mentorId
      ]
    );

    if (summaryRows.length === 0) {
      return res.status(404).json({
        message: 'Summary tidak ditemukan'
      });
    }

    if (summaryRows[0].status === 'terkirim') {
      return res.status(400).json({
        message: 'Summary yang sudah disetujui admin tidak bisa dihapus'
      });
    }

    await db.query(
      `
      DELETE FROM summaries
      WHERE id = ?
      AND mentor_id = ?
      AND status = 'pending'
      `,
      [
        id,
        mentorId
      ]
    );

    res.json({
      message: 'Summary berhasil dihapus'
    });
  } catch (error) {
    console.error('DELETE MENTOR SUMMARY ERROR:', error);

    res.status(500).json({
      message: 'Gagal menghapus summary',
      error: error.sqlMessage || error.message
    });
  }
};

exports.getMentorSummaryById = async (req, res) => {
  try {
    const mentorId = req.user.id;
    const { id } = req.params;

    const [rows] = await db.query(
      `
      SELECT
        sm.id,
        sm.student_id,
        sm.mentor_id,
        sm.level_id,
        sm.class_date,
        sm.class_type,
        sm.keterangan,
        sm.summary_text,
        sm.status,
        sm.approved_at,
        sm.created_at,

        s.full_name,
        s.nickname,

        l.level_name,

        sl.remaining_credit,
        sl.latest_expired_at

      FROM summaries sm
      JOIN students s ON s.id = sm.student_id
      JOIN levels l ON l.id = sm.level_id
      LEFT JOIN student_levels sl
        ON sl.student_id = sm.student_id
        AND sl.level_id = sm.level_id

      WHERE sm.id = ?
      AND sm.mentor_id = ?
      AND s.deleted_at IS NULL

      LIMIT 1
      `,
      [
        id,
        mentorId
      ]
    );

    if (rows.length === 0) {
      return res.status(404).json({
        message: 'Summary tidak ditemukan'
      });
    }

    res.json(rows[0]);
  } catch (error) {
    console.error('GET MENTOR SUMMARY DETAIL ERROR:', error);

    res.status(500).json({
      message: 'Gagal mengambil detail summary mentor',
      error: error.sqlMessage || error.message
    });
  }
};

exports.getMentorClassDates = async (req, res) => {
  try {
    const mentorId = req.user.id;
    const { student_id, level_id } = req.query;

    if (!student_id || !level_id) {
      return res.status(400).json({
        message: 'student_id dan level_id wajib diisi'
      });
    }

    const [studentLevelRows] = await db.query(
      `
      SELECT
        id,
        remaining_credit,
        latest_expired_at
      FROM student_levels
      WHERE student_id = ?
      AND level_id = ?
      AND mentor_id = ?
      LIMIT 1
      `,
      [student_id, level_id, mentorId]
    );

    if (studentLevelRows.length === 0) {
      return res.status(400).json({
        message: 'Siswa dan level ini tidak terdaftar untuk mentor yang sedang login'
      });
    }

    const studentLevel = studentLevelRows[0];
    const remainingCredit = Number(studentLevel.remaining_credit || 0);
    const latestExpiredAt = formatDateOnly(studentLevel.latest_expired_at);

    if (remainingCredit <= 0) {
      return res.json({
        class_dates: []
      });
    }

    const [routineRows] = await db.query(
      `
      SELECT
        rs.id AS routine_schedule_id,
        rs.student_id,
        rs.level_id,
        rs.mentor_id,
        rs.day_of_week,
        rs.start_date,
        rs.end_date,
        rs.start_time,
        rs.end_time,
        rs.class_type,
        s.full_name AS student_name,
        s.nickname,
        l.level_name
      FROM routine_schedules rs
      JOIN students s ON s.id = rs.student_id
      JOIN levels l ON l.id = rs.level_id
      WHERE rs.student_id = ?
      AND rs.level_id = ?
      AND rs.mentor_id = ?
      AND rs.status = 'active'
      AND s.deleted_at IS NULL
      ORDER BY rs.start_date ASC, rs.day_of_week ASC, rs.start_time ASC
      `,
      [student_id, level_id, mentorId]
    );

    if (routineRows.length === 0) {
      return res.json({
        class_dates: []
      });
    }

    const routineIds = routineRows.map(row => row.routine_schedule_id);

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
        se.new_end_time
      FROM schedule_exceptions se
      WHERE se.routine_schedule_id IN (?)
      ORDER BY se.new_date ASC, se.new_start_time ASC
      `,
      [routineIds]
    );

    const [summaryRows] = await db.query(
      `
      SELECT
        id,
        class_date
      FROM summaries
      WHERE student_id = ?
      AND mentor_id = ?
      AND level_id = ?
      `,
      [student_id, mentorId, level_id]
    );

    const usedSummaryDates = new Set(
      summaryRows
        .map(summary => formatDateOnly(summary.class_date))
        .filter(Boolean)
    );

    const exceptionByOriginalKey = new Map();

    exceptionRows.forEach(exception => {
      const originalDate = formatDateOnly(exception.original_date);

      if (!originalDate) return;

      exceptionByOriginalKey.set(
        `${exception.routine_schedule_id}_${originalDate}`,
        exception
      );
    });

    const today = formatDateOnly(new Date());
    const generatedDates = [];

    routineRows.forEach(routine => {
      const routineStartDate = formatDateOnly(routine.start_date);
      const routineEndDate = formatDateOnly(routine.end_date) || latestExpiredAt;

      if (!routineStartDate) return;

      let currentDate = routineStartDate;
      let guard = 0;

      while (guard < 500) {
        guard++;

        const currentDay = getDayOfWeekMondayBased(currentDate);

        if (Number(currentDay) === Number(routine.day_of_week)) {
          const exceptionKey = `${routine.routine_schedule_id}_${currentDate}`;
          const exception = exceptionByOriginalKey.get(exceptionKey);

          let finalDate = currentDate;
          let startTime = routine.start_time;
          let endTime = routine.end_time;
          let source = 'routine';
          let exceptionId = null;

          if (exception) {
            finalDate = formatDateOnly(exception.new_date);
            startTime = exception.new_start_time;
            endTime = exception.new_end_time;
            source = 'exception';
            exceptionId = exception.exception_id;
          }

          const finalDateOnly = formatDateOnly(finalDate);

          const isAfterToday = finalDateOnly > today;
          const isAfterExpired = routineEndDate && finalDateOnly > routineEndDate;
          const alreadySummarized = usedSummaryDates.has(finalDateOnly);

          if (!isAfterToday && !isAfterExpired && !alreadySummarized) {
            generatedDates.push({
              date: finalDateOnly,
              start_time: timeForDisplay(startTime),
              end_time: timeForDisplay(endTime),
              class_type: routine.class_type || 'reguler',
              source,
              routine_schedule_id: routine.routine_schedule_id,
              exception_id: exceptionId,
              label: `${formatDateLabel(finalDateOnly)} | ${timeForDisplay(startTime)} - ${timeForDisplay(endTime)} | ${formatClassType(routine.class_type)}${source === 'exception' ? ' | Tukar Jadwal' : ''}`
            });
          }
        }

        currentDate = addDays(currentDate, 1);

        if (routineEndDate && currentDate > routineEndDate) {
          break;
        }

        if (currentDate > today) {
          break;
        }
      }
    });

    generatedDates.sort((a, b) => {
      if (a.date !== b.date) return b.date.localeCompare(a.date);
      return String(b.start_time).localeCompare(String(a.start_time));
    });

    res.json({
      class_dates: generatedDates.slice(0, remainingCredit)
    });
  } catch (error) {
    console.error('GET MENTOR CLASS DATES ERROR:', error);

    res.status(500).json({
      message: 'Gagal mengambil tanggal kelas mentor',
      error: error.sqlMessage || error.message
    });
  }
};