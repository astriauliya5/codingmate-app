const db = require('../config/db');

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